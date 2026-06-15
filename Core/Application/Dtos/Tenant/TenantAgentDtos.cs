using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Tenant;

// Pass-3 shape: tucAgents core columns + joins to TucSuburb (city), TucAgentStatus
// (status name), TucAgentRanking (ranking name). Pass-4 added State, the
// Association/Contact/DefaultCourierPayPercent columns (migration 029), and
// will add CoverageAreas once the AgentCoverageArea table is scaffolded.
public class TenantAgentDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string AddressLine1 { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;   // tucAgents.AddressLine6 (AdminManager's "American State")
    public string PostCode { get; set; } = string.Empty;
    public int? StatusId { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public int? RankingId { get; set; }
    public string RankingName { get; set; } = string.Empty;
    public bool IsNetworkPartner { get; set; }
    public bool NpPortalEnabled { get; set; }
    public byte NpTier { get; set; }
    public string Notes { get; set; } = string.Empty;

    // Pass-4 fields — migration 029.
    public string Association { get; set; } = string.Empty;          // ECA / CLDA / "" = None
    public string AssociationMemberId { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public decimal? DefaultCourierPayPercent { get; set; }
    // Phase 5+29a §C — was List<string>, now richer per-city DTO so the
    // chip can render "Sacramento (42)" once the frontend is updated in
    // 5+29b. ZipCount=0 means the city did not resolve in ZipPolygonCity
    // (operator-typed city not in the seed); the parent row still saved
    // and HasZipMapping=false flags that state to the UI.
    public List<TenantAgentCoverageAreaDto> CoverageAreas { get; set; } = new();

    // Phase 5+27.1 — surfaces the linked TucClient.ClientTypeId for display +
    // the edit picker. Null when no TucClient is linked (non-NP agent).
    public int? ClientTypeId { get; set; }

    // 2026-06-15 — true when the linked NP client already has at least one
    // TucClientContact (i.e. a user exists). Drives the Edit Agent modal: the
    // "Initial User Role" picker is read-only when a user already exists (role
    // edits live on the NP Users page); editable only when a contact will be
    // created.
    public bool NpHasPrimaryContact { get; set; }

    public DateTime Created { get; set; }
    public DateTime LastModified { get; set; }
}

// Phase 5+29a §C — one row per AgentCoverageArea parent, with the
// materialised zipcode count for chip-display + a flag for the
// no-zips-resolved soft-fail state. Operators still SEND just city
// names on the upsert DTO; backend resolves and surfaces the count.
public class TenantAgentCoverageAreaDto
{
    public string AreaName { get; set; } = string.Empty;
    public int ZipCount { get; set; }
    public bool HasZipMapping => ZipCount > 0;
}

// Phase 5+29a §C — city autocomplete result. Returned by
// GET /api/v1/tenant/lookups/cities?q=&state=. ZipCount lets the UI
// disambiguate same-name cities across states ("Springfield, MO (47)"
// vs "Springfield, IL (33)") without an extra round-trip.
public class CitySuggestionDto
{
    public string CityName { get; set; } = string.Empty;
    public string? State { get; set; }
    public int ZipCount { get; set; }
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

    // Pass-4 fields — migration 029.
    public string Association { get; set; } = string.Empty;          // ECA / CLDA / "" = None
    public string AssociationMemberId { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public decimal? DefaultCourierPayPercent { get; set; }
    public List<string> CoverageAreas { get; set; } = new();         // full desired set — service reconciles rows

    // Phase 5+27.1 — picker value for the linked TucClient.ClientTypeId.
    // Null is accepted; the service applies the default rule
    // (IsNetworkPartner=true → 3 NetworkPartner, otherwise no client row).
    // Operators can override to 1 (Internal) / 2 (Customer) or any other
    // seeded ClientType when they have a reason to.
    public int? ClientTypeId { get; set; }

    // 2026-06-15 — operator-selected ContactRoleId for the primary
    // TucClientContact the NP cascade creates. The Edit Agent modal's "Initial
    // User Role" dropdown is the SINGLE source of truth — there is no silent
    // name-match fallback. Required (validated server-side) only when
    // IsNetworkPartner = true AND ContactEmail is set AND a contact will be
    // created; null in any other case.
    public int? PrimaryContactRoleId { get; set; }
}

public class TenantAgentResponse : BaseResponse
{
    public TenantAgentResponse(Guid messageId) : base(messageId) { }
    public TenantAgentDto? Agent { get; set; }
}
