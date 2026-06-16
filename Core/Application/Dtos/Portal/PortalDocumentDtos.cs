using System;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Portal;

// Courier Portal P3 — applicant self-service documents. The applicant sees the
// required document types + their own upload status. They do NOT see the AI
// advisory (that's a staff-side review aid) — only their verify status + any
// reject reason so they know what to re-upload.

public class PortalDocumentItemDto
{
    public int DocumentTypeId { get; set; }
    public string DocumentTypeName { get; set; }
    public string Instructions { get; set; }
    public bool Mandatory { get; set; }
    public bool HasExpiry { get; set; }

    // Missing | Pending | Verified | Rejected
    public string Status { get; set; } = "Missing";
    public int? DocumentId { get; set; }          // the uploaded CourierDocument id, when present
    public string FileName { get; set; }
    public DateTime? UploadedDate { get; set; }
    public string ExpiryDate { get; set; }        // ISO yyyy-MM-dd
    public string RejectReason { get; set; }
}
