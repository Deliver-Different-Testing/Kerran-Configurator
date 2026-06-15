using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Courier;
using DfrntDriveConfigurator.Core.Application.Services.Courier;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.API.Controllers.Courier;

// Phase 2 — courier self-service. Cookie-authed (Hub shared cookie) + the
// CourierOnly policy (IsCourier claim). Tenant DB is resolved the normal
// claim-driven way (CurrentTenantID), and the courier can only ever touch their
// own row (ICourierScopeResolver). State-changing calls carry X-Requested-With
// (CSRF middleware); the courier_api axios sends it.
//
//   GET /api/v1/courier/profile  — my profile
//   PUT /api/v1/courier/profile  — update my profile
[Route("api/v1/courier/profile")]
[ApiController]
[Authorize(Policy = "CourierOnly")]
public class CourierProfileController(CourierProfileService service) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> Get(CancellationToken ct) =>
        Run(() => service.GetMyProfileAsync(ct), "fetch courier profile");

    [HttpPut]
    public Task<IActionResult> Update([FromBody] CourierProfileUpdateDto dto, CancellationToken ct) =>
        Run(() => service.UpdateMyProfileAsync(dto, ct), "update courier profile");

    private async Task<IActionResult> Run<T>(Func<Task<T>> action, string what)
    {
        try
        {
            return Ok(await action());
        }
        catch (CourierPortalException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Courier: failed to {What}", what);
            return StatusCode(500, new { message = "Something went wrong. Please try again." });
        }
    }
}
