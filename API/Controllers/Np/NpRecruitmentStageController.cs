using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// Recruitment Stages — the NP "recruitment-stages" settings page.
//   GET    /api/v1/np/recruitment-stages               — list
//   POST   /api/v1/np/recruitment-stages               — create
//   PUT    /api/v1/np/recruitment-stages/{id}          — update
//   DELETE /api/v1/np/recruitment-stages/{id}          — delete
//   POST   /api/v1/np/recruitment-stages/seed-defaults — restore standard stages
[Route("api/v1/np/recruitment-stages")]
[ApiController]
[Authorize(Policy = "NetworkPartnerOrAdmin")]
public class NpRecruitmentStageController(NpRecruitmentStageService service) : BaseController
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
            return Ok(response.Stages);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch recruitment stages");
            throw;
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] NpRecruitmentStageUpsertDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.CreateAsync(dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Stage);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to create recruitment stage");
            throw;
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] NpRecruitmentStageUpsertDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.UpdateAsync(id, dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Stage);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to update recruitment stage {Id}", id);
            throw;
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.DeleteAsync(id, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to delete recruitment stage {Id}", id);
            throw;
        }
    }

    [HttpPost("seed-defaults")]
    public async Task<IActionResult> SeedDefaults()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.SeedDefaultsAsync(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Stages);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to seed default recruitment stages");
            throw;
        }
    }
}
