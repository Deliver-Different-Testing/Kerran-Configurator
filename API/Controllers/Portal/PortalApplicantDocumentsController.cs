using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.API.Filters;
using DfrntDriveConfigurator.Core.Application.Services.Portal;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.API.Controllers.Portal;

// Courier Portal P3 (Slice B) — applicant self-service documents. Signed-token
// auth (PortalRequestFilter + [PortalAuthorize] → applicant id on HttpContext.Items).
// Uploads land in the unified CourierDocuments table with ApplicantId set.
//
//   GET    /api/portal/applicants/documents              — my required docs + status
//   POST   /api/portal/applicants/documents              — upload (multipart)
//   GET    /api/portal/applicants/documents/{id}/download — my doc bytes
[Route("api/portal/applicants/documents")]
[ApiController]
[AllowAnonymous]
[ServiceFilter(typeof(PortalRequestFilter))]
public class PortalApplicantDocumentsController(PortalApplicantDocumentService service) : ControllerBase
{
    [HttpGet]
    [PortalAuthorize]
    public Task<IActionResult> List(CancellationToken ct) =>
        Run(() => service.GetMyDocumentsAsync(ApplicantId(), ct), "list applicant documents");

    [HttpPost]
    [PortalAuthorize]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public Task<IActionResult> Upload([FromForm] PortalDocumentUploadForm form, CancellationToken ct) =>
        Run(async () =>
        {
            if (form?.File is null || form.File.Length == 0) throw new PortalException("A file is required.");
            await using var stream = form.File.OpenReadStream();
            return await service.UploadAsync(ApplicantId(), form.DocumentTypeId, stream,
                form.File.FileName, form.File.ContentType, form.File.Length, ct);
        }, "upload applicant document");

    [HttpGet("{id:int}/download")]
    [PortalAuthorize]
    public async Task<IActionResult> Download(int id, CancellationToken ct)
    {
        try
        {
            var result = await service.GetForDownloadAsync(ApplicantId(), id, ct);
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

    private int ApplicantId() =>
        HttpContext.Items[PortalRequestFilter.ApplicantIdItemsKey] is int id
            ? id
            : throw new InvalidOperationException("Applicant id missing — PortalAuthorize filter did not run.");

    private async Task<IActionResult> Run<T>(Func<Task<T>> action, string what)
    {
        try { return Ok(await action()); }
        catch (PortalException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex)
        {
            Log.Error(ex, "Portal: failed to {What}", what);
            return StatusCode(500, new { message = "Something went wrong. Please try again." });
        }
    }
}

public class PortalDocumentUploadForm
{
    public IFormFile File { get; set; }
    public int DocumentTypeId { get; set; }
}
