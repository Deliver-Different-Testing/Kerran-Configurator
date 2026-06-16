using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Portal;
using DfrntDriveConfigurator.Core.Application.Services.Common;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Portal;

// Courier Portal P3 (Slice B) — applicant self-service document upload. Writes to
// the UNIFIED CourierDocuments table with ApplicantId set (CourierId null), so on
// approval the rows carry forward to the courier by stamping CourierId (P4). Each
// upload is AI-vetted via the shared CourierDocumentAiReviewer (same as courier
// docs). The applicant is identified by the signed portal token (applicantId from
// the controller); they only ever touch their own rows.
public class PortalApplicantDocumentService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IS3StorageService storage,
    ICourierDocumentAiReviewer aiReviewer,
    IPortalTenantContext portalTenant)
{
    public async Task<List<PortalDocumentItemDto>> GetMyDocumentsAsync(int applicantId, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        var types = await ctx.DocumentTypes.AsNoTracking()
            .Where(t => t.IsActive && (t.AppliesTo == "Applicant" || t.AppliesTo == "Both" || t.AppliesTo == "All"))
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Name)
            .ToListAsync(ct);

        var docs = await ctx.CourierDocuments.AsNoTracking()
            .Where(d => d.ApplicantId == applicantId && d.IsActive)
            .OrderByDescending(d => d.UploadedDate)
            .ToListAsync(ct);

        return types.Select(t =>
        {
            var doc = docs.FirstOrDefault(d => d.DocumentTypeId == t.Id);
            return new PortalDocumentItemDto
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
        }).ToList();
    }

    public async Task<List<PortalDocumentItemDto>> UploadAsync(
        int applicantId, int documentTypeId, Stream content, string fileName, string contentType, long length, CancellationToken ct)
    {
        if (content is null || length <= 0) throw new PortalException("Empty file upload.");
        if (string.IsNullOrWhiteSpace(fileName)) throw new PortalException("A file is required.");
        if (string.IsNullOrWhiteSpace(contentType)) contentType = "application/octet-stream";

        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        var type = await ctx.DocumentTypes.AsNoTracking().FirstOrDefaultAsync(t => t.Id == documentTypeId, ct);
        if (type is null || !type.IsActive || !(type.AppliesTo is "Applicant" or "Both" or "All"))
            throw new PortalException("That document type can't be uploaded here.");

        var tenantId = portalTenant.TenantId;
        var ext = NormaliseExtension(Path.GetExtension(fileName));
        var key = $"tenant-{tenantId}/applicant/{applicantId}/{Guid.NewGuid():N}{ext}";

        try
        {
            await storage.PutAsync(content, key, contentType, ct);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "S3 PUT failed for applicant {ApplicantId} document upload (key {Key})", applicantId, key);
            throw new PortalException("Upload failed. Please try again.");
        }

        // Supersede any prior active upload of the same type (re-upload replaces).
        var prior = await ctx.CourierDocuments
            .Where(d => d.ApplicantId == applicantId && d.DocumentTypeId == documentTypeId && d.IsActive)
            .ToListAsync(ct);
        foreach (var p in prior) { p.IsActive = false; p.ModifiedDate = DateTime.UtcNow; }

        var now = DateTime.UtcNow;
        var row = new CourierDocument
        {
            ApplicantId = applicantId,
            CourierId = null,
            DocumentTypeId = documentTypeId,
            S3key = key,
            FileName = fileName,
            ContentType = contentType,
            Length = length,
            UploadedDate = now,
            UploadedBy = $"applicant:{applicantId}",
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
            Log.Error(ex, "DB insert failed after S3 PUT for applicant document — compensating S3 delete of {Key}", key);
            try { await storage.DeleteAsync(key, ct); } catch { /* best-effort */ }
            throw new PortalException("Could not save your document.");
        }

        // Advisory AI review (swallows its own failures; never breaks the upload).
        try { await aiReviewer.ReviewAsync(row.Id, ct); }
        catch (Exception ex) { Log.Warning(ex, "AI review failed for applicant document {Id}", row.Id); }

        return await GetMyDocumentsAsync(applicantId, ct);
    }

    public async Task<PortalDocumentDownloadResult?> GetForDownloadAsync(int applicantId, int docId, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var doc = await ctx.CourierDocuments.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == docId && d.ApplicantId == applicantId && d.IsActive, ct);
        if (doc is null) return null;

        var s3 = await storage.GetAsync(doc.S3key, ct);
        if (s3 is null) return null;

        return new PortalDocumentDownloadResult(s3.Content, doc.ContentType, doc.FileName, doc.Length);
    }

    private static string NormaliseExtension(string? ext)
    {
        if (string.IsNullOrWhiteSpace(ext)) return string.Empty;
        ext = ext.Trim();
        if (!ext.StartsWith(".")) ext = "." + ext;
        var clean = new string(ext.Where(c => c == '.' || char.IsLetterOrDigit(c)).ToArray());
        return clean.Length > 10 ? clean.Substring(0, 10) : clean;
    }
}

public sealed record PortalDocumentDownloadResult(Stream Content, string ContentType, string FileName, long Length);
