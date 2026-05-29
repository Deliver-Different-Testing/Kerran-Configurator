using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Application.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Tenant;

// Recurring routes (Route Builder + Route Roster). Powers the tenant pages
// Routes / Route Roster under wwwroot/app/react/pages/tenant/. Tenant staff
// + DF admins can manage these. See docs/RECURRING-ROUTES-IMPLEMENTATION.md.
[Route("api/v1/tenant/routes")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class TenantRoutesController(TenantRouteService routeService) : BaseController
{
    // ─── Routes CRUD ──────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await routeService.GetAll(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Routes);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch tenant routes");
            throw;
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TenantRouteUpsertDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await routeService.CreateAsync(dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Route);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to create tenant route");
            throw;
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] TenantRouteUpsertDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await routeService.UpdateAsync(id, dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Route);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to update tenant route {Id}", id);
            throw;
        }
    }

    // Soft-delete (Active = 0). Hard delete is intentionally NOT exposed —
    // tucJobBooking.RouteId FK depends on Routes existing.
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> SoftDelete(int id)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await routeService.SoftDeleteAsync(id, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Route);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to soft-delete tenant route {Id}", id);
            throw;
        }
    }

    // Assignable targets for the route-default Assign picker (Courier /
    // Agent / NP). Relative route → /api/v1/tenant/routes/assignable-targets.
    [HttpGet("assignable-targets")]
    public async Task<IActionResult> AssignableTargets()
    {
        try
        {
            var messageId = Guid.NewGuid();
            var response = await routeService.GetAssignableTargetsAsync(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(new { couriers = response.Couriers, agents = response.Agents, nps = response.Nps });
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to load assignable targets");
            throw;
        }
    }

    // ─── Roster (per-route sub-resource) ──────────────────────────────

    [HttpGet("{routeId:int}/roster")]
    public async Task<IActionResult> GetRoster(int routeId)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await routeService.GetRosterAsync(routeId, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Entries);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch roster for route {RouteId}", routeId);
            throw;
        }
    }

    [HttpPost("{routeId:int}/roster")]
    public async Task<IActionResult> CreateRoster(int routeId, [FromBody] TenantRouteRosterUpsertDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await routeService.CreateRosterAsync(routeId, dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Entry);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to create roster entry for route {RouteId}", routeId);
            throw;
        }
    }

    [HttpDelete("{routeId:int}/roster/{rosterId:int}")]
    public async Task<IActionResult> DeleteRoster(int routeId, int rosterId)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await routeService.DeleteRosterAsync(routeId, rosterId, messageId);
            if (!response.Success) return BadRequest(response);
            return NoContent();
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to delete roster entry {RosterId} on route {RouteId}", rosterId, routeId);
            throw;
        }
    }

    // ─── Zipcode lookup (autocomplete for the Route Editor) ───────────

    [HttpGet("/api/v1/tenant/zipcodes/search")]
    public async Task<IActionResult> SearchZipcodes([FromQuery] string q)
    {
        try
        {
            var messageId = Guid.NewGuid();
            var response = await routeService.SearchZipcodesAsync(q ?? string.Empty, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Zipcodes);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed zipcode lookup q={Q}", q);
            throw;
        }
    }

    // ─── Courier lookup (for default-courier + roster dropdowns) ──────

    [HttpGet("/api/v1/tenant/couriers/lookup")]
    public async Task<IActionResult> CouriersLookup()
    {
        try
        {
            var messageId = Guid.NewGuid();
            var response = await routeService.GetCouriersLookupAsync(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Couriers);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed courier lookup");
            throw;
        }
    }
}
