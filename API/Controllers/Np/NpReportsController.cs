using System;
using System.Globalization;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// React frontend calls GET /api/v1/np/reports?from=YYYY-MM-DD&to=YYYY-MM-DD.
[Route("api/v1/np/reports")]
[ApiController]
[Authorize(Policy = "NetworkPartnerOrAdmin")]
public class NpReportsController(NpReportService npReportService) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> GetData([FromQuery] string? from, [FromQuery] string? to)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId} from={From} to={To}",
                Request.Method, Request.Path, messageId, from, to);

            // Default to the last 7 days if either bound is missing/unparseable —
            // the UI always sends both, but be defensive.
            var defaultTo = DateTime.Today;
            var defaultFrom = defaultTo.AddDays(-6);

            var fromDate = DateTime.TryParseExact(from, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedFrom)
                ? parsedFrom
                : defaultFrom;
            var toDate = DateTime.TryParseExact(to, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedTo)
                ? parsedTo
                : defaultTo;

            var response = await npReportService.GetData(fromDate, toDate, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Data);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch NP report data");
            throw;
        }
    }
}
