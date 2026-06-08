using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Application.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Tenant;

// Agent/NP Onboarding pipeline (GARRY-AGENT-NP-ONBOARDING-REMOVE-DUMMY-DATA).
// Replaces the demo-only local store behind /agents/onboarding{,/new,/:id}.
[Route("api/v1/tenant/agents/onboarding")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class TenantAgentOnboardingController(TenantAgentOnboardingService service) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var messageId = Guid.NewGuid();
        Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);
        var response = await service.GetAll(messageId);
        if (!response.Success) return BadRequest(response);
        return Ok(response.Records);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var messageId = Guid.NewGuid();
        Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);
        var response = await service.GetById(id, messageId);
        if (!response.Success) return NotFound(response);
        return Ok(response.Record);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TenantAgentOnboardingUpsertDto dto)
    {
        var messageId = Guid.NewGuid();
        Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);
        var response = await service.CreateAsync(dto, messageId);
        if (!response.Success) return BadRequest(response);
        return Ok(response.Record);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] TenantAgentOnboardingUpsertDto dto)
    {
        var messageId = Guid.NewGuid();
        Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);
        var response = await service.UpdateAsync(id, dto, messageId);
        if (!response.Success) return BadRequest(response);
        return Ok(response.Record);
    }

    [HttpPost("{id:int}/advance-stage")]
    public async Task<IActionResult> AdvanceStage(int id)
    {
        var messageId = Guid.NewGuid();
        Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);
        var response = await service.AdvanceStageAsync(id, messageId);
        if (!response.Success) return BadRequest(response);
        return Ok(response.Record);
    }

    [HttpPost("{id:int}/approve-activate")]
    public async Task<IActionResult> ApproveActivate(int id)
    {
        var messageId = Guid.NewGuid();
        Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);
        var response = await service.ApproveAndActivateAsync(id, messageId);
        if (!response.Success) return BadRequest(response);
        return Ok(response.Record);
    }

    [HttpPost("{id:int}/archive")]
    public async Task<IActionResult> Archive(int id)
    {
        var messageId = Guid.NewGuid();
        Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);
        var response = await service.ArchiveAsync(id, messageId);
        if (!response.Success) return BadRequest(response);
        return Ok(response.Record);
    }
}
