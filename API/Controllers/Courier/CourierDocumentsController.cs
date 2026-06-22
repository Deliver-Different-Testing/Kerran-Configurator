using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Courier;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.API.Controllers.Courier;

// Courier Portal (finish-line P0) — courier self-service documents. Cookie-authed
// (Hub shared cookie) OR magic-link portal token; the CourierOnly policy + the
// PortalCourierAuthenticationHandler both land on ICourierScopeResolver, so the
// courier only ever sees/uploads against their own row. State-changing calls
// carry X-Requested-With (CSRF middleware); the courier_api axios sends it.
//
//   GET  /api/v1/courier/documents                 — my required-docs checklist
//   POST /api/v1/courier/documents                 — upload/replace one doc (multipart)
//   GET  /api/v1/courier/documents/{id}/download   — proxy-download my own file
[Route("api/v1/courier/documents")]
[ApiController]
[Authorize(Policy = "CourierOnly")]
public class CourierDocumentsController(CourierDocumentsService service) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> List(CancellationToken ct) =>
        Run(() => service.GetMyDocumentsAsync(ct), "list courier documents");

    [HttpPost]
    [RequestSizeLimit(25 * 1024 * 1024)]  // 25 MB, mirrors the global maxFileSize in Program.cs
    public Task<IActionResult> Upload([FromForm] CourierPortalDocumentUploadForm form, CancellationToken ct) =>
        Run(async () =>
        {
            if (form?.File is null || form.File.Length == 0)
                throw new CourierPortalException("A file is required.");

            await using var stream = form.File.OpenReadStream();
            return await service.UploadAsync(
                form.DocumentTypeId,
                stream,
                form.File.FileName,
                form.File.ContentType,
                form.File.Length,
                ct);
        }, "upload courier document");

    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int id, CancellationToken ct)
    {
        try
        {
            var result = await service.GetForDownloadAsync(id, ct);
            if (result is null) return NotFound();

            // ?inline=true → Content-Disposition: inline so the portal can render
            // PDFs/images in a new tab; default is attachment.
            var inline = string.Equals(Request.Query["inline"], "true", StringComparison.OrdinalIgnoreCase);
            if (inline)
            {
                Response.Headers["Content-Disposition"] = $"inline; filename=\"{result.FileName}\"";
                return File(result.Content, result.ContentType);
            }

            return File(result.Content, result.ContentType, result.FileName);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Courier: failed to download document {Id}", id);
            return StatusCode(500, new { message = "Something went wrong. Please try again." });
        }
    }

    private async Task<IActionResult> Run<T>(Func<Task<T>> action, string what)
    {
        try { return Ok(await action()); }
        catch (CourierPortalException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex)
        {
            Log.Error(ex, "Courier: failed to {What}", what);
            return StatusCode(500, new { message = "Something went wrong. Please try again." });
        }
    }
}

/// <summary>
/// Multipart upload form binding — HTTP-shape only (mirrors the NP-side
/// <c>CourierDocumentUploadForm</c>). Couriers don't set expiry on upload; the
/// AI reviewer suggests it and staff confirm it on verify.
/// </summary>
public class CourierPortalDocumentUploadForm
{
    public IFormFile? File { get; set; }
    public int DocumentTypeId { get; set; }
}
