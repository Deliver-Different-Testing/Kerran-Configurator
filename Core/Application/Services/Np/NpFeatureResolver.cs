using System;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Resolves the per-NP feature gate set for the current request.
//   DF Admin                              → all gates true (superuser bypass).
//   NP user with NpFeatureConfig row      → row values.
//   NP user with no row                   → schema defaults (matches the
//                                            HasDefaultValue settings in
//                                            DespatchContext.OnModelCreating).
//   NP user with no scope (no NpAgentId)  → all gates false (defensive —
//                                            same posture as NpScopeResolver
//                                            returning an empty result set).
//
// Mirrors NpScopeResolver's shape: singleton-friendly interface, scoped impl,
// per-request cache on HttpContext.Items so multiple consumers in the same
// request only hit the DB once.
//
// Scope-related vs feature-related concerns are kept separate intentionally:
// NpScopeResolver answers "WHICH rows is this user allowed to see?", while
// NpFeatureResolver answers "WHICH features is this user allowed to use?".
// Both are checked at service entry; either can deny access.
//
// Notification settings on NpFeatureConfig (NotificationEmail, NotifyOnNewJob,
// NotifyOnJobUpdate, NotifyDigestFreq) are NOT gates — they're routing config
// read directly by QuoteNotificationService. Capacity limits (MaxCouriers,
// MaxUsersPerRole) and CoverageAreasJson are out of scope for this resolver
// too — add separate resolvers if/when those need enforcement.
public record NpFeatures(
    bool CanCreateTasks,
    bool CanAddStops,
    bool CanSeeFlightInfo,
    bool CanAccessScheduler,
    bool CanManageApplicants,
    bool MultiClientEnabled,
    bool AutoDispatchEnabled)
{
    /// <summary>Default gate set when an NP user has no NpFeatureConfig row yet.
    /// Mirrors the HasDefaultValue settings in DespatchContext.</summary>
    public static NpFeatures Defaults => new(
        CanCreateTasks:       true,
        CanAddStops:          false,
        CanSeeFlightInfo:     true,
        CanAccessScheduler:   false,
        CanManageApplicants:  true,
        MultiClientEnabled:   false,
        AutoDispatchEnabled:  false);

    /// <summary>DF Admin bypass — all gates pass.</summary>
    public static NpFeatures AllOn => new(
        CanCreateTasks:       true,
        CanAddStops:          true,
        CanSeeFlightInfo:     true,
        CanAccessScheduler:   true,
        CanManageApplicants:  true,
        MultiClientEnabled:   true,
        AutoDispatchEnabled:  true);

    /// <summary>Defensive deny-all — used when an NP user has no scope linkage.</summary>
    public static NpFeatures None => new(
        CanCreateTasks:       false,
        CanAddStops:          false,
        CanSeeFlightInfo:     false,
        CanAccessScheduler:   false,
        CanManageApplicants:  false,
        MultiClientEnabled:   false,
        AutoDispatchEnabled:  false);
}

public interface INpFeatureResolver
{
    Task<NpFeatures> ResolveAsync();
}

public class NpFeatureResolver(
    INpScopeResolver scopeResolver,
    IHttpContextAccessor httpContextAccessor,
    IDbContextFactory<DynamicDespatchDbContext> contextFactory) : INpFeatureResolver
{
    private const string CacheKey = "NpFeatures";

    public async Task<NpFeatures> ResolveAsync()
    {
        var httpCtx = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("NpFeatureResolver called outside an HTTP request.");

        if (httpCtx.Items.TryGetValue(CacheKey, out var cached) && cached is NpFeatures existing)
            return existing;

        var scope = await scopeResolver.ResolveAsync();

        NpFeatures features;
        if (scope.IsAdmin)
        {
            features = NpFeatures.AllOn;
        }
        else if (scope.NpAgentId is null)
        {
            // NP user with no agent linkage — already logged as a warning by
            // NpScopeResolver. Deny-all here so a missing linkage can't grant
            // accidental access through a config row that happens to exist.
            features = NpFeatures.None;
        }
        else
        {
            await using var ctx = await contextFactory.CreateDbContextAsync();
            var row = await ctx.NpFeatureConfigs.AsNoTracking()
                .Where(c => c.AgentId == scope.NpAgentId.Value)
                .Select(c => new
                {
                    c.CanCreateTasks,
                    c.CanAddStops,
                    c.CanSeeFlightInfo,
                    c.CanAccessScheduler,
                    c.CanManageApplicants,
                    c.MultiClientEnabled,
                    c.AutoDispatchEnabled,
                })
                .FirstOrDefaultAsync();

            if (row is null)
            {
                Log.Debug("NpFeatureConfig row missing for agentId={AgentId}; using schema defaults.", scope.NpAgentId);
                features = NpFeatures.Defaults;
            }
            else
            {
                features = new NpFeatures(
                    row.CanCreateTasks,
                    row.CanAddStops,
                    row.CanSeeFlightInfo,
                    row.CanAccessScheduler,
                    row.CanManageApplicants,
                    row.MultiClientEnabled,
                    row.AutoDispatchEnabled);
            }
        }

        httpCtx.Items[CacheKey] = features;
        return features;
    }
}
