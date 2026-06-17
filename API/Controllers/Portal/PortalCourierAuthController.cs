using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.API.Filters;
using DfrntDriveConfigurator.Core.Application.Dtos.Portal;
using DfrntDriveConfigurator.Core.Application.Services.Portal;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.API.Controllers.Portal;

// Courier Portal magic-link (Item 8.5). Anonymous redemption endpoint for the
// /drive/<slug>/<token> link: validates the opaque DB token and returns a signed
// courier session the SPA then carries as X-Portal-Token on /api/v1/courier/*
// (authenticated by PortalCourierAuthenticationHandler).
//
// [AllowAnonymous] + PortalRequestFilter, exactly like the applicant endpoints:
// the filter seeds the per-deployment tenant connection (503 when the portal
// isn't configured) so the tucCourier token lookup runs against the right DB.
[Route("api/portal/courier")]
[ApiController]
[AllowAnonymous]
[ServiceFilter(typeof(PortalRequestFilter))]
public class PortalCourierAuthController(PortalCourierService service) : ControllerBase
{
    [HttpPost("auth/validate")]
    public async Task<IActionResult> Validate([FromBody] PortalCourierDriveTokenDto dto, CancellationToken ct)
    {
        try
        {
            var session = await service.ValidateDriveTokenAsync(dto?.DriveToken, ct);
            if (session is null)
                return Unauthorized(new { message = "This link is invalid, expired, or has been revoked. Ask your operator for a new one." });
            return Ok(session);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to validate courier magic-link token");
            throw;
        }
    }
}
