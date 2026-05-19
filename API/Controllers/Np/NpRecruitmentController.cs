using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// Recruitment pipeline — read side (Slice A).
//   GET /api/v1/np/recruitment/applicants        — applicant list
//   GET /api/v1/np/recruitment/applicants/{id}   — single applicant
//   GET /api/v1/np/recruitment/pipeline-summary  — stage counts
// Mutating actions (advance / approve / reject) are a later slice.
[Route("api/v1/np/recruitment")]
[ApiController]
[Authorize(Policy = "NetworkPartnerOrAdmin")]
public class NpRecruitmentController(NpApplicantService service) : BaseController
{
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
}
