using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// STEVE-COMPLIANCE-MONITORING-REDESIGN-2026-06-13 — flat list of every uploaded
// business document whose VerifyStatus = 'Pending' across the calling tenant's
// scope. Powers the new Compliance Monitoring "Documents waiting on your
// review" action queue. Tenant-staff / DF-admin only (TenantStaffOrAdminNoNp).
//
// Mirrors the field shape of AgentDocumentDto on purpose so the front-end can
// reuse the existing AgentDocumentPreviewModal without reshaping — the only
// additions are the SubjectType / SubjectName / SubjectCity / SubjectState
// columns that let the queue render the row's subject without a follow-up
// lookup against the agents directory.

public class PendingDocumentItemDto
{
    // -- Document identity (mirrors AgentDocumentDto) --
    public int Id { get; set; }
    public int AgentId { get; set; }
    public int DocumentTypeId { get; set; }
    public string DocumentTypeName { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Length { get; set; }
    public DateTime UploadedDate { get; set; }
    public string UploadedBy { get; set; } = string.Empty;
    public string VerifyStatus { get; set; } = "Pending";
    public DateTime? VerifiedDate { get; set; }
    public string VerifiedBy { get; set; } = string.Empty;
    public string RejectReason { get; set; } = string.Empty;
    public DateOnly? ExpiryDate { get; set; }
    public string? AiSuggestedDecision { get; set; }
    public DateOnly? AiSuggestedExpiry { get; set; }
    public string? AiRationale { get; set; }
    public bool IsActive { get; set; }

    // -- Subject context for the queue rendering --
    // SubjectType is "Agent" today; reserved "Driver" once courier-side pending
    // docs are wired (per GARRY-NP-COURIER-DATA-WIRING-2026-06-13.md §1).
    public string SubjectType { get; set; } = "Agent";
    public int SubjectId { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public string? SubjectCity { get; set; }
    public string? SubjectState { get; set; }
}

public class PendingDocumentsResponse : BaseResponse
{
    public PendingDocumentsResponse(Guid messageId) : base(messageId) { }
    public IReadOnlyList<PendingDocumentItemDto> Items { get; set; } = Array.Empty<PendingDocumentItemDto>();
}
