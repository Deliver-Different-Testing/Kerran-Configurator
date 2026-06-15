using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Courier;
using DfrntDriveConfigurator.Core.Application.Services.Courier;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.API.Controllers.Courier;

// Phase 2 — My Runs. Cookie-authed + CourierOnly; the courier only ever sees
// their own runs (the CP_* procs are parameterised by the resolved courier id).
//
//   GET  /api/v1/courier/runs                         — current + past runs
//   GET  /api/v1/courier/runs/detail?bookDate=&runName= — one run's detail
//   POST /api/v1/courier/runs/enquiry                 — email dispatch about a job
//
// Run detail uses query params (not route segments) because RunName is free text
// and can contain slashes/spaces.
[Route("api/v1/courier/runs")]
[ApiController]
[Authorize(Policy = "CourierOnly")]
public class CourierRunsController(CourierRunsService service) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> Get(CancellationToken ct) =>
        Run(() => service.GetMyRunsAsync(ct), "fetch courier runs");

    [HttpGet("detail")]
    public Task<IActionResult> Detail([FromQuery] DateTime bookDate, [FromQuery] string runName, CancellationToken ct) =>
        Run(() => service.GetMyRunAsync(bookDate, runName, ct), "fetch courier run detail");

    [HttpPost("enquiry")]
    public Task<IActionResult> Enquiry([FromBody] CourierEnquiryDto dto, CancellationToken ct) =>
        Run(async () => { await service.SendEnquiryAsync(dto, ct); return new { sent = true }; }, "send run enquiry");

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
