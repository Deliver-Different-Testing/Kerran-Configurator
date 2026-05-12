using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Tenant;

// Pass-3 shape: tucAgents core columns + joins to TucSuburb (city), TucAgentStatus
// (status name), TucAgentRanking (ranking name). ContactName still pending —
// no direct FK from tucAgents to a contact table; needs separate investigation.
public class TenantAgentDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string AddressLine1 { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string PostCode { get; set; } = string.Empty;
    public int? StatusId { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public int? RankingId { get; set; }
    public string RankingName { get; set; } = string.Empty;
    public bool IsNetworkPartner { get; set; }
    public bool NpPortalEnabled { get; set; }
    public byte NpTier { get; set; }
    public string Notes { get; set; } = string.Empty;
    public DateTime Created { get; set; }
    public DateTime LastModified { get; set; }
}

public class TenantAgentsResponse : BaseResponse
{
    public TenantAgentsResponse(Guid messageId) : base(messageId) { }
    public List<TenantAgentDto> Agents { get; set; } = new();
}

// Editable subset for PUT /api/v1/tenant/agents/{id} and POST /api/v1/tenant/agents.
// Excludes Id/Created/LastModified — those are server-managed. SuburbId is
// excluded for now: the suburb table is large and a picker UI hasn't been
// built yet; existing rows keep their UcagSuburbId on edit. Create defaults
// to a sensible suburb (152 — same convention as AdminManager UserSetupService).
public class TenantAgentUpsertDto
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string AddressLine1 { get; set; } = string.Empty;
    public string PostCode { get; set; } = string.Empty;
    public int? StatusId { get; set; }
    public int? RankingId { get; set; }
    public bool IsNetworkPartner { get; set; }
    public bool NpPortalEnabled { get; set; }
    public byte NpTier { get; set; } = 1;     // 1=Base, 2=Multi-Client
    public string Notes { get; set; } = string.Empty;
}

public class TenantAgentResponse : BaseResponse
{
    public TenantAgentResponse(Guid messageId) : base(messageId) { }
    public TenantAgentDto? Agent { get; set; }
}
