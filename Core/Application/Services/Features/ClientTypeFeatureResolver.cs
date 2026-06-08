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

    public async Task<HashSet<string>> ResolveVisibleFeaturesAsync(int? clientTypeId, string? countryCode = null)
    {
        var effectiveId = clientTypeId ?? NullClientTypeFallback;
        var httpCtx = httpContextAccessor.HttpContext;
        // Country participates in the cache key — the visible set differs per
        // market, so NZ and AU tenants of the same ClientType mustn't share a
        // cached result. "*" = no country filter applied.
        var cacheKey = ByTypePrefix + effectiveId + ":" + (string.IsNullOrEmpty(countryCode) ? "*" : countryCode);

        if (httpCtx is not null
            && httpCtx.Items.TryGetValue(cacheKey, out var cached)
            && cached is HashSet<string> existing)
        {
            return existing;
        }

        await using var ctx = await contextFactory.CreateDbContextAsync();
        // Join to dbo.Feature so the per-feature country scope is available.
        var rows = await ctx.ClientTypeFeatures
            .AsNoTracking()
            .Where(ctf => ctf.ClientTypeId == effectiveId && ctf.Visible)
            .Join(ctx.Features.AsNoTracking(),
                  ctf => ctf.FeatureKey, f => f.FeatureKey,
                  (ctf, f) => new { f.FeatureKey, f.AvailableCountries })
            .ToListAsync();

        // Country scope (SEED-SCOPE-ALL-HUBS §2): a feature with AvailableCountries
        // set is visible only in those markets; NULL/empty = global. Split +
        // Contains runs in memory (untranslatable), hence materialising first.
        //
        // DELIBERATE DEVIATION from the doc's fail-CLOSED pseudo-code: when the
        // tenant country is UNKNOWN (CountryCode claim absent — e.g. a stale
        // pre-claim cookie) we DON'T filter (fail-open). Hiding the whole
        // NZ-scoped AdminManager catalogue from a legit NZ user on an old cookie
        // is worse than briefly over-showing; the claim is normally present
        // (Hub stamps it into the shared cookie).
        var keys = string.IsNullOrEmpty(countryCode)
            ? rows.Select(r => r.FeatureKey)
            : rows.Where(r => string.IsNullOrEmpty(r.AvailableCountries)
                              || r.AvailableCountries
                                  .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                                  .Contains(countryCode, StringComparer.OrdinalIgnoreCase))
                   .Select(r => r.FeatureKey);

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

        // DF Admin bypass — sees every feature. Keyed on ClientType == 5
        // (DFRNTAdmin), the reparented DFRNT-staff client. Returns the union
        // of every visible key across all ClientTypes so admins effectively
        // see everything the matrix defines anywhere. (Was UserGroupID == 1;
        // switched so a tenant Administrator on a ClientTypeId=4 client isn't
        // treated as a DF admin.)
        if (user.FindFirst("ClientTypeId")?.Value == "5")
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

        // Tenant market for the country-scope filter. Hub stamps CountryCode
        // into the shared cookie (AccountController.GenerateClaims, from
        // Master.Tenant.CountryCode); absent only on stale pre-claim cookies,
        // in which case the resolver fails open (no country filter).
        var countryCode = user.FindFirst("CountryCode")?.Value;
        if (string.IsNullOrWhiteSpace(countryCode))
        {
            countryCode = null;
            Log.Debug("ClientTypeFeatureResolver: CountryCode claim missing; country scope not applied (fail-open).");
        }

        var resolved = await ResolveVisibleFeaturesAsync(clientTypeId, countryCode);
        httpCtx.Items[CurrentUserKey] = resolved;
        return resolved;
    }
}
