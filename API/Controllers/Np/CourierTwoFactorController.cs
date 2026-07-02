using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Portal;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

/// <summary>
/// Operator-facing courier 2FA surface for the courier modal Login &amp; Access
/// block (§17b). Read enrolment status + trigger a fresh SMS enrolment code to
/// the courier's mobile. Reuses the shared CourierSmsAuthService (same code
/// store / rate-limits as the anonymous portal sign-in). Tenant staff / DF admin
/// only.
/// </summary>
[Route("api/v1/np")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class CourierTwoFactorController(CourierSmsAuthService service) : BaseController
{
    [HttpGet("couriers/{id:int}/2fa/status")]
    public async Task<IActionResult> Status(int id, CancellationToken ct)
    {
        try
        {
            return Ok(await service.GetStatusAsync(id, ct));
        }
        catch (PortalException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to load 2FA status for courier {CourierId}", id);
            throw;
        }
    }

    [HttpPost("couriers/{id:int}/2fa/send-code")]
    public async Task<IActionResult> SendCode(int id, CancellationToken ct)
    {
        try
        {
            Log.Information("({Method} {Path})", Request.Method, Request.Path);
            return Ok(await service.SendEnrolmentCodeAsync(id, ClientIp(), ct));
        }
        catch (SmsRateLimitException ex)
        {
            Response.Headers["Retry-After"] = ex.RetryAfterSeconds.ToString(System.Globalization.CultureInfo.InvariantCulture);
            return StatusCode(429, new { message = ex.Message, retryAfterSeconds = ex.RetryAfterSeconds });
        }
        catch (PortalException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to send 2FA enrolment code for courier {CourierId}", id);
            throw;
        }
    }

    private string? ClientIp()
    {
        var fwd = Request.Headers["X-Forwarded-For"].ToString();
        if (!string.IsNullOrWhiteSpace(fwd))
            return fwd.Split(',')[0].Trim();
        return HttpContext.Connection.RemoteIpAddress?.ToString();
    }
}
