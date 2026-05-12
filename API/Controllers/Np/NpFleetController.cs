using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// React frontend calls GET /api/v1/np/fleet for the NP Fleet (drivers) page,
// and PUT /api/v1/np/fleet/{id} from CourierSetup's Save action.
[Route("api/v1/np/fleet")]
[ApiController]
[Authorize(Policy = "NetworkPartnerOrAdmin")]
public class NpFleetController(NpFleetService npFleetService) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await npFleetService.GetAll(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Couriers);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch NP fleet");
            throw;
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] NpFleetCourierUpdateDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await npFleetService.UpdateAsync(id, dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Courier);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to update NP courier {Id}", id);
            throw;
        }
    }
}
