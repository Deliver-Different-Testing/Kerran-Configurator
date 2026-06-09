using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Reporting;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Reporting;

// Lookup feeds for the Rate Schedule picker UI. Ported from the standalone
// app's Clients/Sites/Speeds/Suburbs features and folded into one service.
//
// Client search is NP-scoped (Phase 5+3 pattern, mirrors NpFleetService):
//   IsAdmin            → all clients in the tenant DB (DF admin + plain tenant staff)
//   non-admin + agent  → only clients where tucClient.NpAgentId matches
//   non-admin + no link→ empty result (never silently widen to "show all")
// Sites/speeds/suburbs are reference data, not client-owned, so they aren't scoped.
public class ReportingLookupService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    INpScopeResolver scopeResolver)
{
    private static readonly HashSet<string> ExcludedSystemNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "UT", "B", "HDR", "HNDR", "MR"
    };

    public async Task<IReadOnlyList<ClientSearchResult>> SearchClientsAsync(
        string term, int limit = 20, CancellationToken ct = default)
    {
        var scope = await scopeResolver.ResolveAsync();

        // Non-admin caller with no NpAgentId linkage sees nothing.
        if (!scope.IsAdmin && scope.NpAgentId is null)
            return Array.Empty<ClientSearchResult>();

        await using var db = await contextFactory.CreateDbContextAsync(ct);

        var query = db.TucClients.AsNoTracking()
            .Where(c => c.UcclActive &&
                        (c.UcclName.Contains(term) || c.UcclCode.StartsWith(term)));

        if (!scope.IsAdmin)
            query = query.Where(c => c.NpAgentId == scope.NpAgentId);

        return await query
            .OrderBy(c => c.UcclCode.StartsWith(term) ? 0 : 1)
            .ThenBy(c => c.UcclName)
            .Take(limit)
            .Select(c => new ClientSearchResult
            {
                Id             = c.UcclId,
                Code           = c.UcclCode,
                Name           = c.UcclName,
                SiteId         = c.SiteId,
                HomeSuburbId   = c.UcclSuburbId,
                HomeSuburbName = db.TucSuburbs
                                   .Where(s => s.UcsuId == c.UcclSuburbId)
                                   .Select(s => s.UcsuName)
                                   .FirstOrDefault(),
                EconomyActive  = c.EconomyActive,
                EconomyRuns    = c.EconomyRuns,
                PpdRate        = c.Ppdrate,
            })
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<SiteResult>> GetSitesAsync(CancellationToken ct = default)
    {
        await using var db = await contextFactory.CreateDbContextAsync(ct);
        return await db.TblSites.AsNoTracking()
            .OrderBy(s => s.Name)
            .Select(s => new SiteResult { SiteId = s.SiteId, Name = s.Name })
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<SpeedResult>> GetSpeedsAsync(CancellationToken ct = default)
    {
        await using var db = await contextFactory.CreateDbContextAsync(ct);

        var ratingEnabledGroupIds = db.TucJobTypeGroupings
            .Where(g => g.RatingEnabled)
            .Select(g => g.GroupingId);

        return await db.TucJobTypes.AsNoTracking()
            .Where(jt => !ExcludedSystemNames.Contains(jt.SystemName)
                      && ratingEnabledGroupIds.Contains(jt.GroupingId))
            .OrderBy(jt => jt.GroupingId)
            .ThenBy(jt => jt.Minutes)
            .Select(jt => new SpeedResult
            {
                Id           = jt.UcjtId,
                Name         = jt.UcjtName,
                ShortName    = jt.ShortName,
                SystemName   = jt.SystemName,
                Minutes      = jt.Minutes,
                GroupingId   = jt.GroupingId,
                GroupingName = db.TucJobTypeGroupings
                                 .Where(g => g.GroupingId == jt.GroupingId)
                                 .Select(g => g.GroupingName)
                                 .FirstOrDefault(),
            })
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<SuburbResult>> GetSuburbsBySiteAsync(int siteId, CancellationToken ct = default)
    {
        await using var db = await contextFactory.CreateDbContextAsync(ct);
        return await db.TucSuburbs.AsNoTracking()
            .Where(s => s.SiteId == siteId && s.Priority == 1)
            .OrderBy(s => s.UcsuName)
            .Select(s => new SuburbResult
            {
                Id     = s.UcsuId,
                Name   = s.UcsuName,
                SiteId = s.SiteId!.Value,
                Zone   = s.UcsuArea,
            })
            .ToListAsync(ct);
    }
}
