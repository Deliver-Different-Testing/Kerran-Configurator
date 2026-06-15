using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Courier;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Courier;

// Thrown for courier-facing failures; controller maps to 400/404 { message }.
public class CourierPortalException(string message) : Exception(message);

// Phase 2 — courier self-service profile read/update against TucCourier.
// The current courier is resolved by ICourierScopeResolver (email->TucCourier);
// a courier can only ever see/edit their OWN row.
public class CourierProfileService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    ICourierScopeResolver scopeResolver)
{
    public async Task<CourierProfileDto> GetMyProfileAsync(CancellationToken ct)
    {
        var scope = await Require(ct);
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var c = await ctx.TucCouriers.FirstOrDefaultAsync(x => x.UccrId == scope.CourierId, ct)
                ?? throw new CourierPortalException("Courier record not found.");
        return MapToDto(c);
    }

    public async Task<CourierProfileDto> UpdateMyProfileAsync(CourierProfileUpdateDto dto, CancellationToken ct)
    {
        var scope = await Require(ct);
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var c = await ctx.TucCouriers.FirstOrDefaultAsync(x => x.UccrId == scope.CourierId, ct)
                ?? throw new CourierPortalException("Courier record not found.");

        if (string.IsNullOrWhiteSpace(dto.FirstName)) throw new CourierPortalException("First name is required.");
        if (string.IsNullOrWhiteSpace(dto.Surname)) throw new CourierPortalException("Surname is required.");

        c.UccrName = dto.FirstName.Trim();
        c.UccrSurname = dto.Surname.Trim();
        c.UccrTel = dto.Phone;
        c.PersonalMobile = dto.Mobile;
        c.UccrEmail = dto.Email;
        c.AddressLine1 = dto.AddressLine1;
        c.AddressLine2 = dto.AddressLine2;
        c.AddressLine3 = dto.AddressLine3;
        c.AddressLine4 = dto.AddressLine4;
        c.AddressLine5 = dto.AddressLine5;
        c.AddressLine6 = dto.AddressLine6;
        c.AddressLine7 = dto.AddressLine7;
        c.AddressLine8 = dto.AddressLine8;
        c.UccrDlno = dto.DriversLicenceNo;
        c.UccrReg = dto.VehicleRegistrationNo;
        c.BankRoutingNumber = dto.BankRoutingNumber;
        c.UccrBankAccountNo = dto.BankAccountNo;
        c.UccrGst = dto.TaxNo;
        c.LastModified = DateTime.UtcNow;
        c.LastModifiedBy = scope.Email;

        try
        {
            await ctx.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // tucCourier has a unique (UccrName, UccrSurname) index; a name clash
            // with another courier surfaces here. Legacy worked around this by
            // appending "." to the surname — we surface a clean message instead.
            throw new CourierPortalException("Another courier already has that name. Please adjust and try again.");
        }

        return MapToDto(c);
    }

    private async Task<CourierScope> Require(CancellationToken ct)
    {
        var scope = await scopeResolver.ResolveAsync(ct);
        if (scope == null)
            throw new CourierPortalException("No active courier record is linked to your account.");
        return scope;
    }

    private static CourierProfileDto MapToDto(TucCourier c) => new()
    {
        Id = c.UccrId,
        Code = c.Code,
        FirstName = c.UccrName,
        Surname = c.UccrSurname,
        Phone = c.UccrTel,
        Mobile = c.PersonalMobile,
        Email = c.UccrEmail,
        AddressLine1 = c.AddressLine1,
        AddressLine2 = c.AddressLine2,
        AddressLine3 = c.AddressLine3,
        AddressLine4 = c.AddressLine4,
        AddressLine5 = c.AddressLine5,
        AddressLine6 = c.AddressLine6,
        AddressLine7 = c.AddressLine7,
        AddressLine8 = c.AddressLine8,
        DriversLicenceNo = c.UccrDlno,
        VehicleRegistrationNo = c.UccrReg,
        BankRoutingNumber = c.BankRoutingNumber,
        BankAccountNo = c.UccrBankAccountNo,
        TaxNo = c.UccrGst,
        CourierTypeId = c.CourierTypeId,
        IsMaster = c.MasterCourierId == null,
    };
}
