using System;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Courier;

/// <summary>
/// Courier Portal (finish-line P0) — one row of the courier's own documents
/// checklist. Mirrors the applicant-portal <c>PortalDocumentItemDto</c> shape:
/// every courier-applicable <c>DocumentType</c> is a row, with a status that's
/// <c>Missing</c> until the courier uploads against it.
///
/// The internal AI advisory fields (decision / rationale / model) are
/// deliberately NOT exposed here — they're staff-only review aids surfaced on
/// the NP/Tenant courier-doc surfaces, not to the courier themselves. The
/// courier sees only the human-facing lifecycle: verify status, reject reason,
/// and expiry.
/// </summary>
public class CourierPortalDocumentItemDto
{
    public int DocumentTypeId { get; set; }
    public string DocumentTypeName { get; set; } = string.Empty;
    public string? Instructions { get; set; }
    public bool Mandatory { get; set; }
    public bool HasExpiry { get; set; }

    // Missing | Pending | Verified | Rejected
    public string Status { get; set; } = "Missing";

    public int? DocumentId { get; set; }
    public string? FileName { get; set; }
    public DateTime? UploadedDate { get; set; }

    // ISO date string ("2026-05-21"); null when no expiry recorded.
    public string? ExpiryDate { get; set; }
    public string? RejectReason { get; set; }
}
