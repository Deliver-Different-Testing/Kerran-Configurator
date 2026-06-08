using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Contacts;

// RESOLVED-DATA-SCOPE spec (2026-06-08) §7.3 — the DF-admin inspector payload.
// It is a faithful view of the SAME ScopeDecider the production list/picker
// filters use (§8). Fields the current resolver does NOT compute are left null
// and listed in NotModelled so the inspector never lies about scope it doesn't
// actually enforce (Garry decision 2026-06-09: "show only what's real").
public class ResolvedDataScopeDto
{
    public int ContactId { get; set; }
    public string DisplayName { get; set; } = string.Empty;

    public int ResolvedClientTypeId { get; set; }
    public string ResolvedClientTypeName { get; set; } = string.Empty;

    public string ScopeKind { get; set; } = string.Empty;   // Platform | Tenant | Np | None
    public string Summary { get; set; } = string.Empty;     // one-line human explanation

    public int? HomeClientId { get; set; }
    public string? HomeClientName { get; set; }

    public int? TenantClientId { get; set; }                // null: tenant boundary = the tenant DB (no discrete id)
    public string? TenantClientName { get; set; }

    public int? NpAgentId { get; set; }
    public string? NpAgentName { get; set; }

    public int? CustomerClientId { get; set; }              // not modelled by the current resolver
    public int? CourierId { get; set; }                     // not modelled by the current resolver

    public bool CanSeeDfAdmin { get; set; }
    public bool CanCrossTenant { get; set; }
    public bool? CanSeeChildClientsOnly { get; set; }       // null = not modelled
    public bool? IsInheritedFromParentClient { get; set; }  // null = not modelled

    public string ResolutionSource { get; set; } = string.Empty;
    public List<string> Rules { get; set; } = new();        // the decision trace
    public List<string> NotModelled { get; set; } = new();  // fields the resolver doesn't yet compute
}
