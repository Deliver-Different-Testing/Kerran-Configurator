using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Authorization;
using DfrntDriveConfigurator.Core.Application.Dtos.Permissions;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers;

// Unified Permissions §8.2.3 — Role Management endpoints. Sibling to the
// RolePermissionsController (which edits the per-cell matrix). This controller
// owns tblContactRole CRUD + the tblRoleClientType ("Applies To") tagging +
// the lookups the Role/Contact modals need.
//
// All DF-Admin gated (AdminOnly). Tenant self-service (spec §8.5) is a
// post-Phase-E follow-up; today only DF Admin manages roles.
[ApiController]
[Route("api/admin")]
[Authorize(Policy = "AdminOnly")]
public class RolesController(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseController
{
    private string Actor =>
        User.FindFirst(ClaimTypes.Name)?.Value
        ?? User.FindFirst("name")?.Value
        ?? "configurator";

    // Caller's ClientTypeId (Hub claim). 0/absent = unknown -> denied by the ladder.
    private int CallerClientType =>
        int.TryParse(User.FindFirst("ClientTypeId")?.Value, out var v) ? v : 0;

    // Addendum §B — structured 403 for a cross-rung ClientType write.
    private ObjectResult ClientTypeForbidden(int requested) =>
        StatusCode(403, new
        {
            error = ClientTypeLadder.ForbiddenCode,
            message = $"Your account cannot write ClientTypeId {requested}.",
            callerClientTypeId = CallerClientType,
            requestedClientTypeId = requested,
        });

    // ---- Lookups ----------------------------------------------------------

    [HttpGet("client-types")]
    public async Task<ActionResult<IReadOnlyList<ClientTypeRefDto>>> GetClientTypes()
    {
        await using var ctx = await contextFactory.CreateDbContextAsync();
        var rows = await ctx.ClientTypes.AsNoTracking()
            .OrderBy(c => c.Id)
            .Select(c => new ClientTypeRefDto(c.Id, c.Name))
            .ToListAsync();
        return Ok(rows);
    }

    [HttpGet("relationship-types")]
    public async Task<ActionResult<IReadOnlyList<RelationshipTypeRefDto>>> GetRelationshipTypes()
    {
        await using var ctx = await contextFactory.CreateDbContextAsync();
        var rows = await ctx.TblRelationshipTypes.AsNoTracking()
            .OrderBy(r => r.RelationshipTypeId)
            .Select(r => new RelationshipTypeRefDto(r.RelationshipTypeId, r.Name))
            .ToListAsync();
        return Ok(rows);
    }

    // Clients for the matrix per-client override overlay (§8.3.1). Scoped to
    // active NetworkPartner (3) + Tenant (4) clients — the entities whose
    // contacts hold roles; keeps the picker bounded (not every customer).
    [HttpGet("clients")]
    public async Task<ActionResult<IReadOnlyList<ClientRefDto>>> GetClients()
    {
        await using var ctx = await contextFactory.CreateDbContextAsync();
        var rows = await ctx.TucClients.AsNoTracking()
            .Where(c => c.UcclActive && (c.ClientTypeId == 3 || c.ClientTypeId == 4))
            .OrderBy(c => c.UcclName)
            .Select(c => new ClientRefDto(c.UcclId, c.UcclName, c.ClientTypeId))
            .ToListAsync();
        return Ok(rows);
    }

    // ---- Roles list -------------------------------------------------------

    [HttpGet("roles")]
    public async Task<ActionResult<IReadOnlyList<RoleListItemDto>>> GetRoles(
        [FromQuery] string scope = null,
        [FromQuery] int? clientType = null,
        [FromQuery] string status = null)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync();

        var q = ctx.TblContactRoles.AsNoTracking().AsQueryable();

        if (string.Equals(scope, "global", StringComparison.OrdinalIgnoreCase))
            q = q.Where(r => r.TenantClientId == null);
        else if (string.Equals(scope, "tenant", StringComparison.OrdinalIgnoreCase))
            q = q.Where(r => r.TenantClientId != null);

        if (string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
            q = q.Where(r => r.IsActive);
        else if (string.Equals(status, "inactive", StringComparison.OrdinalIgnoreCase))
            q = q.Where(r => !r.IsActive);

        if (clientType is int ct)
            q = q.Where(r => r.TblRoleClientTypes.Any(rct => rct.ClientTypeId == ct));

        // Show only ASSIGNABLE roles — those tagged for >= 1 ClientType. Hides
        // vestigial CRM-label rows (Decision Maker / Main Contact / Accounts /
        // User / Temp) that sit in tblContactRole from the legacy §3.6 collision
        // but aren't permission roles. Every real role requires an Applies-To on
        // create, so none are hidden. (Phase D removes the labels from the table.)
        q = q.Where(r => r.TblRoleClientTypes.Any());

        // Addendum §A — DF Admin invisibility: non-DF callers cannot see roles
        // whose ClientType tags are EXCLUSIVELY DF Admin (5). A role tagged for
        // both (e.g. 4 and 5) stays visible (the 4 part is usable). Untagged
        // roles stay visible (not DF-only).
        if (!ClientTypeLadder.IsDfAdmin(CallerClientType))
            q = q.Where(r => !r.TblRoleClientTypes.Any()
                          || r.TblRoleClientTypes.Any(x => x.ClientTypeId != 5));

        // Project with aggregates. Tenant name resolved via a left join.
        var roles = await q
            .Select(r => new
            {
                r.ContactRoleId,
                r.Name,
                r.Description,
                r.TenantClientId,
                r.IsActive,
                ClientTypeIds = r.TblRoleClientTypes.Select(x => x.ClientTypeId).ToList(),
                ContactCount = r.TblContactContactRoles.Count(),
                TenantName = ctx.TucClients
                    .Where(c => c.UcclId == r.TenantClientId)
                    .Select(c => c.UcclName)
                    .FirstOrDefault()
            })
            .OrderBy(r => r.TenantClientId == null ? 0 : 1)   // global defaults first
            .ThenBy(r => r.Name)
            .ToListAsync();

        var result = roles.Select(r => new RoleListItemDto(
            r.ContactRoleId, r.Name, r.Description, r.TenantClientId,
            r.TenantClientId == null ? "Global Default" : (r.TenantName ?? $"Tenant #{r.TenantClientId}"),
            r.ClientTypeIds, r.ContactCount, r.IsActive)).ToList();

        return Ok(result);
    }

    // ---- Role detail ------------------------------------------------------

    [HttpGet("roles/{id:int}")]
    public async Task<ActionResult<RoleDetailDto>> GetRole(int id)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync();
        var role = await ctx.TblContactRoles.AsNoTracking()
            .Where(r => r.ContactRoleId == id)
            .Select(r => new
            {
                r.ContactRoleId,
                r.Name,
                r.Description,
                r.TenantClientId,
                r.IsActive,
                ClientTypeIds = r.TblRoleClientTypes.Select(x => x.ClientTypeId).ToList(),
                AffectedContacts = r.TblContactContactRoles.Count()
            })
            .FirstOrDefaultAsync();

        if (role is null)
            return NotFound(new { error = $"Unknown role {id}." });

        return Ok(new RoleDetailDto(
            role.ContactRoleId, role.Name, role.Description, role.TenantClientId,
            role.ClientTypeIds, role.IsActive, role.AffectedContacts));
    }

    // ---- Create -----------------------------------------------------------

    [HttpPost("roles")]
    public async Task<ActionResult<RoleDetailDto>> CreateRole([FromBody] CreateRoleDto body)
    {
        if (body is null || string.IsNullOrWhiteSpace(body.Name))
            return BadRequest(new { error = "Role name is required." });
        if (body.ClientTypeIds is null || body.ClientTypeIds.Count == 0)
            return BadRequest(new { error = "At least one ClientType must be selected." });

        await using var ctx = await contextFactory.CreateDbContextAsync();

        // Name must be unique within scope (global vs a given tenant).
        var dupe = await ctx.TblContactRoles.AnyAsync(r =>
            r.Name == body.Name && r.TenantClientId == body.TenantClientId);
        if (dupe)
            return Conflict(new { error = $"A role named '{body.Name}' already exists in this scope." });

        var validClientTypes = await ctx.ClientTypes.Select(c => c.Id).ToListAsync();
        var clientTypeIds = body.ClientTypeIds.Distinct().Where(validClientTypes.Contains).ToList();
        if (clientTypeIds.Count == 0)
            return BadRequest(new { error = "No valid ClientTypes supplied." });

        // Addendum §B — every requested ClientType must be at/below the caller's rung.
        foreach (var ctId in clientTypeIds)
            if (!ClientTypeLadder.CanWriteClientType(CallerClientType, ctId))
                return ClientTypeForbidden(ctId);

        // Addendum §B row 7 — only DF Admin may create a Global Default role.
        if (body.TenantClientId == null && !ClientTypeLadder.IsDfAdmin(CallerClientType))
            return StatusCode(403, new
            {
                error = ClientTypeLadder.ForbiddenCode,
                message = "Only DF Admin can create a Global Default role.",
            });

        var now = DateTime.UtcNow;
        var role = new TblContactRole
        {
            Name = body.Name.Trim(),
            Description = body.Description,
            TenantClientId = body.TenantClientId,
            IsActive = true,
            Created = now,
            CreatedBy = Actor,
            LastModified = now,
            LastModifiedBy = Actor
        };
        ctx.TblContactRoles.Add(role);
        await ctx.SaveChangesAsync();   // assigns ContactRoleId

        foreach (var ctId in clientTypeIds)
            ctx.TblRoleClientTypes.Add(new TblRoleClientType { ContactRoleId = role.ContactRoleId, ClientTypeId = ctId });
        await ctx.SaveChangesAsync();

        Log.Information("Role created: {RoleId} '{Name}' scope={Tenant} clientTypes={Cts} by {Actor}",
            role.ContactRoleId, role.Name, body.TenantClientId, string.Join(",", clientTypeIds), Actor);

        return Ok(new RoleDetailDto(role.ContactRoleId, role.Name, role.Description,
            role.TenantClientId, clientTypeIds, role.IsActive, 0));
    }

    // ---- Update (metadata + ClientType diff) ------------------------------

    [HttpPut("roles/{id:int}")]
    public async Task<IActionResult> UpdateRole(int id, [FromBody] UpdateRoleDto body)
    {
        if (body is null || string.IsNullOrWhiteSpace(body.Name))
            return BadRequest(new { error = "Role name is required." });
        if (body.ClientTypeIds is null || body.ClientTypeIds.Count == 0)
            return BadRequest(new { error = "At least one ClientType must be selected." });

        await using var ctx = await contextFactory.CreateDbContextAsync();

        var role = await ctx.TblContactRoles.FirstOrDefaultAsync(r => r.ContactRoleId == id);
        if (role is null)
            return NotFound(new { error = $"Unknown role {id}." });

        var dupe = await ctx.TblContactRoles.AnyAsync(r =>
            r.ContactRoleId != id && r.Name == body.Name && r.TenantClientId == role.TenantClientId);
        if (dupe)
            return Conflict(new { error = $"A role named '{body.Name}' already exists in this scope." });

        role.Name = body.Name.Trim();
        role.Description = body.Description;
        role.IsActive = body.IsActive;
        role.LastModified = DateTime.UtcNow;
        role.LastModifiedBy = Actor;

        // ClientType diff: insert new pairs, delete removed pairs.
        var validClientTypes = await ctx.ClientTypes.Select(c => c.Id).ToListAsync();
        var desired = body.ClientTypeIds.Distinct().Where(validClientTypes.Contains).ToHashSet();
        var existing = await ctx.TblRoleClientTypes.Where(x => x.ContactRoleId == id).ToListAsync();
        var existingIds = existing.Select(x => x.ClientTypeId).ToHashSet();

        // Addendum §B row 6 — the caller may only add or remove ClientType tags
        // at/below their own rung (a tenant can't graft on a DF/Tenant tag, nor
        // strip one above its rung). DF Admin clears everything.
        foreach (var ctId in desired.Where(c => !existingIds.Contains(c))
                                    .Concat(existingIds.Where(c => !desired.Contains(c))))
            if (!ClientTypeLadder.CanWriteClientType(CallerClientType, ctId))
                return ClientTypeForbidden(ctId);

        foreach (var gone in existing.Where(x => !desired.Contains(x.ClientTypeId)))
            ctx.TblRoleClientTypes.Remove(gone);
        foreach (var added in desired.Where(ctId => !existingIds.Contains(ctId)))
            ctx.TblRoleClientTypes.Add(new TblRoleClientType { ContactRoleId = id, ClientTypeId = added });

        await ctx.SaveChangesAsync();
        Log.Information("Role updated: {RoleId} '{Name}' clientTypes={Cts} active={Active} by {Actor}",
            id, role.Name, string.Join(",", desired), role.IsActive, Actor);
        return NoContent();
    }

    // ---- Deactivate (soft) ------------------------------------------------

    [HttpPost("roles/{id:int}/deactivate")]
    public async Task<IActionResult> DeactivateRole(int id)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync();
        var role = await ctx.TblContactRoles.FirstOrDefaultAsync(r => r.ContactRoleId == id);
        if (role is null)
            return NotFound(new { error = $"Unknown role {id}." });

        if (role.IsActive)
        {
            role.IsActive = false;
            role.LastModified = DateTime.UtcNow;
            role.LastModifiedBy = Actor;
            await ctx.SaveChangesAsync();
            Log.Information("Role deactivated: {RoleId} '{Name}' by {Actor}", id, role.Name, Actor);
        }
        return NoContent();
    }

    // ---- Role permissions (tree + this role's cells) ----------------------

    [HttpGet("roles/{id:int}/permissions")]
    public async Task<ActionResult<RolePermissionsForRoleDto>> GetRolePermissions(int id)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync();

        var roleExists = await ctx.TblContactRoles.AnyAsync(r => r.ContactRoleId == id);
        if (!roleExists)
            return NotFound(new { error = $"Unknown role {id}." });

        var permissions = await ctx.Permissions.AsNoTracking()
            .OrderBy(p => p.SortOrder).ThenBy(p => p.PermissionKey)
            .Select(p => new PermissionRefDto(
                p.PermissionKey, p.DisplayName, p.Description, p.Category,
                p.ParentKey, p.Tier, p.AccessType, p.SortOrder))
            .ToListAsync();

        var cells = await ctx.RolePermissions.AsNoTracking()
            .Where(rp => rp.ContactRoleId == id)
            .Select(rp => new RoleCellDto(rp.PermissionKey, rp.Allowed, rp.AccessLevel, rp.ClientId))
            .ToListAsync();

        return Ok(new RolePermissionsForRoleDto(id, permissions, cells));
    }
}
