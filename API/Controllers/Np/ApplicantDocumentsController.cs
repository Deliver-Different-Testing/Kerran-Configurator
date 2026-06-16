using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.API.Controllers.Np;

// P3 (Slice B2) — staff/NP review of an applicant's uploaded documents (the
// unified CourierDocuments keyed by ApplicantId). Mirrors CourierDocumentsController
// but for the recruitment/applicant side.
//
//   GET /api/v1/np/recruitment/applicants/{applicantId}/documents
//   GET .../{id}/download[?inline=true]
//   PUT .../{id}/verify
//   PUT .../{id}/reject  { reason }
[Route("api/v1/np/recruitment/applicants/{applicantId:int}/documents")]
[ApiController]
[Authorize(Policy = "NetworkPartnerOrAdmin")]
public class ApplicantDocumentsController(ApplicantDocumentReviewService service) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> List(int applicantId, CancellationToken ct) =>
        Run(async () => (object)await service.ListAsync(applicantId, ct), "list applicant documents");

    [HttpPut("{id:int}/verify")]
    public Task<IActionResult> Verify(int id, CancellationToken ct) =>
        Run(async () => (object?)await service.VerifyAsync(id, ct), "verify applicant document");

    [HttpPut("{id:int}/reject")]
    public Task<IActionResult> Reject(int id, [FromBody] CourierDocumentRejectDto dto, CancellationToken ct) =>
        Run(async () => (object?)await service.RejectAsync(id, dto?.Reason ?? string.Empty, ct), "reject applicant document");

    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int id, CancellationToken ct)
    {
        try
        {
            var result = await service.GetForDownloadAsync(id, ct);
            if (result is null) return NotFound();
            var inline = string.Equals(Request.Query["inline"], "true", StringComparison.OrdinalIgnoreCase);
            if (inline)
            {
                Response.Headers["Content-Disposition"] = $"inline; filename=\"{result.FileName}\"";
                return File(result.Content, result.ContentType);
            }
            return File(result.Content, result.ContentType, result.FileName);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to download applicant document {Id}", id);
            throw;
        }
    }

    private async Task<IActionResult> Run<T>(Func<Task<T>> action, string what)
    {
        try
        {
            var result = await action();
            return result is null ? NotFound() : Ok(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Failed to {What}", what);
            return StatusCode(500, new { message = "Something went wrong. Please try again." });
        }
    }
}
