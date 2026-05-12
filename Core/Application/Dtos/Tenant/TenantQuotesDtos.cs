using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Tenant;

// Shapes match the React QuotesPosting / Quote types at
// wwwroot/app/react/types/index.ts. Fields the schema doesn't directly
// support get safe defaults at the projection layer.
public class TenantQuotePostingDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public string ServiceType { get; set; } = string.Empty;
    public int VolumePerWeek { get; set; }
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int QuoteCount { get; set; }
    public string CreatedDate { get; set; } = string.Empty;
}

public class TenantQuoteDto
{
    public int Id { get; set; }
    public int PostingId { get; set; }
    public int AgentId { get; set; }
    public string AgentName { get; set; } = string.Empty;
    public string Association { get; set; } = "None";
    public decimal PricePerJob { get; set; }
    public string? RateType { get; set; }
    public int? AvailableFleetSize { get; set; }
    public string LeadTime { get; set; } = string.Empty;
    public List<string> CoverageAreas { get; set; } = new();
    public string Notes { get; set; } = string.Empty;
    // Lifecycle audit timestamps — empty string when the state hasn't been
    // reached yet. RequestedDate is always populated (created at invite).
    public string RequestedDate { get; set; } = string.Empty;
    public string SubmittedDate { get; set; } = string.Empty;
    public string ReviewedDate { get; set; } = string.Empty;
    public string ExpiredDate { get; set; } = string.Empty;
    public string Status { get; set; } = "Requested";
}

public class TenantQuotePostingsResponse : BaseResponse
{
    public TenantQuotePostingsResponse(Guid messageId) : base(messageId) { }
    public List<TenantQuotePostingDto> Postings { get; set; } = new();
}

// Payload for POST /api/v1/tenant/quotes/postings.
public class TenantQuotePostingCreateDto
{
    public string Title { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public string ServiceType { get; set; } = string.Empty;
    public int VolumePerWeek { get; set; }
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public string? Description { get; set; }
}

public class TenantQuotePostingResponse : BaseResponse
{
    public TenantQuotePostingResponse(Guid messageId) : base(messageId) { }
    public TenantQuotePostingDto? Posting { get; set; }
}

// Payload for POST /api/v1/tenant/quotes/quote-request — invites a known
// carrier (TucAgent or ProspectAgent) to submit a quote against a posting.
public class TenantQuoteRequestCreateDto
{
    public int PostingId { get; set; }
    public int? AgentId { get; set; }              // tucAgent FK
    public int? ProspectAgentId { get; set; }      // ProspectAgent FK
    public string? Message { get; set; }
}

public class TenantQuotesResponse : BaseResponse
{
    public TenantQuotesResponse(Guid messageId) : base(messageId) { }
    public List<TenantQuoteDto> Quotes { get; set; } = new();
}

// Payload for PUT /api/v1/tenant/quotes/{quoteId}/submit — carrier's quote
// response. Transitions Requested → Submitted.
public class TenantQuoteSubmitDto
{
    public decimal ProposedRate { get; set; }
    public string? RateType { get; set; }
    public string? Message { get; set; }
    public int? AvailableFleetSize { get; set; }
    public string? AvailableStartDate { get; set; }   // YYYY-MM-DD
}

// Response for POST /api/v1/tenant/quotes/expire-sweep.
public class TenantExpireSweepResponse : BaseResponse
{
    public TenantExpireSweepResponse(Guid messageId) : base(messageId) { }
    public int ExpiredCount { get; set; }
}
