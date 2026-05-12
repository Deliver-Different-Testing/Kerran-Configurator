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
}
