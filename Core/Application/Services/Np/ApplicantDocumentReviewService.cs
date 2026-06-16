using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Common;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// P3 (Slice B2) — staff/NP review of an APPLICANT's documents (the same unified
// CourierDocuments rows the applicant uploaded via the portal, keyed by
// ApplicantId). Reviewers see the AI advisory + Verify/Reject. No NP-agent scope
// (recruitment is tenant-wide); access is gated by the controller policy.
public class ApplicantDocumentReviewService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IS3StorageService storage,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    public async Task<List<CourierDocumentDto>> ListAsync(int applicantId, CancellationToken ct = default) =>
        await Context.CourierDocuments.AsNoTracking()
            .Where(d => d.ApplicantId == applicantId && d.IsActive)
            .OrderByDescending(d => d.UploadedDate)
            .Select(ProjectToDto)
            .ToListAsync(ct);

    public async Task<CourierDocumentDto?> VerifyAsync(int docId, CancellationToken ct = default)
    {
        var doc = await LoadApplicantDocAsync(docId, ct);
        if (doc is null) return null;

        doc.VerifyStatus = "Verified";
        doc.VerifiedDate = DateTime.UtcNow;
        doc.VerifiedBy = ResolveActor();
        doc.RejectReason = null;
        if (doc.ExpiryDate is null && doc.AiSuggestedExpiry is not null) doc.ExpiryDate = doc.AiSuggestedExpiry;
        doc.ModifiedDate = DateTime.UtcNow;
        await Context.SaveChangesAsync(ct);
        return await ReadAsync(docId, ct);
    }

    public async Task<CourierDocumentDto?> RejectAsync(int docId, string reason, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reason)) reason = "Rejected";
        var doc = await LoadApplicantDocAsync(docId, ct);
        if (doc is null) return null;

        doc.VerifyStatus = "Rejected";
        doc.VerifiedDate = DateTime.UtcNow;
        doc.VerifiedBy = ResolveActor();
        doc.RejectReason = reason.Trim();
        doc.ModifiedDate = DateTime.UtcNow;
        await Context.SaveChangesAsync(ct);
        return await ReadAsync(docId, ct);
    }

    public async Task<CourierDocumentDownloadResult?> GetForDownloadAsync(int docId, CancellationToken ct = default)
    {
        var doc = await Context.CourierDocuments.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == docId && d.ApplicantId != null && d.IsActive, ct);
        if (doc is null) return null;
        var s3 = await storage.GetAsync(doc.S3key, ct);
        if (s3 is null) return null;
        return new CourierDocumentDownloadResult(s3.Content, doc.ContentType, doc.FileName, doc.Length);
    }

    private async Task<CourierDocument?> LoadApplicantDocAsync(int docId, CancellationToken ct) =>
        await Context.CourierDocuments.FirstOrDefaultAsync(d => d.Id == docId && d.ApplicantId != null && d.IsActive, ct);

    private async Task<CourierDocumentDto?> ReadAsync(int docId, CancellationToken ct) =>
        await Context.CourierDocuments.AsNoTracking().Where(d => d.Id == docId).Select(ProjectToDto).FirstOrDefaultAsync(ct);

    private string ResolveActor() =>
        httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
        ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
        ?? "system";

    private static readonly Expression<Func<CourierDocument, CourierDocumentDto>> ProjectToDto = d => new CourierDocumentDto
    {
        Id = d.Id,
        CourierId = d.CourierId,
        ApplicantId = d.ApplicantId,
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
        AiSuggestedDecision = d.AiSuggestedDecision,
        AiSuggestedExpiry = d.AiSuggestedExpiry,
        AiRationale = d.AiRationale,
        AiModel = d.AiModel,
        AiReviewedDate = d.AiReviewedDate,
    };
}
