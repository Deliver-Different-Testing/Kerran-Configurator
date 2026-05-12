using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Tenant;

// Powers the /agents/find page — backed by the ProspectAgent directory
// (821-row carrier list seeded by migration 023).
//   GET /api/v1/tenant/prospects?search=...&association=CLDA|ECA
[Route("api/v1/tenant/prospects")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class TenantProspectsController(TenantProspectService prospectService) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] string? search, [FromQuery] string? association)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await prospectService.Search(search, association, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Prospects);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to search prospects");
            throw;
        }
    }

    // POST /api/v1/tenant/prospects/{id}/convert — promote a ProspectAgent
    // into a tucAgent row. Stamps the prospect's ConvertedToAgentId so the
    // directory marks it "Already an Agent" on subsequent searches.
    [HttpPost("{id:int}/convert")]
    public async Task<IActionResult> Convert(int id)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await prospectService.ConvertToAgent(id, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(new { agentId = response.AgentId, agentName = response.AgentName });
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to convert prospect {Id}", id);
            throw;
        }
    }
}
