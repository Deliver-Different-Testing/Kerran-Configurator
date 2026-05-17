using System;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Public;

// Read-side payload for an anonymous prospect viewing their invite. Mirrors
// NpPendingInviteDto on the carrier-portal side but adds a Status field so
// the public form can render an "already submitted, you can revise" banner
// when the prospect comes back to edit. No internal IDs are leaked except
// the quoteId (which the token already encodes).
public class PublicQuoteInviteDto
{
    public int QuoteId { get; set; }
    public string Status { get; set; } = "Requested";   // Requested or Submitted only
    public string PostingTitle { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public string ServiceType { get; set; } = string.Empty;
    public int VolumePerWeek { get; set; }
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public bool IsOngoing { get; set; }
    public string Description { get; set; } = string.Empty;
    public string TenantMessage { get; set; } = string.Empty;
    public string ProspectName { get; set; } = string.Empty;   // Company name for header confirmation

    // Echo back the prospect's previous response if they're revisiting.
    // Empty fields when Status = 'Requested'.
    public decimal? ProposedRate { get; set; }
    public string? RateType { get; set; }
    public int? AvailableFleetSize { get; set; }
    public string AvailableStartDate { get; set; } = string.Empty;
    public string ResponseMessage { get; set; } = string.Empty;
}

public class PublicQuoteInviteResponse : BaseResponse
{
    public PublicQuoteInviteResponse(Guid messageId) : base(messageId) { }
    public PublicQuoteInviteDto? Invite { get; set; }
}

// Same shape as NpQuoteSubmitDto on the carrier-portal side.
public class PublicQuoteSubmitDto
{
    public decimal ProposedRate { get; set; }
    public string? RateType { get; set; }
    public string? Message { get; set; }
    public int? AvailableFleetSize { get; set; }
    public string? AvailableStartDate { get; set; }
}
