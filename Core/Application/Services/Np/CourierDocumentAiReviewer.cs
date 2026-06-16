using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Common;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// P3 — advisory AI review of an uploaded CourierDocument (applicant or courier).
// Mirrors AgentDocumentAiReviewer but persists onto CourierDocuments. The shared
// DocumentAiReviewClient does the Anthropic call; this just loads the bytes from
// S3 and records the suggestion (Ai* columns). Never touches VerifyStatus — staff
// still decide. All failures swallowed + logged; an AI problem never fails upload.
public interface ICourierDocumentAiReviewer
{
    Task ReviewAsync(int courierDocumentId, CancellationToken ct = default);
}

public class CourierDocumentAiReviewer(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IS3StorageService storage,
    IDocumentAiReviewClient ai) : BaseService(contextFactory), ICourierDocumentAiReviewer
{
    public async Task ReviewAsync(int courierDocumentId, CancellationToken ct = default)
    {
        var doc = await Context.CourierDocuments
            .Include(d => d.DocumentType)
            .FirstOrDefaultAsync(d => d.Id == courierDocumentId, ct);
        if (doc is null) return;

        var s3 = await storage.GetAsync(doc.S3key, ct);
        if (s3 is null)
        {
            Log.Warning("AI review skipped for courier document {Id} — S3 object missing (key {Key}).", courierDocumentId, doc.S3key);
            return;
        }

        byte[] bytes;
        await using (s3.Content)
        using (var ms = new MemoryStream())
        {
            await s3.Content.CopyToAsync(ms, ct);
            bytes = ms.ToArray();
        }

        var result = await ai.ReviewAsync(bytes, doc.ContentType, doc.DocumentType?.Name ?? "document", doc.DocumentType?.ReviewCriteria, ct);
        if (result is null) return;

        doc.AiSuggestedDecision = result.Decision;
        doc.AiSuggestedExpiry = result.Expiry;
        doc.AiRationale = result.Rationale;
        doc.AiModel = result.Model;
        doc.AiReviewedDate = DateTime.UtcNow;
        doc.ModifiedDate = DateTime.UtcNow;

        try
        {
            await Context.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to persist AI review for courier document {Id}.", courierDocumentId);
        }
    }
}
