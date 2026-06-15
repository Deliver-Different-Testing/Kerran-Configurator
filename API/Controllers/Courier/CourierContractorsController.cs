using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Courier;
using DfrntDriveConfigurator.Core.Application.Services.Courier;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.API.Controllers.Courier;

// Phase 2 — master courier's subcontractor split management. Cookie-authed +
// CourierOnly; ownership enforced in the service (sub.MasterCourierId == me).
//
//   GET /api/v1/courier/contractors        — my subcontractors
//   PUT /api/v1/courier/contractors/{id}   — update a sub's split %
[Route("api/v1/courier/contractors")]
[ApiController]
[Authorize(Policy = "CourierOnly")]
public class CourierContractorsController(CourierContractorsService service) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> Get(CancellationToken ct) =>
        Run(() => service.GetMyContractorsAsync(ct), "fetch contractors");

    [HttpPut("{id:int}")]
    public Task<IActionResult> Update(int id, [FromBody] CourierContractorUpdateDto dto, CancellationToken ct) =>
        Run(() => service.UpdateContractorAsync(id, dto, ct), "update contractor");

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
