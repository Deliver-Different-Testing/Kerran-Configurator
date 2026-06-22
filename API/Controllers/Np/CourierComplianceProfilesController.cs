using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

/// <summary>
/// Courier modal §11 — tenant-administered ComplianceProfile ("role") assignment
/// for a courier. The assigned profiles' required documents drive the courier's
/// required-document list on the Compliance & Licensing tab. Tenant staff / DF
/// admin only — couriers do not self-assign. Mirrors AgentComplianceProfilesController.
/// </summary>
[Route("api/v1/np")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class CourierComplianceProfilesController(CourierComplianceProfileService service) : BaseController
{
    [HttpGet("couriers/{courierId:int}/compliance-profiles")]
    public async Task<IActionResult> GetForCourier(int courierId)
    {
        try
        {
            Log.Information("({Method} {Path})", Request.Method, Request.Path);
            return Ok(await service.GetForCourierAsync(courierId));
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to load compliance profiles for courier {CourierId}", courierId);
            throw;
        }
    }

    [HttpPut("couriers/{courierId:int}/compliance-profiles")]
    public async Task<IActionResult> SetForCourier(int courierId, [FromBody] SetCourierProfilesDto dto)
    {
        try
        {
            Log.Information("({Method} {Path})", Request.Method, Request.Path);
            return Ok(await service.SetForCourierAsync(courierId, dto?.ProfileIds ?? new()));
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to set compliance profiles for courier {CourierId}", courierId);
            throw;
        }
    }
}
