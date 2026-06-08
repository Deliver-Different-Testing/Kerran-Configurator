using System;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Authorization;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Resolves NP-scope for the current request. Two outcomes that matter to callers:
//   IsAdmin=true                          → no filter, return all rows in the
//                                            current tenant DB. Covers BOTH DF
//                                            admins (ClientTypeId=5) AND ordinary
//                                            tenant staff (not a Network Partner):
//                                            for tenant staff the tenant Despatch
//                                            DB connection is itself the scope
//                                            boundary, so "no NpAgentId filter"
//                                            is the correct, tenant-wide view
//                                            (mirrors TenantAgentService).
//   IsAdmin=false, NpAgentId=<int>        → filter rows by NpAgentId
//   IsAdmin=false, NpAgentId=null         → caller is an NP user without a
//                                            configured tucClient.NpAgentId
//                                            linkage; services should return
//                                            empty (do not silently fall back
//                                            to "show everything").
//
// Source: the NpAgentId claim, which Hub stamps at login (2026-06-03) from
// tucClient.NpAgentId — no DB call needed. For cookies minted before that Hub
// change the claim is absent, in which case we fall back to the legacy lookup
// (ClientID claim → tucClient.UcclId → tucClient.NpAgentId). An empty (present
// but blank) claim is authoritative "no linkage" and does NOT trigger the
// fallback. Result is cached on HttpContext.Items per request.
public record NpScope(bool IsAdmin, int? NpAgentId);

public interface INpScopeResolver
{
    Task<NpScope> ResolveAsync();
}

public class NpScopeResolver(
    IHttpContextAccessor httpContextAccessor,
    IDbContextFactory<DynamicDespatchDbContext> contextFactory) : INpScopeResolver
{
    private const string CacheKey = "NpScope";

    public async Task<NpScope> ResolveAsync()
    {
        var httpCtx = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("NpScopeResolver called outside an HTTP request.");

        if (httpCtx.Items.TryGetValue(CacheKey, out var cached) && cached is NpScope existing)
            return existing;

        var user = httpCtx.User;

        // Gather the scope inputs from the cookie claims, then hand off to the
        // canonical ScopeDecider (shared with the DF-admin Resolved Data Scope
        // inspector — RESOLVED-DATA-SCOPE §8: one decision, two callers, so the
        // inspector can never disagree with these production filters).
        //   ClientTypeId=5            → DF admin, platform scope
        //   not IsNetworkPartner      → tenant staff, tenant-wide (tenant DB is
        //                               the boundary; mirrors TenantAgentService)
        //   IsNetworkPartner + agent  → NP scope filtered by NpAgentId
        //   IsNetworkPartner, no agent→ deny by default (empty result set)
        var clientTypeId = int.TryParse(user.FindFirst("ClientTypeId")?.Value, out var ct) ? ct : (int?)null;
        var isNetworkPartner = string.Equals(user.FindFirst("IsNetworkPartner")?.Value, "True", StringComparison.OrdinalIgnoreCase);
        var clientIdClaim = user.FindFirst("ClientID")?.Value;
        var clientId = int.TryParse(clientIdClaim, out var cid) ? cid : (int?)null;

        // Only an NP caller (not DF admin, not tenant staff) needs an NpAgentId,
        // and only then do we touch the DB — preserving the original
        // short-circuit where admins + tenant staff never hit the database.
        int? npAgentId = null;
        if (clientTypeId != ScopeDecider.DfAdminClientType && isNetworkPartner)
            npAgentId = await ResolveNpAgentIdAsync(user, clientId);

        var decision = ScopeDecider.Decide(new ScopeInputs(clientTypeId, isNetworkPartner, clientId, npAgentId));

        if (decision.Kind == ScopeKind.None)
            Log.Warning(
                "NP-scoped request from non-admin user (ClientID={ClientId}); no tucClient.NpAgentId linkage configured. Returning empty result set.",
                clientIdClaim ?? "null");

        var scope = new NpScope(decision.IsAdmin, decision.NpAgentId);
        httpCtx.Items[CacheKey] = scope;
        return scope;
    }

    // Claim-first NpAgentId resolution: Hub stamps NpAgentId at login
    // (2026-06-03). A null claim = absent (pre-change cookie) → legacy DB
    // fallback via ClientID → tucClient.NpAgentId; an "" / non-positive claim is
    // the Hub-authoritative "no linkage" and triggers no DB call.
    private async Task<int?> ResolveNpAgentIdAsync(System.Security.Claims.ClaimsPrincipal user, int? clientId)
    {
        var npAgentClaim = user.FindFirst("NpAgentId")?.Value;
        if (npAgentClaim is null)
        {
            if (clientId is int id && id > 0)
            {
                await using var ctx = await contextFactory.CreateDbContextAsync();
                return await ctx.TucClients.AsNoTracking()
                    .Where(c => c.UcclId == id)
                    .Select(c => c.NpAgentId)
                    .FirstOrDefaultAsync();
            }
            return null;
        }
        return int.TryParse(npAgentClaim, out var claimed) && claimed > 0 ? claimed : null;
    }
}
