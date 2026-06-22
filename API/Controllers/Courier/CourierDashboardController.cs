using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Courier;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.API.Controllers.Courier;

// Courier Portal (finish-line P0) — landing dashboard stats. Cookie-authed OR
// magic-link portal token (CourierOnly); the courier only ever sees their own
// numbers (scope enforced inside the delegate services).
//
//   GET /api/v1/courier/dashboard — at-a-glance tile stats
[Route("api/v1/courier/dashboard")]
[ApiController]
[Authorize(Policy = "CourierOnly")]
public class CourierDashboardController(CourierDashboardService service) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> Get(CancellationToken ct) =>
        Run(() => service.GetMyDashboardAsync(ct), "fetch courier dashboard");

    private async Task<IActionResult> Run<T>(Func<Task<T>> action, string what)
    {
        try { return Ok(await action()); }
        catch (CourierPortalException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex)
        {
            Log.Error(ex, "Courier: failed to {What}", what);
            return StatusCode(500, new { message = "Something went wrong. Please try again." });
        }
    }
}
