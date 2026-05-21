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
/// CRUD for compliance / training document instances against a courier.
/// File bytes live in S3 (via <see cref="IS3StorageService"/>); this service
/// owns the DB-side metadata + lifecycle (verify / reject / soft-delete) and
/// orchestrates S3 puts on upload.
///
/// NP scope filtering: admin sees everything; NP users only see their own
/// couriers' documents, gated via <c>tucCourier.NpAgentId == scope.NpAgentId</c>.
/// </summary>
public class CourierDocumentService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    INpScopeResolver scopeResolver,
    IS3StorageService storage,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    // ─── LIST ────────────────────────────────────────────────────────────

    public async Task<CourierDocumentsResponse> ListAsync(int courierId, Guid messageId, CancellationToken ct = default)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return FailList(messageId, "No NP scope configured for this user.");
        }

        if (!await CanAccessCourierAsync(courierId, scope, ct))
        {
            return FailList(messageId, "Courier not found or outside your scope.");
        }

        var rows = await Context.CourierDocuments
            .AsNoTracking()
            .Where(d => d.CourierId == courierId && d.IsActive)
            .OrderByDescending(d => d.UploadedDate)
            .Select(ProjectToDto)
            .ToListAsync(ct);

        return new CourierDocumentsResponse(messageId) { Success = true, Documents = rows };
    }

    // ─── UPLOAD ──────────────────────────────────────────────────────────

    public async Task<CourierDocumentResponse> CreateAsync(
        int courierId,
        int documentTypeId,
        Stream content,
        string fileName,
        string contentType,
        long length,
        DateTime? expiryDate,
        Guid messageId,
        CancellationToken ct = default)
    {
        if (content is null || length <= 0)        return Fail(messageId, "Empty file upload.");
        if (string.IsNullOrWhiteSpace(fileName))   return Fail(messageId, "FileName is required.");
        if (string.IsNullOrWhiteSpace(contentType)) contentType = "application/octet-stream";

        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return Fail(messageId, "No NP scope configured for this user.");
        }

        if (!await CanAccessCourierAsync(courierId, scope, ct))
        {
            return Fail(messageId, "Courier not found or outside your scope.");
        }

        // Confirm the DocumentType exists and is active. Avoids surprising
        // errors if a client sends a stale or soft-deleted DocumentTypeId.
        var docType = await Context.DocumentTypes.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == documentTypeId, ct);
        if (docType is null || !docType.IsActive)
        {
            return Fail(messageId, "Document type not found or inactive.");
        }

        // Generate the S3 object key. Tenant prefix gives us isolation even
        // in the shared sandbox bucket; per-courier folder makes manual S3
        // browsing tolerable; UUID prevents collision + makes the key
        // unguessable.
        var tenantId = ResolveTenantId();
        var ext = NormaliseExtension(Path.GetExtension(fileName));
        var key = $"tenant-{tenantId}/courier/{courierId}/{Guid.NewGuid():N}{ext}";

        try
        {
            await storage.PutAsync(content, key, contentType, ct);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "S3 PUT failed for courier {CourierId} document upload (key {Key})", courierId, key);
            return Fail(messageId, "Upload to storage failed. The document was not saved.");
        }

        var actor = ResolveActor();
        var row = new CourierDocument
        {
            CourierId = courierId,
            DocumentTypeId = documentTypeId,
            S3key = key,
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

        Context.CourierDocuments.Add(row);

        try
        {
            await Context.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            // Best-effort cleanup: try to remove the S3 object so we don't
            // leak a payload that has no DB pointer.
            Log.Error(ex, "DB insert failed after S3 PUT — attempting compensating delete of S3 key {Key}", key);
            try { await storage.DeleteAsync(key, ct); }
            catch (Exception cleanupEx)
            {
                Log.Warning(cleanupEx, "Compensating S3 DELETE also failed for key {Key} — orphan object left in bucket", key);
            }
            return Fail(messageId, "Could not save document metadata.");
        }

        return await ReadByIdAsync(row.Id, messageId, ct);
    }

    // ─── VERIFY / REJECT / SOFT DELETE ───────────────────────────────────

    public async Task<CourierDocumentResponse> VerifyAsync(int id, Guid messageId, CancellationToken ct = default)
    {
        var (doc, fail) = await LoadForMutationAsync(id, messageId, ct);
        if (fail is not null) return fail;

        doc!.VerifyStatus = "Verified";
        doc.VerifiedDate = DateTime.UtcNow;
        doc.VerifiedBy = ResolveActor();
        doc.RejectReason = null;
        doc.ModifiedDate = DateTime.UtcNow;
        await Context.SaveChangesAsync(ct);

        return await ReadByIdAsync(id, messageId, ct);
    }

    public async Task<CourierDocumentResponse> RejectAsync(int id, string reason, Guid messageId, CancellationToken ct = default)
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

    public async Task<CourierDocumentResponse> SoftDeleteAsync(int id, Guid messageId, CancellationToken ct = default)
    {
        var (doc, fail) = await LoadForMutationAsync(id, messageId, ct);
        if (fail is not null) return fail;

        doc!.IsActive = false;
        doc.ModifiedDate = DateTime.UtcNow;
        await Context.SaveChangesAsync(ct);

        // S3 object is intentionally NOT deleted on soft-delete. Restoring
        // a document later (e.g. via an admin tool) keeps the bytes recoverable.
        // Hard delete + S3 cleanup is a separate maintenance job.

        return await ReadByIdAsync(id, messageId, ct);
    }

    // ─── DOWNLOAD (proxy) ────────────────────────────────────────────────

    /// <summary>
    /// Returns the file bytes + minimal metadata for proxy-download. Caller
    /// (the controller) wraps in <c>File(stream, contentType, fileName)</c>;
    /// ASP.NET Core disposes the stream after streaming, which releases the
    /// underlying S3 connection. Returns null if the document is not visible
    /// to the caller (scope failure, soft-deleted, or S3 object missing).
    /// </summary>
    public async Task<CourierDocumentDownloadResult?> GetForDownloadAsync(int id, CancellationToken ct = default)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null) return null;

        var doc = await Context.CourierDocuments
            .AsNoTracking()
            .Where(d => d.Id == id && d.IsActive)
            .Where(d => scope.IsAdmin
                || Context.TucCouriers.Any(c => c.UccrId == d.CourierId && c.NpAgentId == scope.NpAgentId))
            .FirstOrDefaultAsync(ct);

        if (doc is null) return null;

        var s3 = await storage.GetAsync(doc.S3key, ct);
        if (s3 is null)
        {
            Log.Warning("S3 object missing for CourierDocument {Id} (key {Key})", doc.Id, doc.S3key);
            return null;
        }

        return new CourierDocumentDownloadResult(
            s3.Content,
            doc.ContentType,
            doc.FileName,
            doc.Length);
    }

    // ─── HELPERS ─────────────────────────────────────────────────────────

    private async Task<(CourierDocument? doc, CourierDocumentResponse? fail)> LoadForMutationAsync(int id, Guid messageId, CancellationToken ct)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return (null, Fail(messageId, "No NP scope configured for this user."));
        }

        var query = Context.CourierDocuments.Where(d => d.Id == id && d.IsActive);
        if (!scope.IsAdmin)
        {
            query = query.Where(d => Context.TucCouriers.Any(
                c => c.UccrId == d.CourierId && c.NpAgentId == scope.NpAgentId));
        }

        var doc = await query.FirstOrDefaultAsync(ct);
        if (doc is null)
        {
            return (null, Fail(messageId, "Document not found or outside your scope."));
        }

        return (doc, null);
    }

    private async Task<bool> CanAccessCourierAsync(int courierId, NpScope scope, CancellationToken ct)
    {
        if (scope.IsAdmin)
        {
            return await Context.TucCouriers.AnyAsync(c => c.UccrId == courierId, ct);
        }

        return await Context.TucCouriers
            .AnyAsync(c => c.UccrId == courierId && c.NpAgentId == scope.NpAgentId, ct);
    }

    private async Task<CourierDocumentResponse> ReadByIdAsync(int id, Guid messageId, CancellationToken ct)
    {
        // Use the same projection + scope as the rest of the methods so a
        // freshly-saved row is read back through identical access rules.
        var scope = await scopeResolver.ResolveAsync();
        var query = Context.CourierDocuments.AsNoTracking().Where(d => d.Id == id);
        if (!scope.IsAdmin)
        {
            query = query.Where(d => Context.TucCouriers.Any(
                c => c.UccrId == d.CourierId && c.NpAgentId == scope.NpAgentId));
        }
        var dto = await query.Select(ProjectToDto).FirstOrDefaultAsync(ct);
        return new CourierDocumentResponse(messageId) { Success = dto is not null, Document = dto };
    }

    // Shared projection so list/read produce identical shapes. Joins to
    // DocumentTypes for the display name.
    private static readonly Expression<Func<CourierDocument, CourierDocumentDto>> ProjectToDto =
        d => new CourierDocumentDto
        {
            Id = d.Id,
            CourierId = d.CourierId,
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
        // strip any weird characters; keep alnum + dot
        var clean = new string(ext.Where(c => c == '.' || char.IsLetterOrDigit(c)).ToArray());
        return clean.Length > 10 ? clean.Substring(0, 10) : clean;
    }

    private static CourierDocumentResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
    };

    private static CourierDocumentsResponse FailList(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
    };
}

/// <summary>
/// Output of <see cref="CourierDocumentService.GetForDownloadAsync"/>.
/// Content is the live S3 response stream — ASP.NET Core's File() helper
/// disposes it after streaming to the client.
/// </summary>
public sealed record CourierDocumentDownloadResult(
    Stream Content,
    string ContentType,
    string FileName,
    long Length);
