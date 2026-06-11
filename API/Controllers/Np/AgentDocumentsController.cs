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
/// Business-document instances against an agent / NP. File bytes are stored in
/// S3 (bucket from <c>S3BucketComplianceUploads</c>); metadata + lifecycle live
/// in the tucAgentDocument table. Download is proxied through the API so
/// cookie-auth + audit are end-to-end. Mirrors <c>CourierDocumentsController</c>.
///
/// Phase 1: tenant staff / DF admin manage (upload-on-behalf + verify/reject).
/// NP self-service upload arrives in Phase 2 under the NP-lane policy.
/// </summary>
[Route("api/v1/np/agents/{agentId:int}/documents")]
[ApiController]
// Staff manage ANY agent's docs by id — NPs are REJECTED here (they would
// otherwise be able to read/verify other agents' documents). NP self-service
// uses MyAgentDocumentsController (/np/my-documents, NetworkPartnerOrAdmin).
[Authorize(Policy = "TenantStaffOrAdminNoNp")]
public class AgentDocumentsController(AgentDocumentService service) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> List(int agentId)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.ListAsync(agentId, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Documents);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to list documents for agent {AgentId}", agentId);
            throw;
        }
    }

    /// <summary>
    /// Multipart upload of a new agent document. File is streamed through the
    /// API to S3; only the metadata row + S3 key are persisted in the DB.
    /// </summary>
    [HttpPost]
    [RequestSizeLimit(25 * 1024 * 1024)]  // 25 MB, mirrors the global maxFileSize in Program.cs
    public async Task<IActionResult> Upload(int agentId, [FromForm] AgentDocumentUploadForm form)
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
                agentId,
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
            Log.Error(e, "Failed to upload document for agent {AgentId}", agentId);
            throw;
        }
    }

    /// <summary>
    /// Proxy download — fetches the bytes from S3 and streams them back with the
    /// original filename + content type.
    /// </summary>
    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int agentId, int id)
    {
        try
        {
            Log.Information("({Method} {Path})", Request.Method, Request.Path);

            // agentId is in the URL for REST clarity; the service looks up by
            // document id alone and re-checks scope against the agent on the row.
            var result = await service.GetForDownloadAsync(id);
            if (result is null) return NotFound();

            return File(result.Content, result.ContentType, result.FileName);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to download document {Id} for agent {AgentId}", id, agentId);
            throw;
        }
    }

    [HttpPut("{id:int}/verify")]
    public async Task<IActionResult> Verify(int agentId, int id)
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
    public async Task<IActionResult> Reject(int agentId, int id, [FromBody] AgentDocumentRejectDto dto)
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
    public async Task<IActionResult> SoftDelete(int agentId, int id)
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
/// Multipart upload form binding. HTTP-shape only; the DB-side DTOs live in
/// <c>Core/Application/Dtos/Np</c>.
/// </summary>
public class AgentDocumentUploadForm
{
    public IFormFile? File { get; set; }
    public int DocumentTypeId { get; set; }
    public DateTime? ExpiryDate { get; set; }
}
