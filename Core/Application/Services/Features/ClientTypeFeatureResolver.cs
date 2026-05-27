using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Features;

/// <inheritdoc cref="IClientTypeFeatureResolver"/>
public class ClientTypeFeatureResolver(
    IHttpContextAccessor httpContextAccessor,
    IDbContextFactory<DynamicDespatchDbContext> contextFactory) : IClientTypeFeatureResolver
{
    // Cache keys partitioned so admin previews and current-user resolution
    // never collide. Suffix is the effective ClientTypeId (post NULL→2).
    private const string ByTypePrefix    = "ClientTypeFeatures:byType:";
    private const string CurrentUserKey  = "ClientTypeFeatures:currentUser";

    // NULL ClientTypeId → 2 (Customer) per §1.4 of the Permissions plan.
    private const int NullClientTypeFallback = 2;

    public async Task<HashSet<string>> ResolveVisibleFeaturesAsync(int? clientTypeId)
    {
        var effectiveId = clientTypeId ?? NullClientTypeFallback;
        var httpCtx = httpContextAccessor.HttpContext;
        var cacheKey = ByTypePrefix + effectiveId;

        if (httpCtx is not null
            && httpCtx.Items.TryGetValue(cacheKey, out var cached)
            && cached is HashSet<string> existing)
        {
            return existing;
        }

        await using var ctx = await contextFactory.CreateDbContextAsync();
        var keys = await ctx.ClientTypeFeatures
            .AsNoTracking()
            .Where(ctf => ctf.ClientTypeId == effectiveId && ctf.Visible)
            .Select(ctf => ctf.FeatureKey)
            .ToListAsync();

        // Case-insensitive set so callers comparing with hard-coded strings
        // don't trip on accidental casing drift.
        var result = new HashSet<string>(keys, StringComparer.OrdinalIgnoreCase);

        if (httpCtx is not null)
            httpCtx.Items[cacheKey] = result;
        return result;
    }

    public async Task<HashSet<string>> ResolveForCurrentUserAsync()
    {
        var httpCtx = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException(
                "ClientTypeFeatureResolver.ResolveForCurrentUserAsync called outside an HTTP request.");

        if (httpCtx.Items.TryGetValue(CurrentUserKey, out var cached)
            && cached is HashSet<string> existing)
        {
            return existing;
        }

        var user = httpCtx.User;

        // DF Admin bypass — sees every feature regardless of tucClient
        // assignment. Defensive cover for any DF admin still on a legacy
        // Internal (1) or NULL ClientType row that hasn't been reparented
        // to DFRNTAdmin (5) yet. Returns the union of every visible key
        // across all ClientTypes so admins effectively see everything the
        // matrix defines anywhere.
        if (user.FindFirst("UserGroupID")?.Value == "1")
        {
            await using var ctx = await contextFactory.CreateDbContextAsync();
            var allKeys = await ctx.ClientTypeFeatures
                .AsNoTracking()
                .Where(ctf => ctf.Visible)
                .Select(ctf => ctf.FeatureKey)
                .Distinct()
                .ToListAsync();
            var adminResult = new HashSet<string>(allKeys, StringComparer.OrdinalIgnoreCase);
            httpCtx.Items[CurrentUserKey] = adminResult;
            return adminResult;
        }

        // Non-admin: look up the user's ClientTypeId via their ClientID
        // claim (= tucClient.UcclId, set by Hub at login from
        // tucClientContact.UcctClientId). NULL or zero ClientID falls
        // through to the NULL→Customer rule via ResolveVisibleFeaturesAsync.
        var clientIdClaim = user.FindFirst("ClientID")?.Value;
        int? clientTypeId = null;
        if (int.TryParse(clientIdClaim, out var clientId) && clientId > 0)
        {
            await using var ctx = await contextFactory.CreateDbContextAsync();
            clientTypeId = await ctx.TucClients
                .AsNoTracking()
                .Where(c => c.UcclId == clientId)
                .Select(c => c.ClientTypeId)
                .FirstOrDefaultAsync();
        }
        else
        {
            Log.Debug(
                "ClientTypeFeatureResolver: ClientID claim missing or unparseable ('{Claim}'); falling through to NULL→Customer rule.",
                clientIdClaim ?? "(null)");
        }

        var resolved = await ResolveVisibleFeaturesAsync(clientTypeId);
        httpCtx.Items[CurrentUserKey] = resolved;
        return resolved;
    }
}
