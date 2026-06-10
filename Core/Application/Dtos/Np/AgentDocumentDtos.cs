using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

/// <summary>
/// Read-side shape for a single agent / NP business-document instance. Mirrors
/// <see cref="CourierDocumentDto"/>. The S3 key is intentionally NOT exposed —
/// the frontend fetches bytes via the /download proxy.
/// </summary>
public class AgentDocumentDto
{
    public int Id { get; set; }                 // UcadId
    public int AgentId { get; set; }
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

    public DateOnly? ExpiryDate { get; set; }

    // Phase 3 — advisory AI review (null until populated).
    public string? AiSuggestedDecision { get; set; }       // accept|reject|needs_review
    public DateOnly? AiSuggestedExpiry { get; set; }
    public string? AiRationale { get; set; }

    public bool IsActive { get; set; }
}

/// <summary>Body for the reject action — carries the human-readable reason.</summary>
public class AgentDocumentRejectDto
{
    public string Reason { get; set; } = string.Empty;
}

public class AgentDocumentResponse : BaseResponse
{
    public AgentDocumentResponse(Guid messageId) : base(messageId) { }
    public AgentDocumentDto? Document { get; set; }
}

public class AgentDocumentsResponse : BaseResponse
{
    public AgentDocumentsResponse(Guid messageId) : base(messageId) { }
    public List<AgentDocumentDto> Documents { get; set; } = new();
}
