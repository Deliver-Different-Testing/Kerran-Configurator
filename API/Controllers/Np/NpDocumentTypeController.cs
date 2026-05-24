using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// Document Types settings — the NP Settings "document-types" page.
//   GET    /api/v1/np/document-types        — list
//   POST   /api/v1/np/document-types        — create
//   PUT    /api/v1/np/document-types/{id}   — update
//   DELETE /api/v1/np/document-types/{id}   — deactivate (soft delete)
[Route("api/v1/np/document-types")]
[ApiController]
[Authorize(Policy = "NetworkPartnerOrAdmin")]
public class NpDocumentTypeController(NpDocumentTypeService service) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.GetAll(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.DocumentTypes);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch document types");
            throw;
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] NpDocumentTypeUpsertDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.CreateAsync(dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.DocumentType);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to create document type");
            throw;
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] NpDocumentTypeUpsertDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.UpdateAsync(id, dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.DocumentType);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to update document type {Id}", id);
            throw;
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Deactivate(int id)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.DeactivateAsync(id, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.DocumentType);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to deactivate document type {Id}", id);
            throw;
        }
    }

    // ─── Template (blank form attached to a document type) ────────────────

    [HttpPost("{id:int}/template")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<IActionResult> UploadTemplate(int id, [FromForm] DocumentTypeTemplateForm form)
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
            var response = await service.UploadTemplateAsync(
                id, stream, form.File.FileName, form.File.ContentType, form.File.Length, messageId);

            if (!response.Success) return BadRequest(response);
            return Ok(response.DocumentType);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to upload template for document type {Id}", id);
            throw;
        }
    }

    [HttpGet("{id:int}/template")]
    public async Task<IActionResult> DownloadTemplate(int id)
    {
        try
        {
            Log.Information("({Method} {Path})", Request.Method, Request.Path);

            var result = await service.GetTemplateForDownloadAsync(id);
            if (result is null) return NotFound();

            return File(result.Content, result.ContentType, result.FileName);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to download template for document type {Id}", id);
            throw;
        }
    }

    [HttpDelete("{id:int}/template")]
    public async Task<IActionResult> RemoveTemplate(int id)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.RemoveTemplateAsync(id, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.DocumentType);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to remove template for document type {Id}", id);
            throw;
        }
    }
}

/// <summary>Multipart form binding for the template upload.</summary>
public class DocumentTypeTemplateForm
{
    public IFormFile? File { get; set; }
}
