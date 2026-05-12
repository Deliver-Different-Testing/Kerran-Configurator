using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// What an NP-portal carrier sees in their inbox of pending quote invitations.
// Combines the tenant's posting headline with the carrier's specific quote
// row (the message they were sent and when they were invited). Only Requested
// status surfaces here — once submitted/awarded/declined/expired it drops out
// of this list.
public class NpPendingInviteDto
{
    public int QuoteId { get; set; }
    public int PostingId { get; set; }
    public string PostingTitle { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public string ServiceType { get; set; } = string.Empty;
    public int VolumePerWeek { get; set; }
    public string StartDate { get; set; } = string.Empty;       // YYYY-MM-DD or empty
    public string EndDate { get; set; } = string.Empty;
    public bool IsOngoing { get; set; }
    public string Description { get; set; } = string.Empty;
    public string TenantMessage { get; set; } = string.Empty;   // Free-text invite message from tenant
    public string RequestedDate { get; set; } = string.Empty;   // ISO 8601 UTC
}

public class NpPendingInvitesResponse : BaseResponse
{
    public NpPendingInvitesResponse(Guid messageId) : base(messageId) { }
    public List<NpPendingInviteDto> Invites { get; set; } = new();
}

// Carrier's response payload. Same shape as TenantQuoteSubmitDto on the
// tenant lane — duplicated here so the NP controller doesn't take a
// cross-lane dependency on the Tenant DTO namespace.
public class NpQuoteSubmitDto
{
    public decimal ProposedRate { get; set; }
    public string? RateType { get; set; }
    public string? Message { get; set; }
    public int? AvailableFleetSize { get; set; }
    public string? AvailableStartDate { get; set; }   // YYYY-MM-DD
}
