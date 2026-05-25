using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// ComplianceHub dashboard backend (Phase 5+25). The React ComplianceDashboard
// page calls all three endpoints:
//   GET /api/v1/np/compliance/dashboard          — summary counts + per-type
//                                                  breakdown + top-10 urgent alerts
//   GET /api/v1/np/compliance/alerts?...         — filterable per-doc alert list
//                                                  (powers the drill-down table)
//   GET /api/v1/np/compliance/score/{courierId}  — per-courier compliance score
//                                                  for the Driver tab
//
// All NP-scoped via INpScopeResolver in the service. The "Send Reminder"
// bulk-notify is intentionally NOT implemented here — the React handler is a
// placeholder; wiring it would route through the existing tucManualMessage
// outbox pattern (see QuoteNotificationService) and is a separate slice.
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

    [HttpGet("alerts")]
    public async Task<IActionResult> GetAlerts(
        [FromQuery] string? docType,
        [FromQuery] string? status,
        [FromQuery] string? courierName,
        [FromQuery] int? daysAhead)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await npComplianceService.GetAlerts(docType, status, courierName, daysAhead, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Alerts);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch NP compliance alerts");
            throw;
        }
    }

    [HttpGet("score/{courierId:int}")]
    public async Task<IActionResult> GetCourierScore(int courierId)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await npComplianceService.GetCourierScore(courierId, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Score);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch compliance score for courier {CourierId}", courierId);
            throw;
        }
    }
}
