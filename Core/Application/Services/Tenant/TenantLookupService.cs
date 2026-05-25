using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
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
}
