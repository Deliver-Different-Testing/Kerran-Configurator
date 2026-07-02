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

// Courier Portal — anonymous courier authentication. Two ways in:
//   • Magic-link (Item 8.5): /drive/<slug>/<token> -> auth/validate.
//   • SMS 2FA / passwordless (modal §17b, PHASE1-SMS-AUTH native):
//       POST auth/sms/request-code  { mobile }        — send a 6-digit code
//       POST auth/sms/verify-code   { mobile, code }  — verify -> session token
//
// Both are [AllowAnonymous] + PortalRequestFilter: the filter seeds the
// per-deployment tenant connection (503 when the portal isn't configured) so the
// tucCourier lookups run against the right DB. On success each returns a signed
// courier session the SPA carries as X-Portal-Token on /api/v1/courier/*.
[Route("api/portal/courier")]
[ApiController]
[AllowAnonymous]
[ServiceFilter(typeof(PortalRequestFilter))]
public class PortalCourierAuthController(
    PortalCourierService service,
    CourierSmsAuthService smsAuth) : ControllerBase
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

    [HttpPost("auth/sms/request-code")]
    public Task<IActionResult> RequestSmsCode([FromBody] CourierSmsRequestCodeDto dto, CancellationToken ct) =>
        Run(() => smsAuth.RequestCodeAsync(dto?.Mobile ?? string.Empty, ClientIp(), ct), "request courier SMS code");

    [HttpPost("auth/sms/verify-code")]
    public Task<IActionResult> VerifySmsCode([FromBody] CourierSmsVerifyCodeDto dto, CancellationToken ct) =>
        Run(() => smsAuth.VerifyCodeAsync(dto?.Mobile ?? string.Empty, dto?.Code ?? string.Empty, ct), "verify courier SMS code");

    // ---- helpers ----------------------------------------------------------

    private string? ClientIp()
    {
        var fwd = Request.Headers["X-Forwarded-For"].ToString();
        if (!string.IsNullOrWhiteSpace(fwd))
            return fwd.Split(',')[0].Trim();
        return HttpContext.Connection.RemoteIpAddress?.ToString();
    }

    // PortalException -> 400; SmsRateLimitException -> 429 + Retry-After; else 500.
    private async Task<IActionResult> Run<T>(Func<Task<T>> action, string what)
    {
        try
        {
            return Ok(await action());
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
        catch (Exception ex)
        {
            Log.Error(ex, "Portal: failed to {What}", what);
            return StatusCode(500, new { message = "Something went wrong. Please try again." });
        }
    }
}
