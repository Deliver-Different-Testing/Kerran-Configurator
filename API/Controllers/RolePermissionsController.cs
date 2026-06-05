using System;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Permissions;
using DfrntDriveConfigurator.Core.Application.Services.Permissions;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers;

// Phase 5+31 R3 — endpoints over the dbo.Permission × dbo.RolePermission
// matrix added by 20260528090000_CreatePermissionAndRolePermissionMatrix.sql.
//
// Three endpoints per Steve's spec:
//   GET  /api/me/permissions                                              (any authed)
//   GET  /api/admin/role-permissions                                      (AdminOnly)
//   PUT  /api/admin/role-permissions/{contactRoleId}/{permissionKey}      (AdminOnly)
//
// The PUT body carries optional ClientId — null writes a global default
// row, non-null writes a per-client override row. (Tenant admin /
// NpAdmin write paths to their own client are a future iteration;
// today only DF Admin can edit the matrix.)
//
// Mirrors the R2 FeaturesController shape exactly — same upsert
// semantics, same 204 NoContent on PUT, same per-cell validation
// returning 404 on unknown ContactRoleId / PermissionKey.
[ApiController]
[Route("api")]
[Authorize]
public class RolePermissionsController(
    IRolePermissionResolver resolver,
    IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseController
{
    /// <summary>
    /// Returns the permission keys the current user is allowed to invoke.
    /// DF Admin bypass returns the full catalog; otherwise resolves the
    /// user's NpRoleId claim + per-client overrides via ClientID claim.
    /// </summary>
    [HttpGet("me/permissions")]
    public async Task<ActionResult<string[]>> GetMyPermissions()
    {
        try
        {
            var keys = await resolver.ResolveForCurrentUserAsync();
            return Ok(keys.OrderBy(k => k, StringComparer.Ordinal).ToArray());
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Failed to resolve permissions for current user");
            throw;
        }
    }

    /// <summary>
    /// Returns the full Role × Permission matrix for the DF-admin matrix
    /// UI. Includes both global default rows (ClientId IS NULL) and any
    /// per-client override rows.
    /// </summary>
    [HttpGet("admin/role-permissions")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<RolePermissionMatrixDto>> GetMatrix()
    {
        try
        {
            await using var ctx = await contextFactory.CreateDbContextAsync();

            // Only ASSIGNABLE roles (tagged for >= 1 ClientType) become matrix
            // columns — hides the vestigial CRM-label rows (Decision Maker etc.)
            // that sit in tblContactRole from the legacy §3.6 collision. Every
            // real role requires an Applies-To on create, so none are hidden.
            var roles = await ctx.TblContactRoles
                .AsNoTracking()
                .Where(r => r.TblRoleClientTypes.Any())
                .OrderBy(r => r.ContactRoleId)
                .Select(r => new RoleRefDto(r.ContactRoleId, r.Name, r.Notes))
                .ToListAsync();

            var permissions = await ctx.Permissions
                .AsNoTracking()
                .OrderBy(p => p.SortOrder).ThenBy(p => p.PermissionKey)
                .Select(p => new PermissionRefDto(
                    p.PermissionKey, p.DisplayName, p.Description, p.Category,
                    p.ParentKey, p.Tier, p.AccessType, p.SortOrder))
                .ToListAsync();

            var matrix = await ctx.RolePermissions
                .AsNoTracking()
                .Select(rp => new RolePermissionCellDto(rp.ContactRoleId, rp.PermissionKey, rp.Allowed, rp.AccessLevel, rp.ClientId))
                .ToListAsync();

            return Ok(new RolePermissionMatrixDto(roles, permissions, matrix));
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Failed to load Role × Permission matrix");
            throw;
        }
    }

    /// <summary>
    /// Upsert a single (ContactRoleId, PermissionKey, ClientId) cell.
    /// Body { allowed: bool, clientId?: int }. Creates the row if absent,
    /// updates Allowed if present. Returns 204.
    /// </summary>
    [HttpPut("admin/role-permissions/{contactRoleId:int}/{permissionKey}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> SetPermission(
        int contactRoleId, string permissionKey, [FromBody] SetRolePermissionDto body)
    {
        if (body is null)
            return BadRequest(new { error = "Request body required." });
        if (string.IsNullOrWhiteSpace(permissionKey))
            return BadRequest(new { error = "permissionKey is required." });

        try
        {
            await using var ctx = await contextFactory.CreateDbContextAsync();

            var roleExists = await ctx.TblContactRoles.AnyAsync(r => r.ContactRoleId == contactRoleId);
            if (!roleExists)
                return NotFound(new { error = $"Unknown ContactRoleId {contactRoleId}." });

            var permissionExists = await ctx.Permissions.AnyAsync(p => p.PermissionKey == permissionKey);
            if (!permissionExists)
                return NotFound(new { error = $"Unknown PermissionKey '{permissionKey}'." });

            // Optional ClientId — null targets the global-default row,
            // non-null targets the per-client override row.
            if (body.ClientId is int cid)
            {
                var clientExists = await ctx.TucClients.AnyAsync(c => c.UcclId == cid);
                if (!clientExists)
                    return NotFound(new { error = $"Unknown ClientId {cid}." });
            }

            var existing = await ctx.RolePermissions
                .FirstOrDefaultAsync(rp =>
                    rp.ContactRoleId == contactRoleId
                    && rp.PermissionKey == permissionKey
                    && rp.ClientId == body.ClientId);

            // Unified Permissions §8.3.4 — when AccessLevel is supplied it is
            // authoritative and Allowed is derived from it (>= View). When
            // omitted, fall back to the legacy Allowed-only write.
            var newLevel = body.AccessLevel;
            var allowed = newLevel.HasValue ? newLevel.Value >= 1 : body.Allowed;

            if (existing is null)
            {
                ctx.RolePermissions.Add(new RolePermission
                {
                    ContactRoleId = contactRoleId,
                    PermissionKey = permissionKey,
                    Allowed       = allowed,
                    AccessLevel   = newLevel,
                    ClientId      = body.ClientId
                });
                Log.Information("RolePermission inserted: ContactRoleId={ContactRoleId}, PermissionKey={PermissionKey}, ClientId={ClientId}, Allowed={Allowed}, AccessLevel={AccessLevel}",
                    contactRoleId, permissionKey, body.ClientId, allowed, newLevel);
            }
            else
            {
                var changed = false;
                if (existing.Allowed != allowed) { existing.Allowed = allowed; changed = true; }
                if (newLevel.HasValue && existing.AccessLevel != newLevel) { existing.AccessLevel = newLevel; changed = true; }
                if (changed)
                {
                    Log.Information("RolePermission updated: ContactRoleId={ContactRoleId}, PermissionKey={PermissionKey}, ClientId={ClientId}, Allowed={Allowed}, AccessLevel={AccessLevel}",
                        contactRoleId, permissionKey, body.ClientId, allowed, newLevel);
                }
                // else: no change — silent no-op, still returns 204
            }

            await ctx.SaveChangesAsync();
            return NoContent();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Failed to set RolePermission (ContactRoleId={ContactRoleId}, PermissionKey={PermissionKey})",
                contactRoleId, permissionKey);
            throw;
        }
    }
}
