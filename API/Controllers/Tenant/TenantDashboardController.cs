using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Tenant;

// Backs the metric tiles on the React Tenant Dashboard at /.
//   GET /api/v1/tenant/dashboard — returns the 5 stat values as one envelope.
[Route("api/v1/tenant/dashboard")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class TenantDashboardController(TenantDashboardService dashboardService) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> GetStats()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await dashboardService.GetStats(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Stats);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch tenant dashboard stats");
            throw;
        }
    }
}
