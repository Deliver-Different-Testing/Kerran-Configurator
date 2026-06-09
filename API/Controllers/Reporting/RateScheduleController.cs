using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Reporting;
using DfrntDriveConfigurator.Core.Application.Services.Reporting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Reporting;

// Client Reporting lane — Rate Schedule generation. Ported from the standalone
// clientcustomreportbuilder app. DF Admin + Tenant staff only (TenantStaffOrAdmin);
// client access is NP-scoped inside RateScheduleService.
//   POST /api/v1/reporting/rate-schedule/generate   — rate matrix for a client
//   POST /api/v1/reporting/rate-schedule/prospect    — ad-hoc multi-location quote
[Route("api/v1/reporting/rate-schedule")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class RateScheduleController(RateScheduleService rateScheduleService) : BaseController
{
    [HttpPost("generate")]
    public async Task<IActionResult> Generate([FromBody] RateScheduleRequest request, CancellationToken ct)
    {
        if (request == null) return BadRequest(new { error = "Request body is required." });
        if (request.ClientId <= 0) return BadRequest(new { error = "ClientId is required." });

        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}) client {ClientId}: {MessageId}", Request.Method, Request.Path, request.ClientId, messageId);

            var result = await rateScheduleService.GenerateAsync(request, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            // Covers both genuine not-found and out-of-NP-scope (indistinguishable by design).
            return NotFound(new { error = ex.Message });
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to generate rate schedule for client {ClientId}", request.ClientId);
            throw;
        }
    }

    [HttpPost("prospect")]
    public async Task<IActionResult> Prospect([FromBody] ProspectRateRequest request, CancellationToken ct)
    {
        if (request == null) return BadRequest(new { error = "Request body is required." });
        if (string.IsNullOrWhiteSpace(request.CompanyName)) return BadRequest(new { error = "CompanyName is required." });
        if (request.Locations == null || request.Locations.Count < 2)
            return BadRequest(new { error = "At least 2 locations are required." });

        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}) prospect {Company}: {MessageId}", Request.Method, Request.Path, request.CompanyName, messageId);

            var result = await rateScheduleService.GenerateProspectAsync(request, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to generate prospect rate schedule for {Company}", request.CompanyName);
            throw;
        }
    }
}
