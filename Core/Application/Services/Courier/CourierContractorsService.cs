using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Courier;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Courier;

// Phase 2 — a master courier manages their subcontractors' payment splits.
// Ported from courierportal CourierService contractor methods. The logged-in
// courier is the master; subs are TucCourier rows with MasterCourierId == them.
public class CourierContractorsService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    ICourierScopeResolver scopeResolver)
{
    public async Task<List<CourierContractorDto>> GetMyContractorsAsync(CancellationToken ct)
    {
        var scope = await Require(ct);
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        return await ctx.TucCouriers
            .Where(c => c.MasterCourierId == scope.CourierId && c.Active && !c.UccrInternal)
            .OrderBy(c => c.UccrName).ThenBy(c => c.UccrSurname)
            .Select(c => new CourierContractorDto
            {
                Id = c.UccrId,
                Code = c.Code,
                FirstName = c.UccrName,
                Surname = c.UccrSurname,
                Percentage = c.SubContractorPercentage ?? 0m,
                FuelPercentage = c.SubContractorFuelPercentage ?? 0m,
                BonusPercentage = c.SubContractorBonusPercentage ?? 0m,
                Active = c.Active,
            })
            .ToListAsync(ct);
    }

    public async Task<CourierContractorDto> UpdateContractorAsync(int subId, CourierContractorUpdateDto dto, CancellationToken ct)
    {
        Validate(dto.Percentage, "Payment");
        Validate(dto.FuelPercentage, "Fuel");
        Validate(dto.BonusPercentage, "Bonus");

        var scope = await Require(ct);
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        // Ownership guard: the sub must belong to the logged-in master.
        var sub = await ctx.TucCouriers
            .FirstOrDefaultAsync(c => c.UccrId == subId && c.MasterCourierId == scope.CourierId, ct)
            ?? throw new CourierPortalException("That subcontractor isn't linked to your account.");

        sub.SubContractorPercentage = dto.Percentage;
        sub.SubContractorFuelPercentage = dto.FuelPercentage;
        sub.SubContractorBonusPercentage = dto.BonusPercentage;
        sub.LastModified = DateTime.UtcNow;
        sub.LastModifiedBy = scope.Email;
        await ctx.SaveChangesAsync(ct);

        return new CourierContractorDto
        {
            Id = sub.UccrId,
            Code = sub.Code,
            FirstName = sub.UccrName,
            Surname = sub.UccrSurname,
            Percentage = sub.SubContractorPercentage ?? 0m,
            FuelPercentage = sub.SubContractorFuelPercentage ?? 0m,
            BonusPercentage = sub.SubContractorBonusPercentage ?? 0m,
            Active = sub.Active,
        };
    }

    private static void Validate(decimal pct, string label)
    {
        if (pct < 0m || pct > 1m)
            throw new CourierPortalException($"{label} percentage must be between 0 and 100%.");
    }

    private async Task<CourierScope> Require(CancellationToken ct)
    {
        var scope = await scopeResolver.ResolveAsync(ct);
        if (scope == null) throw new CourierPortalException("No active courier record is linked to your account.");
        return scope;
    }
}
