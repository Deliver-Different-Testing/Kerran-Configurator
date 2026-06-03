using System;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Resolves NP-scope for the current request. Two outcomes that matter to callers:
//   IsAdmin=true                          → no filter, return all rows
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
        // DF Admin bypass — no NP scope filter (sees all rows). Keyed on
        // ClientType == 5 (DFRNTAdmin). (Was UserGroupID == 1; switched so a
        // tenant Administrator on a ClientTypeId=4 client isn't treated as a
        // DF admin.)
        var clientTypeId = user.FindFirst("ClientTypeId")?.Value;
        if (clientTypeId == "5")
        {
            var adminScope = new NpScope(IsAdmin: true, NpAgentId: null);
            httpCtx.Items[CacheKey] = adminScope;
            return adminScope;
        }

        var clientIdClaim = user.FindFirst("ClientID")?.Value;
        int? npAgentId = null;

        // Claim-first: Hub stamps NpAgentId at login. null = claim absent
        // (pre-2026-06-03 cookie) → legacy DB fallback; "" or non-positive =
        // Hub-authoritative "no linkage" → leave npAgentId null, no DB call.
        var npAgentClaim = user.FindFirst("NpAgentId")?.Value;
        if (npAgentClaim is null)
        {
            if (int.TryParse(clientIdClaim, out var clientId) && clientId > 0)
            {
                await using var ctx = await contextFactory.CreateDbContextAsync();
                npAgentId = await ctx.TucClients
                    .AsNoTracking()
                    .Where(c => c.UcclId == clientId)
                    .Select(c => c.NpAgentId)
                    .FirstOrDefaultAsync();
            }
        }
        else if (int.TryParse(npAgentClaim, out var claimedNpAgentId) && claimedNpAgentId > 0)
        {
            npAgentId = claimedNpAgentId;
        }

        if (npAgentId is null)
        {
            Log.Warning(
                "NP-scoped request from non-admin user (ClientID={ClientId}); no tucClient.NpAgentId linkage configured. Returning empty result set.",
                clientIdClaim ?? "null");
        }

        var scope = new NpScope(IsAdmin: false, NpAgentId: npAgentId);
        httpCtx.Items[CacheKey] = scope;
        return scope;
    }
}
