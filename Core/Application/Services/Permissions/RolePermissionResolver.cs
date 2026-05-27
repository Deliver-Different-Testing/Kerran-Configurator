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
public class RolePermissionResolver(
    IHttpContextAccessor httpContextAccessor,
    IDbContextFactory<DynamicDespatchDbContext> contextFactory) : IRolePermissionResolver
{
    private const string CurrentUserCacheKey = "RolePermissions:currentUser";

    public async Task<HashSet<string>> ResolveAllowedPermissionsAsync(int contactRoleId, int? clientId)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync();

        // Load global defaults for the role first.
        var effective = await ctx.RolePermissions
            .AsNoTracking()
            .Where(rp => rp.ContactRoleId == contactRoleId && rp.ClientId == null)
            .Select(rp => new { rp.PermissionKey, rp.Allowed })
            .ToDictionaryAsync(x => x.PermissionKey, x => x.Allowed, StringComparer.OrdinalIgnoreCase);

        // Overlay per-client overrides if a client scope was supplied.
        // Overrides win regardless of Allowed value (Allowed=false override
        // REMOVES a permission that's enabled by the global default).
        if (clientId is > 0)
        {
            var overrides = await ctx.RolePermissions
                .AsNoTracking()
                .Where(rp => rp.ContactRoleId == contactRoleId && rp.ClientId == clientId.Value)
                .Select(rp => new { rp.PermissionKey, rp.Allowed })
                .ToListAsync();

            foreach (var o in overrides)
            {
                effective[o.PermissionKey] = o.Allowed;
            }
        }

        return new HashSet<string>(
            effective.Where(kv => kv.Value).Select(kv => kv.Key),
            StringComparer.OrdinalIgnoreCase);
    }

    public async Task<HashSet<string>> ResolveForCurrentUserAsync()
    {
        var httpCtx = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException(
                "RolePermissionResolver.ResolveForCurrentUserAsync called outside an HTTP request.");

        if (httpCtx.Items.TryGetValue(CurrentUserCacheKey, out var cached)
            && cached is HashSet<string> existing)
        {
            return existing;
        }

        var user = httpCtx.User;

        // DF Admin bypass — full catalog. Mirrors the R2
        // ClientTypeFeatureResolver bypass; matrix toggles never lock out
        // an admin (no foot-gun where an admin demotes themselves by
        // editing the wrong row).
        if (user.FindFirst("UserGroupID")?.Value == "1")
        {
            await using var ctx = await contextFactory.CreateDbContextAsync();
            var allKeys = await ctx.Permissions
                .AsNoTracking()
                .Select(p => p.PermissionKey)
                .ToListAsync();
            var adminResult = new HashSet<string>(allKeys, StringComparer.OrdinalIgnoreCase);
            httpCtx.Items[CurrentUserCacheKey] = adminResult;
            return adminResult;
        }

        // Non-admin: read NpRoleId + ClientID claims set by Hub at login.
        // NpRoleId is the tucClientContact.ContactRoleId (see §B.1 5+28a).
        // ClientID is the tucClient.UcclId (per-client scope for overrides).
        var roleClaim = user.FindFirst("NpRoleId")?.Value;
        if (!int.TryParse(roleClaim, out var contactRoleId) || contactRoleId <= 0)
        {
            Log.Debug(
                "RolePermissionResolver: no usable NpRoleId claim ('{Claim}') — returning empty allow-set (deny-by-default).",
                roleClaim ?? "(null)");
            var emptyResult = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            httpCtx.Items[CurrentUserCacheKey] = emptyResult;
            return emptyResult;
        }

        var clientIdClaim = user.FindFirst("ClientID")?.Value;
        int? clientId = null;
        if (int.TryParse(clientIdClaim, out var ci) && ci > 0)
        {
            clientId = ci;
        }

        var resolved = await ResolveAllowedPermissionsAsync(contactRoleId, clientId);
        httpCtx.Items[CurrentUserCacheKey] = resolved;
        return resolved;
    }
}
