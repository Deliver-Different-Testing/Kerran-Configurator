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
// Lookup: ClientID claim → tucClient.UcclId → tucClient.NpAgentId. The Hub
// populates ClientID at login from tucClientContact.UcctClientId, so it's the
// user's tucClient row directly. Result is cached on HttpContext.Items so a
// single request doesn't hit the DB more than once.
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
        if (int.TryParse(clientIdClaim, out var clientId) && clientId > 0)
        {
            await using var ctx = await contextFactory.CreateDbContextAsync();
            npAgentId = await ctx.TucClients
                .AsNoTracking()
                .Where(c => c.UcclId == clientId)
                .Select(c => c.NpAgentId)
                .FirstOrDefaultAsync();
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
