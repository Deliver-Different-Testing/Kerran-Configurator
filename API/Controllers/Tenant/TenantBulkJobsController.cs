using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Application.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Tenant;

// Bulk-job drill-down + Speed editing behind the Mapped Stops column
// (Recurring Routes spec §5). Speed is the only mutable field in v1.
//
// NOTE: the spec's finer `update-bulk-job` permission gate is intentionally
// NOT applied yet — that permission key isn't seeded in dbo.Permission /
// RolePermission, so a [RequirePermission] filter would deny-by-default for all
// tenant staff. Gated at policy level (TenantStaffOrAdmin) like the sibling
// linehaul endpoints until the perm is seeded (follow-up).
[Route("api/v1/tenant/bulk-jobs")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class TenantBulkJobsController(TenantBulkJobService service) : BaseController
{
    // Drill-down list for a linehaul run's Mapped Stops.
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int? linehaulRunId)
    {
        try
        {
            if (linehaulRunId is null or <= 0)
                return BadRequest(new { message = "linehaulRunId is required." });
            return Ok(await service.ListForLinehaulRunAsync(linehaulRunId.Value));
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to list bulk jobs for linehaul run {RunId}", linehaulRunId);
            throw;
        }
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        try
        {
            var dto = await service.GetDetailAsync(id);
            return dto is null ? NotFound() : Ok(dto);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch bulk job {Id}", id);
            throw;
        }
    }

    [HttpPut("{id:int}/speed")]
    public async Task<IActionResult> UpdateSpeed(int id, [FromBody] UpdateBulkJobSpeedDto dto)
    {
        try
        {
            var result = await service.UpdateSpeedAsync(id, dto.SpeedId);
            if (result.NotFound) return NotFound();
            if (result.InvalidSpeed) return BadRequest(new { message = "That speed is not valid for this tenant." });
            if (result.StatusLocked) return Conflict(new { message = "Speed can't be changed once a job is delivered or cancelled." });
            return Ok(result.Dto);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to update speed on bulk job {Id}", id);
            throw;
        }
    }
}
