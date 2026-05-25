using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Tenant;

// Read-only lookup feeds for tenant-side select dropdowns.
//   GET /api/v1/tenant/lookups/agent-statuses
//   GET /api/v1/tenant/lookups/agent-rankings
[Route("api/v1/tenant/lookups")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class TenantLookupController(TenantLookupService lookupService) : BaseController
{
    [HttpGet("agent-statuses")]
    public async Task<IActionResult> GetAgentStatuses()
    {
        try
        {
            var items = await lookupService.GetAgentStatuses();
            return Ok(items);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch agent-statuses lookup");
            throw;
        }
    }

    [HttpGet("agent-rankings")]
    public async Task<IActionResult> GetAgentRankings()
    {
        try
        {
            var items = await lookupService.GetAgentRankings();
            return Ok(items);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch agent-rankings lookup");
            throw;
        }
    }

    // Phase 5+27.1 — client-type picker feed for Add/Edit Agent modal.
    [HttpGet("client-types")]
    public async Task<IActionResult> GetClientTypes()
    {
        try
        {
            var items = await lookupService.GetClientTypes();
            return Ok(items);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch client-types lookup");
            throw;
        }
    }

    // Phase 5+29a §C — coverage-area city autocomplete.
    // GET /api/v1/tenant/lookups/cities?q=Sacr&state=CA
    [HttpGet("cities")]
    public async Task<IActionResult> GetCities([FromQuery] string q, [FromQuery] string? state)
    {
        try
        {
            var items = await lookupService.GetCitiesAsync(q, state);
            return Ok(items);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch cities lookup (q={Q}, state={State})", q, state);
            throw;
        }
    }

    // Phase 5+29a §C — resolve a city to its ZipPolygon rows.
    // GET /api/v1/tenant/lookups/zipcodes-by-city?city=Sacramento&state=CA
    [HttpGet("zipcodes-by-city")]
    public async Task<IActionResult> GetZipcodesByCity([FromQuery] string city, [FromQuery] string? state)
    {
        try
        {
            var items = await lookupService.GetZipPolygonsByCityAsync(city, state);
            return Ok(items);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch zipcodes-by-city lookup (city={City}, state={State})", city, state);
            throw;
        }
    }
}
