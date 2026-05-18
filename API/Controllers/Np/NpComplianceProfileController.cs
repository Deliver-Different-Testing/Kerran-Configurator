using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// Compliance Profiles — the NP "compliance-profiles" settings page.
//   GET    /api/v1/np/compliance-profiles        — list (with requirements + clients)
//   POST   /api/v1/np/compliance-profiles        — create
//   PUT    /api/v1/np/compliance-profiles/{id}   — update (reconciles children)
//   DELETE /api/v1/np/compliance-profiles/{id}   — deactivate (soft delete)
[Route("api/v1/np/compliance-profiles")]
[ApiController]
[Authorize(Policy = "NetworkPartnerOrAdmin")]
public class NpComplianceProfileController(NpComplianceProfileService service) : BaseController
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
            return Ok(response.Profiles);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch compliance profiles");
            throw;
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] NpComplianceProfileUpsertDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.CreateAsync(dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Profile);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to create compliance profile");
            throw;
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] NpComplianceProfileUpsertDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.UpdateAsync(id, dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Profile);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to update compliance profile {Id}", id);
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
            return Ok(response.Profile);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to deactivate compliance profile {Id}", id);
            throw;
        }
    }
}
