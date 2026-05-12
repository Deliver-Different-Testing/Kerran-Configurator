using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// React frontend calls GET /api/v1/np/compliance/dashboard for the dashboard
// widget. Future expansion: alerts, courier scores, drill-downs.
[Route("api/v1/np/compliance")]
[ApiController]
[Authorize(Policy = "NetworkPartnerOrAdmin")]
public class NpComplianceController(NpComplianceService npComplianceService) : BaseController
{
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await npComplianceService.GetDashboard(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Dashboard);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch NP compliance dashboard");
            throw;
        }
    }
}
