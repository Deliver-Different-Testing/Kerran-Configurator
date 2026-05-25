using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// React useUsers hook calls GET /api/v1/np/users; PUT /api/v1/np/users/{id}
// is the edit-user save endpoint added in Phase 5+5. {id} is StaffId (matches
// the NpUserDto.Id surfaced on the read side).
[Route("api/v1/np/users")]
[ApiController]
[Authorize(Policy = "NetworkPartnerOrAdmin")]
public class NpUsersController(NpUserService npUserService) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await npUserService.GetAll(messageId);

            // The React userService.getAll() expects the array directly (not wrapped
            // in a BaseResponse envelope), to match how Steve's prototype consumed it.
            if (!response.Success) return BadRequest(response);
            return Ok(response.Users);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch NP users");
            throw;
        }
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = "NpManageUsers")]      // Phase 5+28b — NpAdmin-only
    public async Task<IActionResult> Update(int id, [FromBody] NpUserUpdateDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await npUserService.UpdateAsync(id, dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.User);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to update NP user {Id}", id);
            throw;
        }
    }

    // Phase 5+28b §B.2 — Add User from the NP team page. Creates a
    // tucClientContact + triggers Hub invite cascade. Gated NpManageUsers
    // (NpAdmin-only; DF Admin bypasses via the policy).
    [HttpPost]
    [Authorize(Policy = "NpManageUsers")]
    public async Task<IActionResult> Create([FromBody] NpUserCreateDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await npUserService.CreateAsync(dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to create NP user");
            throw;
        }
    }
}
