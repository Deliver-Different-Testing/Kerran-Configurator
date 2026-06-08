using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Authorization;
using DfrntDriveConfigurator.Core.Application.Dtos.Contacts;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Contacts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers;

// Unified Permissions §8.1 — DF-Admin multi-lane Team & Users surface.
// AdminOnly: only DF admins reach it (so §A DF-Admin invisibility is satisfied
// by the gate). The §B escalation ladder is still applied on mutations so the
// surface stays correct when tenant self-service (§8.5) later opens it.
[ApiController]
[Route("api/admin/contacts")]
[Authorize(Policy = "AdminOnly")]
public class ContactsController(AdminContactService service) : BaseController
{
    [HttpGet]
    public async Task<ActionResult<List<NpUserDto>>> GetAll([FromQuery] string lane = "all")
    {
        try { return Ok(await service.GetAllAsync(lane)); }
        catch (Exception e) { Log.Error(e, "Failed to list contacts (lane={Lane})", lane); throw; }
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<NpUserDetailDto>> GetDetail(int id)
    {
        var d = await service.GetDetailAsync(id);
        return d is null ? NotFound(new { error = "Contact not found." }) : Ok(d);
    }

    [HttpGet("{id:int}/permissions")]
    public async Task<ActionResult<List<NpResolvedTile>>> GetPermissions(int id)
    {
        var d = await service.GetDetailAsync(id);
        if (d is null) return NotFound(new { error = "Contact not found." });
        return Ok(await service.GetResolvedPermissionsAsync(id));
    }

    [HttpGet("{id:int}/history")]
    public async Task<ActionResult<List<NpContactAuditDto>>> GetHistory(int id)
    {
        var d = await service.GetDetailAsync(id);
        if (d is null) return NotFound(new { error = "Contact not found." });
        return Ok(await service.GetHistoryAsync(id));
    }

    // RESOLVED-DATA-SCOPE §7 — DF-admin-only inspector of a contact's effective
    // data boundary. The AdminOnly policy already gates the surface; this adds
    // the spec's explicit ClientTypeId=5 check (§5/§7.2) → 403 for non-DF.
    [HttpGet("{id:int}/data-scope")]
    public async Task<IActionResult> GetDataScope(int id)
    {
        var (dto, error) = await service.GetResolvedDataScopeAsync(id);
        if (error == "forbidden")
            return StatusCode(403, new { error = "DF_ADMIN_ONLY", message = "Resolved Data Scope is a DF-admin-only inspector." });
        return dto is null ? NotFound(new { error = "Contact not found." }) : Ok(dto);
    }

    [HttpGet("lookups/roles")]
    public async Task<ActionResult<List<NpRoleOptionDto>>> GetRoles([FromQuery] int clientType)
        => Ok(await service.GetAssignableRolesAsync(clientType));

    [HttpGet("lookups/relationship-types")]
    public async Task<ActionResult<List<NpRelationshipTypeDto>>> GetRelationshipTypes()
        => Ok(await service.GetRelationshipTypesAsync());

    [HttpGet("lookups/clients")]
    public async Task<ActionResult<List<object>>> GetClients([FromQuery] string lane = "all")
        => Ok(await service.GetClientsAsync(lane));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] AdminContactCreateDto dto)
    {
        var (detail, error) = await service.CreateAsync(dto);
        return Result(detail, error);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] AdminContactUpdateDto dto)
    {
        var (detail, error) = await service.UpdateAsync(id, dto);
        return Result(detail, error);
    }

    private IActionResult Result(NpUserDetailDto? detail, string? error)
    {
        if (error == ClientTypeLadder.ForbiddenCode)
            return StatusCode(403, new { error = ClientTypeLadder.ForbiddenCode, message = "Your account cannot manage a contact at this ClientType." });
        if (error is not null) return BadRequest(new { error });
        return Ok(detail);
    }
}
