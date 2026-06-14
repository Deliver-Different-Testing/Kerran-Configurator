using System;
using System.IO;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Common;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

/// <summary>
/// CRUD for post-activation business-document instances against an agent / NP.
/// File bytes live in S3 (via <see cref="IS3StorageService"/>); this service
/// owns the DB-side metadata + lifecycle (verify / reject / soft-delete) and
/// orchestrates S3 puts on upload. Mirrors <see cref="CourierDocumentService"/>.
///
/// NP scope filtering: admin / tenant-staff see all agents in the tenant; an NP
/// user only sees its own agent record (<c>tucAgent.UcagId == scope.NpAgentId</c>).
/// </summary>
public class AgentDocumentService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    INpScopeResolver scopeResolver,
    IS3StorageService storage,
    IHttpContextAccessor httpContextAccessor,
    IAgentDocumentAiReviewer aiReviewer) : BaseService(contextFactory)
{
    // ─── LIST ────────────────────────────────────────────────────────────

    public async Task<AgentDocumentsResponse> ListAsync(int agentId, Guid messageId, CancellationToken ct = default)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return FailList(messageId, "No NP scope configured for this user.");
        }

        if (!await CanAccessAgentAsync(agentId, scope, ct))
        {
            return FailList(messageId, "Agent not found or outside your scope.");
        }

        var rows = await Context.TucAgentDocuments
            .AsNoTracking()
            .Where(d => d.AgentId == agentId && d.IsActive)
            .OrderByDescending(d => d.UploadedDate)
            .Select(ProjectToDto)
            .ToListAsync(ct);

        return new AgentDocumentsResponse(messageId) { Success = true, Documents = rows };
    }

    // STEVE-COMPLIANCE-MONITORING-REDESIGN-2026-06-13 — flat list of every
    // pending document across the calling tenant's agent roster, paired with
    // the subject's name + city + state so the new Compliance Monitoring
    // action queue can render each row without a separate agents lookup.
    //
    // Controller-side authorisation already excludes NP callers (the new
    // CompliancePendingDocumentsController uses TenantStaffOrAdminNoNp); this
    // method tolerates the NP case by returning an empty list rather than
    // throwing, in case the route is ever reused under a different policy.
    public async Task<PendingDocumentsResponse> ListPendingAsync(Guid messageId, CancellationToken ct = default)
    {
        var scope = await scopeResolver.ResolveAsync();

        // Staff/admin scope = whole tenant; NP scope = limited to own agent.
        var npAgentId = scope.IsAdmin ? (int?)null : scope.NpAgentId;

        var items = await Context.TucAgentDocuments
            .AsNoTracking()
            .Where(d => d.IsActive && d.VerifyStatus == "Pending")
            .Where(d => npAgentId == null || d.AgentId == npAgentId)
            .Join(
                Context.TucAgents.AsNoTracking(),
                d => d.AgentId,
                a => a.UcagId,
                (d, a) => new { d, a })
            .OrderByDescending(x => x.d.AiSuggestedDecision == "accept")
            .ThenBy(x => x.d.UploadedDate)
            .Select(x => new PendingDocumentItemDto
            {
                Id = x.d.UcadId,
                AgentId = x.d.AgentId,
                DocumentTypeId = x.d.DocumentTypeId,
                DocumentTypeName = x.d.DocumentType != null ? (x.d.DocumentType.Name ?? string.Empty) : string.Empty,
                FileName = x.d.FileName ?? string.Empty,
                ContentType = x.d.ContentType ?? string.Empty,
                Length = x.d.Length,
                UploadedDate = x.d.UploadedDate,
                UploadedBy = x.d.UploadedBy ?? string.Empty,
                VerifyStatus = x.d.VerifyStatus ?? "Pending",
                VerifiedDate = x.d.VerifiedDate,
                VerifiedBy = x.d.VerifiedBy ?? string.Empty,
                RejectReason = x.d.RejectReason ?? string.Empty,
                ExpiryDate = x.d.ExpiryDate,
                AiSuggestedDecision = x.d.AiSuggestedDecision,
                AiSuggestedExpiry = x.d.AiSuggestedExpiry,
                AiRationale = x.d.AiRationale,
                IsActive = x.d.IsActive,
                SubjectType = "Agent",
                SubjectId = x.a.UcagId,
                SubjectName = x.a.UcagName ?? string.Empty,
                // Match TenantAgentService.AgentDtoProjection (lines 640–641):
                // city is on the linked tucSuburb; state lives in AddressLine6.
                SubjectCity = x.a.UcagSuburb != null
                    ? (x.a.UcagSuburb.City ?? x.a.UcagSuburb.UcsuName)
                    : null,
                SubjectState = x.a.AddressLine6,
            })
            .ToListAsync(ct);

        return new PendingDocumentsResponse(messageId) { Success = true, Items = items };
    }

    // ─── UPLOAD ──────────────────────────────────────────────────────────

    public async Task<AgentDocumentResponse> CreateAsync(
        int agentId,
        int documentTypeId,
        Stream content,
        string fileName,
        string contentType,
        long length,
        DateTime? expiryDate,
        Guid messageId,
        CancellationToken ct = default)
    {
        if (content is null || length <= 0)         return Fail(messageId, "Empty file upload.");
        if (string.IsNullOrWhiteSpace(fileName))    return Fail(messageId, "FileName is required.");
        if (string.IsNullOrWhiteSpace(contentType)) contentType = "application/octet-stream";

        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return Fail(messageId, "No NP scope configured for this user.");
        }

        if (!await CanAccessAgentAsync(agentId, scope, ct))
        {
            return Fail(messageId, "Agent not found or outside your scope.");
        }

        // Confirm the DocumentType exists and is active.
        var docType = await Context.DocumentTypes.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == documentTypeId, ct);
        if (docType is null || !docType.IsActive)
        {
            return Fail(messageId, "Document type not found or inactive.");
        }

        // S3 object key: tenant prefix for isolation, per-agent folder for
        // browsability, UUID to prevent collisions + make keys unguessable.
        var tenantId = ResolveTenantId();
        var ext = NormaliseExtension(Path.GetExtension(fileName));
        var key = $"tenant-{tenantId}/agent/{agentId}/{Guid.NewGuid():N}{ext}";

        try
        {
            await storage.PutAsync(content, key, contentType, ct);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "S3 PUT failed for agent {AgentId} document upload (key {Key})", agentId, key);
            return Fail(messageId, "Upload to storage failed. The document was not saved.");
        }

        var actor = ResolveActor();
        var row = new TucAgentDocument
        {
            AgentId = agentId,
            DocumentTypeId = documentTypeId,
            S3Key = key,
            FileName = fileName,
            ContentType = contentType,
            Length = length,
            UploadedDate = DateTime.UtcNow,
            UploadedBy = actor,
            VerifyStatus = "Pending",
            ExpiryDate = expiryDate.HasValue ? DateOnly.FromDateTime(expiryDate.Value) : (DateOnly?)null,
            IsActive = true,
            CreatedDate = DateTime.UtcNow,
        };

        Context.TucAgentDocuments.Add(row);

        try
        {
            await Context.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            // Best-effort cleanup: remove the orphaned S3 object.
            Log.Error(ex, "DB insert failed after S3 PUT — attempting compensating delete of S3 key {Key}", key);
            try { await storage.DeleteAsync(key, ct); }
            catch (Exception cleanupEx)
            {
                Log.Warning(cleanupEx, "Compensating S3 DELETE also failed for key {Key} — orphan object left in bucket", key);
            }
            return Fail(messageId, "Could not save document metadata.");
        }

        // Advisory AI review (Phase 3) — runs post-save and writes an expiry +
        // accept/reject SUGGESTION onto the row's Ai* columns (never changes
        // VerifyStatus). Guarded + no-op without an API key, so an AI problem can
        // never fail the upload. Inline so the suggestion is in the response.
        try { await aiReviewer.ReviewAsync(row.UcadId, ct); }
        catch (Exception ex) { Log.Warning(ex, "AI review threw for agent document {Id} — continuing.", row.UcadId); }

        return await ReadByIdAsync(row.UcadId, messageId, ct);
    }

    // ─── VERIFY / REJECT / SOFT DELETE ───────────────────────────────────

    public async Task<AgentDocumentResponse> VerifyAsync(int id, Guid messageId, CancellationToken ct = default)
    {
        var (doc, fail) = await LoadForMutationAsync(id, messageId, ct);
        if (fail is not null) return fail;

        doc!.VerifyStatus = "Verified";
        doc.VerifiedDate = DateTime.UtcNow;
        doc.VerifiedBy = ResolveActor();
        doc.RejectReason = null;
        // Staff-confirmed verify accepts the AI-extracted expiry when none was
        // entered at upload — saves manual entry. Explicit expiry is left as-is.
        if (doc.ExpiryDate is null && doc.AiSuggestedExpiry is not null)
        {
            doc.ExpiryDate = doc.AiSuggestedExpiry;
        }
        doc.ModifiedDate = DateTime.UtcNow;
        await Context.SaveChangesAsync(ct);

        return await ReadByIdAsync(id, messageId, ct);
    }

    public async Task<AgentDocumentResponse> RejectAsync(int id, string reason, Guid messageId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            return Fail(messageId, "Reject reason is required.");
        }

        var (doc, fail) = await LoadForMutationAsync(id, messageId, ct);
        if (fail is not null) return fail;

        doc!.VerifyStatus = "Rejected";
        doc.VerifiedDate = DateTime.UtcNow;
        doc.VerifiedBy = ResolveActor();
        doc.RejectReason = reason.Trim();
        doc.ModifiedDate = DateTime.UtcNow;
        await Context.SaveChangesAsync(ct);

        return await ReadByIdAsync(id, messageId, ct);
    }

    public async Task<AgentDocumentResponse> SoftDeleteAsync(int id, Guid messageId, CancellationToken ct = default)
    {
        var (doc, fail) = await LoadForMutationAsync(id, messageId, ct);
        if (fail is not null) return fail;

        doc!.IsActive = false;
        doc.ModifiedDate = DateTime.UtcNow;
        await Context.SaveChangesAsync(ct);

        // S3 object intentionally NOT deleted on soft-delete (recoverable).
        return await ReadByIdAsync(id, messageId, ct);
    }

    // ─── DOWNLOAD (proxy) ────────────────────────────────────────────────

    public async Task<AgentDocumentDownloadResult?> GetForDownloadAsync(int id, CancellationToken ct = default)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null) return null;

        var query = Context.TucAgentDocuments.AsNoTracking().Where(d => d.UcadId == id && d.IsActive);
        if (!scope.IsAdmin)
            query = query.Where(d => d.AgentId == scope.NpAgentId);

        var doc = await query.FirstOrDefaultAsync(ct);
        if (doc is null) return null;

        var s3 = await storage.GetAsync(doc.S3Key, ct);
        if (s3 is null)
        {
            Log.Warning("S3 object missing for TucAgentDocument {Id} (key {Key})", doc.UcadId, doc.S3Key);
            return null;
        }

        return new AgentDocumentDownloadResult(s3.Content, doc.ContentType, doc.FileName, doc.Length);
    }

    // ─── HELPERS ─────────────────────────────────────────────────────────

    private async Task<(TucAgentDocument? doc, AgentDocumentResponse? fail)> LoadForMutationAsync(int id, Guid messageId, CancellationToken ct)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return (null, Fail(messageId, "No NP scope configured for this user."));
        }

        var query = Context.TucAgentDocuments.Where(d => d.UcadId == id && d.IsActive);
        if (!scope.IsAdmin)
            query = query.Where(d => d.AgentId == scope.NpAgentId);

        var doc = await query.FirstOrDefaultAsync(ct);
        if (doc is null)
        {
            return (null, Fail(messageId, "Document not found or outside your scope."));
        }

        return (doc, null);
    }

    private async Task<bool> CanAccessAgentAsync(int agentId, NpScope scope, CancellationToken ct)
    {
        if (scope.IsAdmin)
        {
            return await Context.TucAgents.AnyAsync(a => a.UcagId == agentId, ct);
        }

        // NP user: only their own agent record.
        return agentId == scope.NpAgentId
            && await Context.TucAgents.AnyAsync(a => a.UcagId == agentId, ct);
    }

    private async Task<AgentDocumentResponse> ReadByIdAsync(int id, Guid messageId, CancellationToken ct)
    {
        var scope = await scopeResolver.ResolveAsync();
        var query = Context.TucAgentDocuments.AsNoTracking().Where(d => d.UcadId == id);
        if (!scope.IsAdmin)
            query = query.Where(d => d.AgentId == scope.NpAgentId);

        var dto = await query.Select(ProjectToDto).FirstOrDefaultAsync(ct);
        return new AgentDocumentResponse(messageId) { Success = dto is not null, Document = dto };
    }

    // Shared projection so list/read produce identical shapes.
    private static readonly Expression<Func<TucAgentDocument, AgentDocumentDto>> ProjectToDto =
        d => new AgentDocumentDto
        {
            Id = d.UcadId,
            AgentId = d.AgentId,
            DocumentTypeId = d.DocumentTypeId,
            DocumentTypeName = d.DocumentType != null ? (d.DocumentType.Name ?? string.Empty) : string.Empty,
            FileName = d.FileName ?? string.Empty,
            ContentType = d.ContentType ?? string.Empty,
            Length = d.Length,
            UploadedDate = d.UploadedDate,
            UploadedBy = d.UploadedBy ?? string.Empty,
            VerifyStatus = d.VerifyStatus ?? "Pending",
            VerifiedDate = d.VerifiedDate,
            VerifiedBy = d.VerifiedBy ?? string.Empty,
            RejectReason = d.RejectReason ?? string.Empty,
            ExpiryDate = d.ExpiryDate,
            AiSuggestedDecision = d.AiSuggestedDecision,
            AiSuggestedExpiry = d.AiSuggestedExpiry,
            AiRationale = d.AiRationale,
            IsActive = d.IsActive,
        };

    private string ResolveActor() =>
        httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
        ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
        ?? "system";

    private string ResolveTenantId() =>
        httpContextAccessor.HttpContext?.User.FindFirst("CurrentTenantID")?.Value
        ?? "unknown";

    private static string NormaliseExtension(string? ext)
    {
        if (string.IsNullOrWhiteSpace(ext)) return string.Empty;
        ext = ext.Trim();
        if (!ext.StartsWith(".")) ext = "." + ext;
        var clean = new string(ext.Where(c => c == '.' || char.IsLetterOrDigit(c)).ToArray());
        return clean.Length > 10 ? clean.Substring(0, 10) : clean;
    }

    private static AgentDocumentResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
    };

    private static AgentDocumentsResponse FailList(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
    };
}

/// <summary>
/// Output of <see cref="AgentDocumentService.GetForDownloadAsync"/>. Content is
/// the live S3 response stream — ASP.NET Core's File() helper disposes it after
/// streaming to the client.
/// </summary>
public sealed record AgentDocumentDownloadResult(
    Stream Content,
    string ContentType,
    string FileName,
    long Length);
