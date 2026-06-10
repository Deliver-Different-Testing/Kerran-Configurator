using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Reporting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Reporting;

// Lookup feeds for the Rate Schedule picker UI (client search, sites, speeds,
// suburbs). DF Admin + Tenant staff; client search is NP-scoped in the service.
//   GET /api/v1/reporting/clients?q=&limit=
//   GET /api/v1/reporting/sites
//   GET /api/v1/reporting/speeds
//   GET /api/v1/reporting/suburbs?siteId=
[Route("api/v1/reporting")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class ReportingLookupController(ReportingLookupService lookupService) : BaseController
{
    [HttpGet("clients")]
    public async Task<IActionResult> SearchClients([FromQuery] string? q, [FromQuery] int limit = 20, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            return Ok(Array.Empty<object>());

        try
        {
            var results = await lookupService.SearchClientsAsync(q.Trim(), limit, ct);
            return Ok(results);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to search reporting clients for term {Term}", q);
            throw;
        }
    }

    [HttpGet("couriers")]
    public async Task<IActionResult> SearchCouriers([FromQuery] string? q, [FromQuery] int limit = 20, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            return Ok(Array.Empty<object>());

        try
        {
            var results = await lookupService.SearchCouriersAsync(q.Trim(), limit, ct);
            return Ok(results);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to search reporting couriers for term {Term}", q);
            throw;
        }
    }

    [HttpGet("sites")]
    public async Task<IActionResult> GetSites(CancellationToken ct)
    {
        try
        {
            var results = await lookupService.GetSitesAsync(ct);
            return Ok(results);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch reporting sites");
            throw;
        }
    }

    [HttpGet("speeds")]
    public async Task<IActionResult> GetSpeeds(CancellationToken ct)
    {
        try
        {
            var results = await lookupService.GetSpeedsAsync(ct);
            return Ok(results);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch reporting speeds");
            throw;
        }
    }

    [HttpGet("suburbs")]
    public async Task<IActionResult> GetSuburbs([FromQuery] int siteId, CancellationToken ct)
    {
        if (siteId <= 0) return BadRequest(new { error = "siteId is required." });

        try
        {
            var results = await lookupService.GetSuburbsBySiteAsync(siteId, ct);
            return Ok(results);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch reporting suburbs for site {SiteId}", siteId);
            throw;
        }
    }
}
