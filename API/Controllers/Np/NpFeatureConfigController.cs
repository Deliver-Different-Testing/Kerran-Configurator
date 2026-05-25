using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// Per-NP feature toggles — DF Admin only. NPs cannot edit their own gates.
//   GET /api/v1/np/feature-config              — list (one row per NP,
//                                                schema defaults for NPs
//                                                without an explicit row)
//   GET /api/v1/np/feature-config/{agentId}    — single
//   PUT /api/v1/np/feature-config/{agentId}    — upsert
[Route("api/v1/np/feature-config")]
[ApiController]
[Authorize(Policy = "AdminOnly")]
public class NpFeatureConfigController(NpFeatureConfigService service) : BaseController
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
            return Ok(response.Configs);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch NP feature configs");
            throw;
        }
    }

    [HttpGet("{agentId:int}")]
    public async Task<IActionResult> GetByAgentId(int agentId)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.GetByAgentId(agentId, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Config);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch NP feature config for agent {AgentId}", agentId);
            throw;
        }
    }

    [HttpPut("{agentId:int}")]
    public async Task<IActionResult> Upsert(int agentId, [FromBody] NpFeatureConfigUpsertDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.UpsertAsync(agentId, dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Config);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to upsert NP feature config for agent {AgentId}", agentId);
            throw;
        }
    }
}
