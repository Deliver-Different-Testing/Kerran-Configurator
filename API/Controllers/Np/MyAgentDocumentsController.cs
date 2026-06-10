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
/// NP self-service for an NP's OWN business documents (Phase 2). The agent is
/// resolved from the caller's scope (<c>NpAgentId</c>) — there is no agentId in
/// the route, so an NP can only ever see/upload against itself. Tenant staff /
/// DF admin manage + verify/reject via <c>AgentDocumentsController</c>; this
/// surface deliberately exposes no verify/reject.
///
/// <c>NetworkPartnerOrAdmin</c> admits DF admins too, but "my documents" needs a
/// single NpAgentId — an admin (no NpAgentId) gets a 400 directing them to the
/// staff surface.
/// </summary>
[Route("api/v1/np/my-documents")]
[ApiController]
[Authorize(Policy = "NetworkPartnerOrAdmin")]
public class MyAgentDocumentsController(
    AgentDocumentService documentService,
    NpAgentComplianceService complianceService,
    INpScopeResolver scopeResolver) : BaseController
{
    private async Task<int?> ResolveMyAgentIdAsync()
    {
        var scope = await scopeResolver.ResolveAsync();
        return scope.NpAgentId;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var agentId = await ResolveMyAgentIdAsync();
            if (agentId is null) return BadRequest(new { error = "This surface is for Network Partner accounts." });

            var response = await documentService.ListAsync(agentId.Value, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Documents);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to list own NP documents");
            throw;
        }
    }

    /// <summary>Own-agent scorecard — the same payload tenant staff see for this NP.</summary>
    [HttpGet("compliance")]
    public async Task<IActionResult> Compliance()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var agentId = await ResolveMyAgentIdAsync();
            if (agentId is null) return BadRequest(new { error = "This surface is for Network Partner accounts." });

            var response = await complianceService.GetDetail(agentId.Value, messageId);
            if (!response.Success) return BadRequest(response);
            if (response.Detail is null) return NotFound();
            return Ok(response.Detail);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to load own NP compliance detail");
            throw;
        }
    }

    [HttpPost]
    [RequestSizeLimit(25 * 1024 * 1024)]  // 25 MB, mirrors the global maxFileSize in Program.cs
    public async Task<IActionResult> Upload([FromForm] AgentDocumentUploadForm form)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var agentId = await ResolveMyAgentIdAsync();
            if (agentId is null) return BadRequest(new { error = "This surface is for Network Partner accounts." });

            if (form?.File is null || form.File.Length == 0)
            {
                return BadRequest(new { error = "File is required." });
            }

            await using var stream = form.File.OpenReadStream();
            var response = await documentService.CreateAsync(
                agentId.Value,
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
            Log.Error(e, "Failed to upload own NP document");
            throw;
        }
    }

    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int id)
    {
        try
        {
            Log.Information("({Method} {Path})", Request.Method, Request.Path);

            // GetForDownloadAsync re-checks scope against the agent on the row,
            // so an NP can only ever download its own document.
            var result = await documentService.GetForDownloadAsync(id);
            if (result is null) return NotFound();

            return File(result.Content, result.ContentType, result.FileName);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to download own NP document {Id}", id);
            throw;
        }
    }
}
