using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using DfrntDriveConfigurator.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// Recruitment pipeline — read side (Slice A).
//   GET /api/v1/np/recruitment/applicants        — applicant list
//   GET /api/v1/np/recruitment/applicants/{id}   — single applicant
//   GET /api/v1/np/recruitment/pipeline-summary  — stage counts
//   GET /api/v1/np/recruitment/portal-config     — applicant-portal slug/state
// Mutating actions (advance / approve / reject) are a later slice.
[Route("api/v1/np/recruitment")]
[ApiController]
[Authorize(Policy = "NetworkPartnerOrAdmin")]
public class NpRecruitmentController(NpApplicantService service, AppSettings appSettings) : BaseController
{
    // Item 2 — the deployment's real applicant-portal config so the Recruitment
    // Advertising page builds the actual apply URL (…/apply/{slug}) instead of a
    // hardcoded placeholder. The host/domain stays operator-editable on the page
    // (the portal may be served from a different deployment than this admin app).
    [HttpGet("portal-config")]
    public IActionResult GetPortalConfig() => Ok(new
    {
        slug = string.IsNullOrWhiteSpace(appSettings.PortalTenantSlug) ? "portal" : appSettings.PortalTenantSlug,
        portalEnabled = appSettings.PortalEnabled,
        applyPath = "/apply",
        displayName = appSettings.PortalDisplayName,
    });

    [HttpGet("applicants")]
    public async Task<IActionResult> GetApplicants()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.GetApplicants(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Applicants);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch applicants");
            throw;
        }
    }

    [HttpGet("applicants/{id:int}")]
    public async Task<IActionResult> GetApplicant(int id)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.GetById(id, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Applicant);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch applicant {Id}", id);
            throw;
        }
    }

    [HttpGet("pipeline-summary")]
    public async Task<IActionResult> GetPipelineSummary()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.GetPipelineSummary(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Summary);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch pipeline summary");
            throw;
        }
    }

    [HttpPut("applicants/{id:int}/advance")]
    public async Task<IActionResult> Advance(int id)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.AdvanceAsync(id, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Applicant);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to advance applicant {Id}", id);
            throw;
        }
    }

    [HttpPut("applicants/{id:int}/reject")]
    public async Task<IActionResult> Reject(int id, [FromBody] NpApplicantRejectDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.RejectAsync(id, dto.Reason, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Applicant);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to reject applicant {Id}", id);
            throw;
        }
    }

    [HttpPut("applicants/{id:int}/resubmit")]
    public async Task<IActionResult> Resubmit(int id)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.ResubmitAsync(id, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Applicant);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to resubmit applicant {Id}", id);
            throw;
        }
    }

    [HttpPost("applicants/{id:int}/approve")]
    public async Task<IActionResult> Approve(int id, [FromBody] NpApplicantApproveDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.ApproveAsync(id, dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Applicant);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to approve applicant {Id}", id);
            throw;
        }
    }
}
