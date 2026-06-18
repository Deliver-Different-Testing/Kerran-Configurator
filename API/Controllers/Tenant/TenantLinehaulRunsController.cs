using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Application.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Tenant;

// Linehaul (depot-to-depot middle-mile) runs — the Linehaul tab on the tenant
// Recurring Routes page (spec §3). Full inline CRUD over tblbulkLinehaulRun,
// native EF (no DespatchWeb / ClientManager hops at runtime). Tenant staff +
// DF admins, same policy as the Routes tab.
[Route("api/v1/tenant/linehaul-runs")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class TenantLinehaulRunsController(TenantLinehaulService service) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            return Ok(await service.ListAsync());
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to list linehaul runs");
            throw;
        }
    }

    // Depot + courier dropdowns for the edit panel. Declared with the {id:int}
    // constraint on the sibling routes so "lookups" never binds as an id.
    [HttpGet("lookups")]
    public async Task<IActionResult> GetLookups()
    {
        try
        {
            return Ok(await service.GetLookupsAsync());
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to load linehaul lookups");
            throw;
        }
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        try
        {
            var dto = await service.GetAsync(id);
            return dto is null ? NotFound() : Ok(dto);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch linehaul run {Id}", id);
            throw;
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TenantLinehaulRunUpsertDto dto)
    {
        try
        {
            return Map(await service.CreateAsync(dto));
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to create linehaul run");
            throw;
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] TenantLinehaulRunUpsertDto dto)
    {
        try
        {
            return Map(await service.UpdateAsync(id, dto));
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to update linehaul run {Id}", id);
            throw;
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            return Map(await service.DeleteAsync(id));
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to delete linehaul run {Id}", id);
            throw;
        }
    }

    // Schedules binding this run (Fixes §7 — "Used by Schedules" drill-down).
    [HttpGet("{id:int}/schedules")]
    public async Task<IActionResult> GetSchedules(int id)
    {
        try
        {
            return Ok(await service.GetScheduleBindingsAsync(id));
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to load schedules for linehaul run {Id}", id);
            throw;
        }
    }

    [HttpPost("{id:int}/copy")]
    public async Task<IActionResult> Copy(int id)
    {
        try
        {
            return Map(await service.CopyAsync(id));
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to copy linehaul run {Id}", id);
            throw;
        }
    }

    private IActionResult Map(TenantLinehaulMutationResult result)
    {
        if (result.NotFound) return NotFound();
        if (result.BlockedBySchedules)
            return Conflict(new { message = "Remove this run from its active schedule(s) before deleting." });
        if (result.ValidationError is not null)
            return BadRequest(new { message = result.ValidationError });
        return result.Dto is null ? Ok(new { success = true }) : Ok(result.Dto);
    }
}
