using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Read-only lookup feeds for select dropdowns. Tenant-scope under
// /api/v1/np/lookups for now; if other lanes need them we can move to a
// shared route later.
public class NpLookupService(IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseService(contextFactory)
{
    public async Task<List<LookupItemDto>> GetVehicleMakes()
    {
        return await Context.TucVehicleMakes
            .AsNoTracking()
            .OrderBy(v => v.UcvmName)
            .Select(v => new LookupItemDto { Id = v.UcvmId, Name = v.UcvmName ?? string.Empty })
            .ToListAsync();
    }

    public async Task<List<LookupItemDto>> GetInsuranceCompanies()
    {
        return await Context.TucInsuranceCompanies
            .AsNoTracking()
            .OrderBy(i => i.UcicName)
            .Select(i => new LookupItemDto { Id = i.UcicId, Name = i.UcicName ?? string.Empty })
            .ToListAsync();
    }

    public async Task<List<LookupItemDto>> GetCourierFleets()
    {
        return await Context.TucCourierFleets
            .AsNoTracking()
            .OrderBy(f => f.UccfName)
            .Select(f => new LookupItemDto { Id = f.UccfId, Name = f.UccfName ?? string.Empty })
            .ToListAsync();
    }
}
