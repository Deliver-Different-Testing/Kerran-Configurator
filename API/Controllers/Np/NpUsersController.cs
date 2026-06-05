using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Authorization;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// Unified Permissions §8.1 — NP Users list + Contact modal endpoints.
//   GET  /api/v1/np/users                        list (enriched)
//   GET  /api/v1/np/users/{id}                   detail (modal Profile load)
//   GET  /api/v1/np/users/{id}/permissions       resolved permissions (Tab 2)
//   PUT  /api/v1/np/users/{id}                    save (manage-users)
//   POST /api/v1/np/users                         add (manage-users)
//   GET  /api/v1/np/users/lookups/roles           assignable NP roles
//   GET  /api/v1/np/users/lookups/relationship-types
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
            if (!response.Success) return BadRequest(response);
            return Ok(response.Users);
        }
        catch (Exception e) { Log.Error(e, "Failed to fetch NP users"); throw; }
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetDetail(int id)
    {
        try
        {
            var detail = await npUserService.GetDetailAsync(id);
            if (detail is null) return NotFound(new { error = "User not found or outside your scope." });
            return Ok(detail);
        }
        catch (Exception e) { Log.Error(e, "Failed to fetch NP user {Id}", id); throw; }
    }

    [HttpGet("{id:int}/permissions")]
    public async Task<ActionResult<List<NpResolvedTile>>> GetResolvedPermissions(int id)
    {
        try
        {
            // Scope-checked via the detail lookup before exposing resolved perms.
            var detail = await npUserService.GetDetailAsync(id);
            if (detail is null) return NotFound(new { error = "User not found or outside your scope." });
            return Ok(await npUserService.GetResolvedPermissionsAsync(id));
        }
        catch (Exception e) { Log.Error(e, "Failed to resolve permissions for NP user {Id}", id); throw; }
    }

    [HttpGet("{id:int}/history")]
    public async Task<ActionResult<List<NpContactAuditDto>>> GetHistory(int id)
    {
        try
        {
            // Scope-checked via the detail lookup before exposing history.
            var detail = await npUserService.GetDetailAsync(id);
            if (detail is null) return NotFound(new { error = "User not found or outside your scope." });
            return Ok(await npUserService.GetHistoryAsync(id));
        }
        catch (Exception e) { Log.Error(e, "Failed to load history for NP user {Id}", id); throw; }
    }

    [HttpGet("lookups/roles")]
    public async Task<ActionResult<List<NpRoleOptionDto>>> GetAssignableRoles()
    {
        try { return Ok(await npUserService.GetAssignableRolesAsync()); }
        catch (Exception e) { Log.Error(e, "Failed to fetch assignable NP roles"); throw; }
    }

    [HttpGet("lookups/relationship-types")]
    public async Task<ActionResult<List<NpRelationshipTypeDto>>> GetRelationshipTypes()
    {
        try { return Ok(await npUserService.GetRelationshipTypesAsync()); }
        catch (Exception e) { Log.Error(e, "Failed to fetch relationship types"); throw; }
    }

    [HttpPut("{id:int}")]
    [RequirePermission("manage-users")]
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
        catch (Exception e) { Log.Error(e, "Failed to update NP user {Id}", id); throw; }
    }

    [HttpPost]
    [RequirePermission("manage-users")]
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
        catch (Exception e) { Log.Error(e, "Failed to create NP user"); throw; }
    }
}
