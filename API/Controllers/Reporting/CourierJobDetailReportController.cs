using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Reporting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Reporting;

// "Jobs by Courier by Day - Detail" — ported from AdminManager / the courier
// portal. Returns a generated PDF or Excel file. DF Admin + Tenant staff; the
// courier is NP-scoped in the service. Dates default to the current month.
//   GET /api/v1/reporting/courier-job-detail?courierId=&from=&to=&format=PDF|EXCEL&fileName=
[Route("api/v1/reporting/courier-job-detail")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class CourierJobDetailReportController(CourierJobDetailReportService service) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] int? courierId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string format = "PDF",
        [FromQuery] string? fileName = null,
        CancellationToken ct = default)
    {
        var start = from ?? new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
        var end = to ?? start.AddMonths(1).AddDays(-1);

        try
        {
            Log.Information("({Method} {Path}) courier {CourierId} {Start:yyyy-MM-dd}..{End:yyyy-MM-dd} {Format}",
                Request.Method, Request.Path, courierId, start, end, format);

            var (content, contentType, ext) = await service.GenerateAsync(courierId, start, end, format, ct);

            var name = string.IsNullOrWhiteSpace(fileName) ? "Jobs by Courier by Day - Detail" : fileName.Trim();
            if (!name.EndsWith(ext, StringComparison.OrdinalIgnoreCase)) name += ext;

            return File(content, contentType, name);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to generate Courier Job Detail report for courier {CourierId}", courierId);
            throw;
        }
    }
}
