using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Courier;
using DfrntDriveConfigurator.Core.Application.Services.Courier;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.API.Controllers.Courier;

// Phase 2 — courier availability. Cookie-authed + CourierOnly; the courier acts
// only on their own responses (ICourierScopeResolver).
//
//   GET /api/v1/courier/schedule                  — my upcoming schedules
//   PUT /api/v1/courier/schedule/{id}/available   — mark available (+ slot)
//   PUT /api/v1/courier/schedule/{id}/unavailable — mark unavailable
[Route("api/v1/courier/schedule")]
[ApiController]
[Authorize(Policy = "CourierOnly")]
public class CourierScheduleController(CourierScheduleService service) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> Get(CancellationToken ct) =>
        Run(() => service.GetMyScheduleAsync(ct), "fetch courier schedule");

    [HttpPut("{id:long}/available")]
    public Task<IActionResult> Available(long id, [FromBody] CourierScheduleRespondDto dto, CancellationToken ct) =>
        Run(() => service.SetAvailableAsync(id, dto, ct), "mark available");

    [HttpPut("{id:long}/unavailable")]
    public Task<IActionResult> Unavailable(long id, CancellationToken ct) =>
        Run(() => service.SetUnavailableAsync(id, ct), "mark unavailable");

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
