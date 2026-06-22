using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

/// <summary>
/// Courier modal §13 — staff-logged courier communications, stored in the legacy
/// dbo.tucEvent log scoped to the courier + the 'CE' event-type group. Tenant
/// staff / DF admin only.
///
///   GET  /api/v1/np/couriers/{id}/communications  — CE types + logged comms
///   POST /api/v1/np/couriers/{id}/communications  — log a communication
/// </summary>
[Route("api/v1/np")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class CourierCommunicationsController(CourierCommunicationService service) : BaseController
{
    [HttpGet("couriers/{courierId:int}/communications")]
    public async Task<IActionResult> Get(int courierId, CancellationToken ct)
    {
        try
        {
            Log.Information("({Method} {Path})", Request.Method, Request.Path);
            return Ok(await service.GetForCourierAsync(courierId, ct));
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to load communications for courier {CourierId}", courierId);
            throw;
        }
    }

    [HttpPost("couriers/{courierId:int}/communications")]
    public async Task<IActionResult> Create(int courierId, [FromBody] LogCourierCommunicationDto dto, CancellationToken ct)
    {
        try
        {
            Log.Information("({Method} {Path})", Request.Method, Request.Path);
            return Ok(await service.LogAsync(courierId, dto?.TypeId ?? 0, dto?.Body ?? string.Empty, ct));
        }
        catch (CourierCommunicationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to log communication for courier {CourierId}", courierId);
            throw;
        }
    }
}
