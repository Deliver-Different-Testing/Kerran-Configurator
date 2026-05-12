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
}
