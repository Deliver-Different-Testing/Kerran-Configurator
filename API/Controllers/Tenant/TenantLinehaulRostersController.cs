using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Application.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Tenant;

// Linehaul Roster — the Run × Day driver grid (Recurring Routes spec §4).
// Courier-only weekly rostering over Dispatch_LinehaulRunRoster. The run's own
// default driver (tblbulkLinehaulRun.CourierId) is never mutated here.
[Route("api/v1/tenant/linehaul-rosters")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class TenantLinehaulRostersController(TenantLinehaulService service) : BaseController
{
    // weekStart is accepted for forward-compat (v1.1 date overrides); v1 returns
    // the recurring weekly grid regardless.
    [HttpGet]
    public async Task<IActionResult> GetGrid([FromQuery] string? weekStart = null)
    {
        try
        {
            _ = weekStart;
            return Ok(await service.GetRosterGridAsync());
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to load linehaul roster grid");
            throw;
        }
    }

    [HttpPut]
    public async Task<IActionResult> Upsert([FromBody] LinehaulRosterUpsertDto dto)
    {
        try
        {
            var cell = await service.UpsertRosterCellAsync(dto);
            return cell is null
                ? BadRequest(new { message = "Invalid roster cell (run, day-of-week 1-7, and courier are required)." })
                : Ok(cell);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to upsert linehaul roster cell");
            throw;
        }
    }

    [HttpDelete("{rosterId:int}")]
    public async Task<IActionResult> Delete(int rosterId)
    {
        try
        {
            var ok = await service.DeleteRosterCellAsync(rosterId);
            return ok ? Ok(new { success = true }) : NotFound();
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to delete linehaul roster cell {RosterId}", rosterId);
            throw;
        }
    }
}
