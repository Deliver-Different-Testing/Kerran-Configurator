using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

/// <summary>
/// Compliance / training document instances against a courier. File bytes
/// are stored in S3 (bucket from <c>S3BucketComplianceUploads</c> env var);
/// metadata + lifecycle lives in the CourierDocuments table.
/// Download is proxied through the API so cookie-auth + audit are end-to-end.
/// </summary>
// Shared by the Tenant lane's "My Couriers" surface (CourierSetup Documents
// tab); TenantStaffOrAdmin admits tenant staff, who resolve tenant-wide via
// NpScopeResolver. CanAccessCourierAsync still gates per-courier access.
[Route("api/v1/np/couriers/{courierId:int}/documents")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class CourierDocumentsController(CourierDocumentService service) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> List(int courierId)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.ListAsync(courierId, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Documents);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to list documents for courier {CourierId}", courierId);
            throw;
        }
    }

    /// <summary>
    /// Multipart upload of a new courier document. File is streamed through
    /// the API to S3; only the metadata row + S3 key are persisted in the DB.
    /// </summary>
    [HttpPost]
    [RequestSizeLimit(25 * 1024 * 1024)]  // 25 MB, mirrors the global maxFileSize in Program.cs
    public async Task<IActionResult> Upload(int courierId, [FromForm] CourierDocumentUploadForm form)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            if (form?.File is null || form.File.Length == 0)
            {
                return BadRequest(new { error = "File is required." });
            }

            await using var stream = form.File.OpenReadStream();
            var response = await service.CreateAsync(
                courierId,
                form.DocumentTypeId,
                stream,
                form.File.FileName,
                form.File.ContentType,
                form.File.Length,
                form.ExpiryDate,
                messageId);

            if (!response.Success) return BadRequest(response);
            return Ok(response.Document);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to upload document for courier {CourierId}", courierId);
            throw;
        }
    }

    /// <summary>
    /// Proxy download — fetches the bytes from S3 and streams them back with
    /// the original filename + content type. ASP.NET Core's <c>File()</c>
    /// disposes the S3 response stream after the response writes.
    /// </summary>
    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int courierId, int id)
    {
        try
        {
            Log.Information("({Method} {Path})", Request.Method, Request.Path);

            // NOTE: courierId is in the URL for REST clarity, but the service
            // looks up by document id alone and re-checks scope against the
            // courier on the row. We don't enforce courierId == doc.CourierId
            // here; if a malicious client passes a mismatched pair, the
            // scope check still blocks them.
            var result = await service.GetForDownloadAsync(id);
            if (result is null) return NotFound();

            // ?inline=true → Content-Disposition: inline so the preview modal can
            // render PDFs/images in an <iframe>/<img>. Default is attachment.
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
            Log.Error(e, "Failed to download document {Id} for courier {CourierId}", id, courierId);
            throw;
        }
    }

    [HttpPut("{id:int}/verify")]
    public async Task<IActionResult> Verify(int courierId, int id)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.VerifyAsync(id, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Document);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to verify document {Id}", id);
            throw;
        }
    }

    [HttpPut("{id:int}/reject")]
    public async Task<IActionResult> Reject(int courierId, int id, [FromBody] CourierDocumentRejectDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.RejectAsync(id, dto?.Reason ?? string.Empty, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Document);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to reject document {Id}", id);
            throw;
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> SoftDelete(int courierId, int id)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.SoftDeleteAsync(id, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Document);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to soft-delete document {Id}", id);
            throw;
        }
    }
}

/// <summary>
/// Multipart upload form binding. Lives in the controller layer since it's
/// HTTP-shape only; the DB-side DTOs are in <c>Core/Application/Dtos/Np</c>.
/// </summary>
public class CourierDocumentUploadForm
{
    public IFormFile? File { get; set; }
    public int DocumentTypeId { get; set; }
    public DateTime? ExpiryDate { get; set; }
}
