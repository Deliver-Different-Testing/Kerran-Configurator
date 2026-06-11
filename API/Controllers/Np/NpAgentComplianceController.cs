using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

/// <summary>
/// Agent / NP business-document compliance aggregates — feeds the Compliance Hub
/// Agent/NP tab + the per-agent "Partner workspace" scorecard. Computed live
/// against the NP DocumentTypes + tucAgentDocument with onboarding carry-through.
/// Sibling to <c>NpComplianceController</c> (the courier/driver side).
/// </summary>
[Route("api/v1/np/compliance")]
[ApiController]
// Tenant-wide aggregates (dashboard / roster / per-agent scorecards across the
// whole tenant) — NPs must NOT see these (Steve security log Issue 1). NoNp
// rejects Network Partner sessions; they use NpComplianceController (their own
// driver compliance) + /np/my-documents (self-upload) instead.
[Authorize(Policy = "TenantStaffOrAdminNoNp")]
public class NpAgentComplianceController(NpAgentComplianceService service) : BaseController
{
    [HttpGet("agents/dashboard")]
    public async Task<IActionResult> Dashboard()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);
            var response = await service.GetDashboard(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Dashboard);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to build agent compliance dashboard");
            throw;
        }
    }

    [HttpGet("agents/roster")]
    public async Task<IActionResult> Roster()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);
            var response = await service.GetRoster(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Roster);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to build agent compliance roster");
            throw;
        }
    }

    [HttpGet("agents/{id:int}")]
    public async Task<IActionResult> Detail(int id)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);
            var response = await service.GetDetail(id, messageId);
            if (!response.Success) return BadRequest(response);
            if (response.Detail is null) return NotFound();
            return Ok(response.Detail);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to build agent compliance detail for {AgentId}", id);
            throw;
        }
    }

    [HttpGet("onboarding/summary")]
    public async Task<IActionResult> OnboardingSummary()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);
            var response = await service.GetOnboardingSummary(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Summary);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to build agent onboarding compliance summary");
            throw;
        }
    }
}
