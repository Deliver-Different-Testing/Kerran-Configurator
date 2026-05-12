using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// React frontend calls:
//   GET /api/v1/np/dashboard          → DashboardStats
//   GET /api/v1/np/dashboard/activity → ActivityFeedItem[]
[Route("api/v1/np/dashboard")]
[ApiController]
[Authorize(Policy = "NetworkPartnerOrAdmin")]
public class NpDashboardController(NpDashboardService npDashboardService) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> GetStats()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await npDashboardService.GetStats(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Stats);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch NP dashboard stats");
            throw;
        }
    }

    [HttpGet("activity")]
    public async Task<IActionResult> GetActivity()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await npDashboardService.GetActivityFeed(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Items);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch NP activity feed");
            throw;
        }
    }
}
