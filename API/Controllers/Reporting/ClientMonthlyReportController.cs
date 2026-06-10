using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Reporting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Reporting;

// Client Monthly Report — ported from AdminManager. Returns a generated PDF or
// Excel file. DF Admin + Tenant staff; the client is NP-scoped in the service.
//   GET /api/v1/reporting/client-monthly?clientId=&from=&to=&format=PDF|EXCEL&fileName=
// Dates default to the current month when omitted (mirrors AdminManager).
[Route("api/v1/reporting/client-monthly")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class ClientMonthlyReportController(ClientMonthlyReportService service) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] int? clientId,
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
            Log.Information("({Method} {Path}) client {ClientId} {Start:yyyy-MM-dd}..{End:yyyy-MM-dd} {Format}",
                Request.Method, Request.Path, clientId, start, end, format);

            var (content, contentType, ext) = await service.GenerateAsync(clientId, start, end, format, ct);

            var name = string.IsNullOrWhiteSpace(fileName) ? "Client Monthly Report" : fileName.Trim();
            if (!name.EndsWith(ext, StringComparison.OrdinalIgnoreCase)) name += ext;

            return File(content, contentType, name);
        }
        catch (InvalidOperationException ex)
        {
            // Out-of-scope / missing client / no tenant claim — surface cleanly.
            return NotFound(new { error = ex.Message });
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to generate Client Monthly Report for client {ClientId}", clientId);
            throw;
        }
    }
}
