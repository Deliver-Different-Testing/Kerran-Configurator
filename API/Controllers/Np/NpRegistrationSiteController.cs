using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// Registration Settings — the "settings/registration" page.
//   GET /api/v1/np/registration-sites          — list sites + applicant-enabled flag
//   PUT /api/v1/np/registration-sites/{id}      — toggle applicant registration for a site
[Route("api/v1/np/registration-sites")]
[ApiController]
[Authorize(Policy = "NetworkPartnerOrAdmin")]
public class NpRegistrationSiteController(NpRegistrationSiteService service) : BaseController
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
            return Ok(response.Sites);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch registration sites");
            throw;
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> SetEnabled(int id, [FromBody] NpRegistrationSiteToggleDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.SetEnabledAsync(id, dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Site);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to update registration site {Id}", id);
            throw;
        }
    }
}
