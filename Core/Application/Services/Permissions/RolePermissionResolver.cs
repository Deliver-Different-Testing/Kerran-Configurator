using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Permissions;

/// <inheritdoc cref="IRolePermissionResolver"/>
//
// Unified Permissions (spec v1.1 §6) — extends the R3 resolver from a flat
// single-role allow-set into a graded, multi-role, tree-aware resolver:
//
//   1. Load ALL roles for the contact (tblContactContactRole, keyed on the
//      ContactID claim) — falls back to the single RoleId/NpRoleId claim
//      when the contact has no stacking rows (pre-backfill / non-NP).
//   2. Per role, take the per-client override row (ClientId = the contact's
//      client) when present, else the global default (ClientId IS NULL).
//   3. UNION across roles — most-permissive AccessLevel wins per key.
//   4. CASCADE down the tier tree — a granted tile flows to its children
//      unless a child has its own explicit level (downgrade allowed).
//   5. WALK UP — if any ancestor is EXPLICITLY None, the descendant is denied.
//
// AccessLevel ladder: 0=None, 1=View, 2=Edit, 3=Action. A row's level is
// its AccessLevel column, or — during the transition while some rows predate
// the backfill — Allowed ? (the permission's own AccessType) : None.
public class RolePermissionResolver(
    IHttpContextAccessor httpContextAccessor,
    IDbContextFactory<DynamicDespatchDbContext> contextFactory) : IRolePermissionResolver
{
    private const string LevelsCacheKey = "RolePermissions:currentUser:levels";

    // Lightweight projection of a permission tree node.
    private sealed record PermNode(string Key, string ParentKey, byte AccessType);

    // ---- Public API -------------------------------------------------------

    public async Task<HashSet<string>> ResolveAllowedPermissionsAsync(int contactRoleId, int? clientId)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync();
        var tree = await LoadTreeAsync(ctx);
        var levels = await ResolveLevelsForRolesAsync(ctx, new[] { contactRoleId }, clientId, tree);
        return ToAllowedSet(levels);
    }

    public async Task<HashSet<string>> ResolveForCurrentUserAsync()
        => ToAllowedSet(await ResolveAccessLevelsForCurrentUserAsync());

    public async Task<Dictionary<string, byte>> ResolveAccessLevelsForCurrentUserAsync()
    {
        var httpCtx = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException(
                "RolePermissionResolver called outside an HTTP request.");

        if (httpCtx.Items.TryGetValue(LevelsCacheKey, out var cached)
            && cached is Dictionary<string, byte> existing)
        {
            return existing;
        }

        var user = httpCtx.User;
        await using var ctx = await contextFactory.CreateDbContextAsync();
        var tree = await LoadTreeAsync(ctx);

        // DF Admin bypass — full catalog at the highest level each node
        // supports. Keyed on ClientType == 5 (DFRNTAdmin) so a tenant
        // Administrator on a ClientTypeId=4 client isn't treated as DF admin.
        if (user.FindFirst("ClientTypeId")?.Value == "5")
        {
            var adminLevels = tree.Values.ToDictionary(
                n => n.Key, n => n.AccessType, StringComparer.OrdinalIgnoreCase);
            httpCtx.Items[LevelsCacheKey] = adminLevels;
            return adminLevels;
        }

        // Resolve the contact's role id set. Prefer the stacking junction
        // (all roles via the ContactID claim); fall back to the single
        // RoleId ?? NpRoleId claim (transitional — Hub dual-writes RoleId).
        var roleIds = await ResolveRoleIdsAsync(ctx, user);
        if (roleIds.Count == 0)
        {
            var empty = new Dictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
            httpCtx.Items[LevelsCacheKey] = empty;
            return empty;
        }

        int? clientId = null;
        if (int.TryParse(user.FindFirst("ClientID")?.Value, out var ci) && ci > 0)
            clientId = ci;

        var levels = await ResolveLevelsForRolesAsync(ctx, roleIds, clientId, tree);
        httpCtx.Items[LevelsCacheKey] = levels;
        return levels;
    }

    public async Task<Dictionary<string, byte>> ResolveAccessLevelsForContactAsync(int clientContactId)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync();
        var tree = await LoadTreeAsync(ctx);

        // All stacked roles for this contact (active only).
        var roleIds = await ctx.TblContactContactRoles
            .AsNoTracking()
            .Where(j => j.ClientContactId == clientContactId)
            .Join(ctx.TblContactRoles.AsNoTracking().Where(r => r.IsActive),
                  j => j.ContactRoleId, r => r.ContactRoleId, (j, r) => r.ContactRoleId)
            .Distinct()
            .ToListAsync();

        // Fallback to the contact's single primary ContactRoleId (transitional).
        if (roleIds.Count == 0)
        {
            var single = await ctx.TucClientContacts.AsNoTracking()
                .Where(c => c.UcctId == clientContactId)
                .Select(c => c.ContactRoleId)
                .FirstOrDefaultAsync();
            if (single is int sid && sid > 0
                && await ctx.TblContactRoles.AsNoTracking().AnyAsync(r => r.ContactRoleId == sid && r.IsActive))
            {
                roleIds.Add(sid);
            }
        }

        if (roleIds.Count == 0)
            return new Dictionary<string, byte>(StringComparer.OrdinalIgnoreCase);

        var clientId = await ctx.TucClientContacts.AsNoTracking()
            .Where(c => c.UcctId == clientContactId)
            .Select(c => c.UcctClientId)
            .FirstOrDefaultAsync();

        return await ResolveLevelsForRolesAsync(ctx, roleIds, clientId, tree);
    }

    // ---- Internals --------------------------------------------------------

    // Determine the contact's role ids. Junction (stacking) first; single
    // claim fallback so pre-backfill / non-NP sessions still resolve.
    private async Task<List<int>> ResolveRoleIdsAsync(
        DynamicDespatchDbContext ctx, System.Security.Claims.ClaimsPrincipal user)
    {
        if (int.TryParse(user.FindFirst("ContactID")?.Value, out var contactId) && contactId > 0)
        {
            var stacked = await ctx.TblContactContactRoles
                .AsNoTracking()
                .Where(j => j.ClientContactId == contactId)
                .Join(ctx.TblContactRoles.AsNoTracking().Where(r => r.IsActive),
                      j => j.ContactRoleId, r => r.ContactRoleId, (j, r) => r.ContactRoleId)
                .Distinct()
                .ToListAsync();
            if (stacked.Count > 0)
                return stacked;
        }

        // Fallback: single role claim (RoleId supersedes NpRoleId; Hub
        // dual-writes both during the transition).
        var roleClaim = user.FindFirst("RoleId")?.Value
                        ?? user.FindFirst("NpRoleId")?.Value;
        if (int.TryParse(roleClaim, out var single) && single > 0)
        {
            // Honour IsActive even for the single-claim path.
            var active = await ctx.TblContactRoles.AsNoTracking()
                .AnyAsync(r => r.ContactRoleId == single && r.IsActive);
            if (active)
                return new List<int> { single };
        }

        Log.Debug("RolePermissionResolver: no usable role for contact — deny-by-default.");
        return new List<int>();
    }

    private static async Task<Dictionary<string, PermNode>> LoadTreeAsync(DynamicDespatchDbContext ctx)
    {
        var nodes = await ctx.Permissions
            .AsNoTracking()
            .Select(p => new PermNode(p.PermissionKey, p.ParentKey, p.AccessType))
            .ToListAsync();
        return nodes.ToDictionary(n => n.Key, n => n, StringComparer.OrdinalIgnoreCase);
    }

    // Core engine: union across roles → cascade → walk-up deny.
    private static async Task<Dictionary<string, byte>> ResolveLevelsForRolesAsync(
        DynamicDespatchDbContext ctx, IReadOnlyCollection<int> roleIds, int? clientId,
        Dictionary<string, PermNode> tree)
    {
        // Pull every relevant row in one query: global defaults + (if a
        // client scope is set) this client's override rows, for these roles.
        var rows = await ctx.RolePermissions
            .AsNoTracking()
            .Where(rp => roleIds.Contains(rp.ContactRoleId)
                         && (rp.ClientId == null || (clientId != null && rp.ClientId == clientId)))
            .Select(rp => new { rp.ContactRoleId, rp.PermissionKey, rp.ClientId, rp.AccessLevel, rp.Allowed })
            .ToListAsync();

        byte LevelOf(byte? accessLevel, bool allowed, string key)
        {
            if (accessLevel.HasValue) return accessLevel.Value;
            // Transitional fallback for rows predating the AccessLevel backfill.
            if (!allowed) return 0;
            return tree.TryGetValue(key, out var n) ? n.AccessType : (byte)2;
        }

        // Per (role, key): per-client override wins over the global default.
        var perRole = new Dictionary<(int Role, string Key), (bool IsOverride, byte Level)>();
        foreach (var r in rows)
        {
            var k = (r.ContactRoleId, r.PermissionKey);
            var isOverride = r.ClientId != null;
            var level = LevelOf(r.AccessLevel, r.Allowed, r.PermissionKey);
            if (!perRole.TryGetValue(k, out var cur) || (isOverride && !cur.IsOverride))
                perRole[k] = (isOverride, level);
        }

        // UNION across roles — most-permissive level per key.
        var explicitUnion = new Dictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
        foreach (var ((_, key), (_, level)) in perRole)
        {
            if (!explicitUnion.TryGetValue(key, out var cur) || level > cur)
                explicitUnion[key] = level;
        }

        // CASCADE + WALK-UP, resolved per node.
        var resolved = new Dictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
        foreach (var key in tree.Keys)
            resolved[key] = ResolveNode(key, tree, explicitUnion);
        return resolved;
    }

    // Resolve one node: explicit-None ancestor denies; else own explicit
    // level; else cascade from nearest ancestor with an explicit grant.
    private static byte ResolveNode(
        string key, Dictionary<string, PermNode> tree, Dictionary<string, byte> explicitUnion)
    {
        // Walk-up: any ancestor EXPLICITLY None => deny.
        var ancestor = tree.TryGetValue(key, out var self) ? self.ParentKey : null;
        while (ancestor != null && tree.TryGetValue(ancestor, out var an))
        {
            if (explicitUnion.TryGetValue(ancestor, out var al) && al == 0)
                return 0;
            ancestor = an.ParentKey;
        }

        // Own explicit level (may be a downgrade relative to the parent).
        if (explicitUnion.TryGetValue(key, out var own))
            return own;

        // Cascade: nearest ancestor with an explicit grant.
        var p = self?.ParentKey;
        while (p != null && tree.TryGetValue(p, out var pn))
        {
            if (explicitUnion.TryGetValue(p, out var pl))
                return pl;
            p = pn.ParentKey;
        }

        return 0;
    }

    private static HashSet<string> ToAllowedSet(Dictionary<string, byte> levels)
        => new(levels.Where(kv => kv.Value >= 1).Select(kv => kv.Key), StringComparer.OrdinalIgnoreCase);
}
