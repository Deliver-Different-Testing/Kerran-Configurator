using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Application.Authorization;

// RESOLVED-DATA-SCOPE spec (2026-06-08) §8 — the single, canonical data-scope
// decision. There must be exactly ONE implementation of "which records can this
// identity see", consumed two ways:
//   * NpScopeResolver.ResolveAsync() feeds it the CURRENT caller's claim-derived
//     inputs and maps the result to NpScope — this is what every production
//     list/picker query already filters on (NpFleetService, NpUserService, …).
//   * AdminContactService.GetResolvedDataScopeAsync() feeds it a TARGET contact's
//     DB-derived inputs to power the DF-admin inspector.
// Because both paths go through Decide(), the inspector can never disagree with
// the real filters (acceptance #5/#7) — there is no parallel model.
//
// HONEST SCOPE (Garry decision 2026-06-09): the live resolver only distinguishes
// Platform / Tenant / Np / None. Customer and Courier are part of the spec's
// vocabulary (§9) but the configurator's resolver does NOT emit them today, so
// Decide() never returns them — the inspector surfaces that as "not modelled"
// rather than inventing logic the production filters don't use.

public enum ScopeKind
{
    None,       // no resolved scope — deny by default (empty result set)
    Platform,   // DF Admin — full cross-tenant / internal visibility
    Tenant,     // tenant-wide inside one tenant (the tenant DB is the boundary)
    Np,         // restricted to one network-partner agent
    Customer,   // (spec §9) — NOT emitted by the current resolver
    Courier,    // (spec §9) — NOT emitted by the current resolver
}

// The raw inputs the decision needs. Sourced from the caller's claims (live
// resolver) or a target contact's DB row (inspector) — the decision logic is
// identical regardless of source.
public sealed record ScopeInputs(
    int? ClientTypeId,
    bool IsNetworkPartner,
    int? ClientId,
    int? NpAgentId);

public sealed record ScopeDecision(
    bool IsAdmin,                       // NpScope.IsAdmin semantics: Platform OR Tenant ⇒ no NP filter
    int? NpAgentId,
    ScopeKind Kind,
    bool CanSeeDfAdmin,
    bool CanCrossTenant,
    string ResolutionSource,
    IReadOnlyList<string> Rules);

public static class ScopeDecider
{
    public const int DfAdminClientType = 5;
    public const int NetworkPartnerClientType = 3;

    // The canonical decision. Mirrors NpScopeResolver's original branch order
    // exactly so behaviour is preserved for the 7 production consumers.
    public static ScopeDecision Decide(ScopeInputs i)
    {
        var rules = new List<string>();

        // 1. DF Admin — platform-wide (no NP filter).
        if (i.ClientTypeId == DfAdminClientType)
        {
            rules.Add($"ClientTypeId={DfAdminClientType} → DF Admin: platform-wide scope (no NP filter).");
            rules.Add("DFRNT Admin internal entities visible.");
            return new ScopeDecision(true, null, ScopeKind.Platform, true, true,
                "DF Admin (ClientTypeId=5)", rules);
        }

        // 2. Not a Network Partner → tenant-wide. The tenant Despatch DB
        //    connection is itself the boundary (matches TenantAgentService
        //    applying no per-user filter), so IsAdmin=true with no NP id.
        if (!i.IsNetworkPartner)
        {
            rules.Add("Not flagged IsNetworkPartner → tenant-wide scope (the tenant database is the boundary).");
            rules.Add($"ClientTypeId={Describe(i.ClientTypeId)} ≠ 5 → DFRNT Admin internal entities excluded.");
            return new ScopeDecision(true, null, ScopeKind.Tenant, false, false,
                "Tenant staff (IsNetworkPartner not set)", rules);
        }

        // 3. Network Partner with a resolved agent → restricted to that agent.
        if (i.NpAgentId is int agent && agent > 0)
        {
            rules.Add("IsNetworkPartner=true → NP scope.");
            rules.Add($"Results filtered to NpAgentId={agent}.");
            rules.Add($"ClientTypeId={Describe(i.ClientTypeId)} ≠ 5 → DFRNT Admin internal entities excluded.");
            return new ScopeDecision(false, agent, ScopeKind.Np, false, false,
                "NP relationship (tucClient.NpAgentId)", rules);
        }

        // 4. Network Partner with no resolved agent linkage → deny by default.
        rules.Add("IsNetworkPartner=true but no NpAgentId linkage resolved → deny by default (empty result set).");
        return new ScopeDecision(false, null, ScopeKind.None, false, false,
            "No NP linkage (fallback deny)", rules);
    }

    private static string Describe(int? clientTypeId) => clientTypeId?.ToString() ?? "null";
}
