using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Application.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Tenant;

// Tenant-side agents directory — read by AgentList, edit/create from the Edit
// Agent modal. Visible to any tenant staff (the agents directory is a tenant-
// marketplace concept) plus DF Admins; NPs also pass because they're staff at
// their own tenant.
[Route("api/v1/tenant/agents")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class TenantAgentsController(TenantAgentService tenantAgentService) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await tenantAgentService.GetAll(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Agents);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch tenant agents");
            throw;
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TenantAgentUpsertDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await tenantAgentService.CreateAsync(dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Agent);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to create tenant agent");
            throw;
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] TenantAgentUpsertDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await tenantAgentService.UpdateAsync(id, dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Agent);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to update tenant agent {Id}", id);
            throw;
        }
    }
}
