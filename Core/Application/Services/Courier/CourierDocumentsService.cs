using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Courier;
using DfrntDriveConfigurator.Core.Application.Services.Common;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Courier;

/// <summary>
/// Courier Portal (finish-line P0) — courier self-service documents.
///
/// This is the courier-facing entry point onto the SAME document domain the
/// staff NP/Tenant surfaces use: it writes to the unified <c>CourierDocuments</c>
/// table, stores bytes in the same S3 path, and runs the same advisory
/// <see cref="ICourierDocumentAiReviewer"/> on upload. We do NOT introduce a
/// second store — staff verify/reject these rows from their existing surface
/// and the courier sees the result here.
///
/// Scope: the current courier is resolved by <see cref="ICourierScopeResolver"/>
/// (Hub cookie OR magic-link portal token); a courier can only ever see/upload
/// against their own row. Lifecycle (verify/reject) is staff-only and is NOT
/// exposed here. Closely mirrors <c>PortalApplicantDocumentService</c>, which
/// does the same for the applicant side.
/// </summary>
public class CourierDocumentsService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    ICourierScopeResolver scopeResolver,
    IS3StorageService storage,
    ICourierDocumentAiReviewer aiReviewer,
    IHttpContextAccessor httpContextAccessor)
{
    // ─── LIST (required-docs checklist) ──────────────────────────────────

    public async Task<List<CourierPortalDocumentItemDto>> GetMyDocumentsAsync(CancellationToken ct)
    {
        var scope = await Require(ct);
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        var types = await ctx.DocumentTypes.AsNoTracking()
            .Where(t => t.IsActive && (t.AppliesTo == "Courier" || t.AppliesTo == "Both" || t.AppliesTo == "All"))
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Name)
            .ToListAsync(ct);

        var docs = await ctx.CourierDocuments.AsNoTracking()
            .Where(d => d.CourierId == scope.CourierId && d.IsActive)
            .OrderByDescending(d => d.UploadedDate)
            .ToListAsync(ct);

        return types.Select(t => Project(t, docs.FirstOrDefault(d => d.DocumentTypeId == t.Id))).ToList();
    }

    // ─── UPLOAD (re-upload supersedes the prior active row) ──────────────

    public async Task<List<CourierPortalDocumentItemDto>> UploadAsync(
        int documentTypeId, Stream content, string fileName, string contentType, long length, CancellationToken ct)
    {
        if (content is null || length <= 0) throw new CourierPortalException("Empty file upload.");
        if (string.IsNullOrWhiteSpace(fileName)) throw new CourierPortalException("A file is required.");
        if (string.IsNullOrWhiteSpace(contentType)) contentType = "application/octet-stream";

        var scope = await Require(ct);
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        var type = await ctx.DocumentTypes.AsNoTracking().FirstOrDefaultAsync(t => t.Id == documentTypeId, ct);
        if (type is null || !type.IsActive || !(type.AppliesTo is "Courier" or "Both" or "All"))
            throw new CourierPortalException("That document type can't be uploaded here.");

        var tenantId = ResolveTenantId();
        var ext = NormaliseExtension(Path.GetExtension(fileName));
        var key = $"tenant-{tenantId}/courier/{scope.CourierId}/{Guid.NewGuid():N}{ext}";

        try
        {
            await storage.PutAsync(content, key, contentType, ct);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "S3 PUT failed for courier {CourierId} portal document upload (key {Key})", scope.CourierId, key);
            throw new CourierPortalException("Upload failed. Please try again.");
        }

        // Supersede any prior active upload of the same type (re-upload replaces).
        var prior = await ctx.CourierDocuments
            .Where(d => d.CourierId == scope.CourierId && d.DocumentTypeId == documentTypeId && d.IsActive)
            .ToListAsync(ct);
        foreach (var p in prior) { p.IsActive = false; p.ModifiedDate = DateTime.UtcNow; }

        var now = DateTime.UtcNow;
        var row = new CourierDocument
        {
            CourierId = scope.CourierId,
            ApplicantId = null,
            DocumentTypeId = documentTypeId,
            S3key = key,
            FileName = fileName,
            ContentType = contentType,
            Length = length,
            UploadedDate = now,
            UploadedBy = $"courier:{scope.CourierId}",
            VerifyStatus = "Pending",
            IsActive = true,
            CreatedDate = now,
        };
        ctx.CourierDocuments.Add(row);

        try
        {
            await ctx.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "DB insert failed after S3 PUT for courier document — compensating S3 delete of {Key}", key);
            try { await storage.DeleteAsync(key, ct); } catch { /* best-effort */ }
            throw new CourierPortalException("Could not save your document.");
        }

        // Advisory AI review (swallows its own failures; never breaks the upload).
        try { await aiReviewer.ReviewAsync(row.Id, ct); }
        catch (Exception ex) { Log.Warning(ex, "AI review failed for courier document {Id}", row.Id); }

        return await GetMyDocumentsAsync(ct);
    }

    // ─── DOWNLOAD (proxy; own docs only) ─────────────────────────────────

    public async Task<CourierDocumentDownloadResult?> GetForDownloadAsync(int docId, CancellationToken ct)
    {
        var scope = await Require(ct);
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        var doc = await ctx.CourierDocuments.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == docId && d.CourierId == scope.CourierId && d.IsActive, ct);
        if (doc is null) return null;

        var s3 = await storage.GetAsync(doc.S3key, ct);
        if (s3 is null)
        {
            Log.Warning("S3 object missing for courier portal document {Id} (key {Key})", doc.Id, doc.S3key);
            return null;
        }

        return new CourierDocumentDownloadResult(s3.Content, doc.ContentType, doc.FileName, doc.Length);
    }

    // ─── HELPERS ─────────────────────────────────────────────────────────

    private async Task<CourierScope> Require(CancellationToken ct)
    {
        var scope = await scopeResolver.ResolveAsync(ct);
        if (scope is null)
            throw new CourierPortalException("No active courier record is linked to your account.");
        return scope;
    }

    private static CourierPortalDocumentItemDto Project(DocumentType t, CourierDocument? doc) => new()
    {
        DocumentTypeId = t.Id,
        DocumentTypeName = t.Name ?? string.Empty,
        Instructions = t.Instructions,
        Mandatory = t.Mandatory,
        HasExpiry = t.HasExpiry,
        Status = doc?.VerifyStatus ?? "Missing",
        DocumentId = doc?.Id,
        FileName = doc?.FileName,
        UploadedDate = doc?.UploadedDate,
        ExpiryDate = doc?.ExpiryDate?.ToString("yyyy-MM-dd"),
        RejectReason = doc?.RejectReason,
    };

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
}
