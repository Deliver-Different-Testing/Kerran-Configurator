using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Portal;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Portal;

// Courier Portal magic-link (Item 8.5) — redeems the opaque DB magic-link token
// for a signed courier session. Runs in the anonymous portal lane: the
// PortalRequestFilter has already seeded the per-deployment tenant connection,
// so the tucCourier lookup hits the right tenant DB.
public class PortalCourierService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    PortalCourierSessionTokenService tokenService,
    IPortalTenantContext portalTenant)
{
    // Returns a session (token + thin profile) when the magic-link token maps to
    // an active courier and hasn't expired; null on any failure (invalid /
    // revoked / expired / inactive) — the controller surfaces a single generic
    // "ask your operator for a new link" message so we don't leak which.
    public async Task<PortalCourierSessionDto?> ValidateDriveTokenAsync(string? driveToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(driveToken)) return null;

        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var courier = await ctx.TucCouriers
            .FirstOrDefaultAsync(c => c.PortalAccessToken == driveToken, ct);

        if (courier is null || !courier.Active)
        {
            Log.Warning("Courier magic-link rejected: no active courier for the supplied token.");
            return null;
        }
        if (CourierPortalLink.IsExpired(courier.PortalTokenIssuedAt))
        {
            Log.Warning("Courier magic-link rejected: token for courier {CourierId} is past its 90-day expiry.", courier.UccrId);
            return null;
        }

        courier.PortalTokenLastUsedAt = DateTime.UtcNow;
        await ctx.SaveChangesAsync(ct);

        var token = tokenService.Issue(portalTenant.TenantId, courier.UccrId);
        Log.Information("Courier magic-link redeemed: issued session for courier {CourierId}.", courier.UccrId);

        return new PortalCourierSessionDto
        {
            Token = token,
            Expires = DateTime.UtcNow.Add(PortalCourierSessionTokenService.TokenLifetime),
            Courier = new PortalCourierProfileDto
            {
                Id = courier.UccrId,
                Code = courier.Code ?? string.Empty,
                FirstName = courier.UccrName ?? string.Empty,
                SurName = courier.UccrSurname ?? string.Empty,
                Email = courier.UccrEmail ?? string.Empty,
                Phone = courier.UccrMobile ?? string.Empty,
            },
        };
    }
}
