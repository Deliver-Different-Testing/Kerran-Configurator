using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

/// <summary>
/// Tenant-administered client compliance-profile overlays (Phase 4b-ii). A
/// tenant assigns one or more client ComplianceProfiles to an NP; the NP's
/// scorecard then also requires those profiles' documents. Includes the reverse
/// view (a profile → the NPs carrying it). Tenant staff / DF admin only — NPs do
/// not self-assign.
/// </summary>
[Route("api/v1/np")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class AgentComplianceProfilesController(AgentComplianceProfileService service) : BaseController
{
    [HttpGet("agents/{agentId:int}/compliance-profiles")]
    public async Task<IActionResult> GetForAgent(int agentId)
    {
        try
        {
            Log.Information("({Method} {Path})", Request.Method, Request.Path);
            return Ok(await service.GetForAgentAsync(agentId));
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to load compliance profiles for agent {AgentId}", agentId);
            throw;
        }
    }

    [HttpPut("agents/{agentId:int}/compliance-profiles")]
    public async Task<IActionResult> SetForAgent(int agentId, [FromBody] SetAgentProfilesDto dto)
    {
        try
        {
            Log.Information("({Method} {Path})", Request.Method, Request.Path);
            var result = await service.SetForAgentAsync(agentId, dto?.ProfileIds ?? new());
            return Ok(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to set compliance profiles for agent {AgentId}", agentId);
            throw;
        }
    }

    [HttpGet("compliance-profiles/{profileId:int}/agents")]
    public async Task<IActionResult> GetAgentsForProfile(int profileId)
    {
        try
        {
            Log.Information("({Method} {Path})", Request.Method, Request.Path);
            return Ok(await service.GetAgentsForProfileAsync(profileId));
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to load agents for compliance profile {ProfileId}", profileId);
            throw;
        }
    }
}
