using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

/// <summary>
/// Read-side shape for a single courier document instance. The S3 object key
/// is intentionally NOT exposed — it's an internal implementation detail; the
/// frontend uses /download to fetch the bytes via the API proxy.
/// </summary>
public class CourierDocumentDto
{
    public int Id { get; set; }
    // Nullable since P3: applicant-portal uploads have ApplicantId set + CourierId
    // null until approval carry-forward stamps the courier.
    public int? CourierId { get; set; }
    public int? ApplicantId { get; set; }
    public int DocumentTypeId { get; set; }
    public string DocumentTypeName { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Length { get; set; }
    public DateTime UploadedDate { get; set; }
    public string UploadedBy { get; set; } = string.Empty;

    // Verify lifecycle
    public string VerifyStatus { get; set; } = "Pending";  // Pending|Verified|Rejected
    public DateTime? VerifiedDate { get; set; }
    public string VerifiedBy { get; set; } = string.Empty;
    public string RejectReason { get; set; } = string.Empty;

    // Date-only (no time component) — matches the SQL DATE column. Serializes
    // as ISO date string ("2026-05-21") on the wire.
    public DateOnly? ExpiryDate { get; set; }
    public bool IsActive { get; set; }

    // P3 — AI advisory (populated by CourierDocumentAiReviewer; null until reviewed
    // / when ANTHROPIC_API_KEY is unset). Advisory only — staff make the final call.
    public string? AiSuggestedDecision { get; set; }   // accept|reject|needs_review
    public DateOnly? AiSuggestedExpiry { get; set; }
    public string? AiRationale { get; set; }
    public string? AiModel { get; set; }
    public DateTime? AiReviewedDate { get; set; }
}

/// <summary>
/// Body for the reject action — carries the human-readable reason.
/// </summary>
public class CourierDocumentRejectDto
{
    public string Reason { get; set; } = string.Empty;
}

public class CourierDocumentResponse : BaseResponse
{
    public CourierDocumentResponse(Guid messageId) : base(messageId) { }
    public CourierDocumentDto? Document { get; set; }
}

public class CourierDocumentsResponse : BaseResponse
{
    public CourierDocumentsResponse(Guid messageId) : base(messageId) { }
    public List<CourierDocumentDto> Documents { get; set; } = new();
}
