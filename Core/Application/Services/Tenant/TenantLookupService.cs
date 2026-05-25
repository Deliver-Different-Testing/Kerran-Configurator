using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Tenant;

// Read-only lookup feeds for tenant-side dropdowns. Reuses the LookupItemDto
// shape the NP-side endpoints already use so the frontend can share types.
public class TenantLookupService(IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseService(contextFactory)
{
    public async Task<List<LookupItemDto>> GetAgentStatuses()
    {
        return await Context.TucAgentStatuses
            .AsNoTracking()
            .OrderBy(s => s.AgentStatusName)
            .Select(s => new LookupItemDto { Id = s.AgentStatusId, Name = s.AgentStatusName ?? string.Empty })
            .ToListAsync();
    }

    public async Task<List<LookupItemDto>> GetAgentRankings()
    {
        return await Context.TucAgentRankings
            .AsNoTracking()
            .OrderBy(r => r.AgentRankingName)
            .Select(r => new LookupItemDto { Id = r.AgentRankingId, Name = r.AgentRankingName ?? string.Empty })
            .ToListAsync();
    }

    // Phase 5+27.1 — Client-type lookup for the NP Add/Edit picker.
    // Seeded 3 rows by migration 20260513123935_NPMarketplaceAndQuotes.sql:
    // 1=Internal, 2=Customer, 3=NetworkPartner. Operator may add more later
    // — picker reflects whatever's in the table. v1 is read-only; the
    // inline "+ Add new..." path is deferred per the NP-creation-cascade
    // brief corrections (#5) to avoid ad-hoc-typo duplicates in the
    // lookup table.
    public async Task<List<LookupItemDto>> GetClientTypes()
    {
        return await Context.ClientTypes
            .AsNoTracking()
            .OrderBy(t => t.Id)
            .Select(t => new LookupItemDto { Id = t.Id, Name = t.Name ?? string.Empty })
            .ToListAsync();
    }

    // Phase 5+29a §C — city autocomplete for the Coverage Areas chip input.
    // GROUP BY CityName+State so the same city in different states shows
    // as separate options ("Springfield, MO" vs "Springfield, IL"). ZipCount
    // surfaces alongside so the UI can disambiguate or render the future
    // "(N zips)" affordance directly off the suggestion. Returns up to 20
    // rows — autocomplete UI never needs more, and bounding the query
    // keeps the response fast on a 33k-row ZCTA seed.
    public async Task<List<CitySuggestionDto>> GetCitiesAsync(string q, string? state)
    {
        var query = (q ?? string.Empty).Trim();
        if (query.Length < 2) return new List<CitySuggestionDto>();

        var rows = Context.ZipPolygonCities.AsNoTracking()
            .Where(c => c.CityName.StartsWith(query));
        if (!string.IsNullOrWhiteSpace(state))
            rows = rows.Where(c => c.State == state);

        return await rows
            .GroupBy(c => new { c.CityName, c.State })
            .Select(g => new CitySuggestionDto
            {
                CityName = g.Key.CityName,
                State = g.Key.State,
                ZipCount = g.Count(),
            })
            .OrderBy(s => s.CityName)
            .ThenBy(s => s.State)
            .Take(20)
            .ToListAsync();
    }

    // Phase 5+29a §C — given a city (+ optional state for disambiguation)
    // returns the underlying ZipPolygon rows. Used by TenantAgentService's
    // ApplyCoverageAreas to materialise the AgentCoverageAreaZipcode
    // children when an operator adds a coverage-area chip.
    public async Task<List<LookupItemDto>> GetZipPolygonsByCityAsync(string city, string? state)
    {
        var name = (city ?? string.Empty).Trim();
        if (name.Length == 0) return new List<LookupItemDto>();

        var rows = Context.ZipPolygonCities.AsNoTracking()
            .Where(c => c.CityName == name);
        if (!string.IsNullOrWhiteSpace(state))
            rows = rows.Where(c => c.State == state);

        return await rows
            .Select(c => new LookupItemDto
            {
                Id = c.ZipPolygonId,
                Name = c.ZipPolygon.Zip ?? string.Empty,
            })
            .Distinct()
            .OrderBy(z => z.Name)
            .ToListAsync();
    }
}
