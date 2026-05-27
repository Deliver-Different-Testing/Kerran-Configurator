using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Permissions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Authorization;

// Phase 5+31 R3 — action-level permission gate.
//
// Usage on a controller method:
//
//     [HttpPost]
//     [RequirePermission("manage-users")]
//     public Task<IActionResult> CreateUser(...) { ... }
//
// On request: resolves the current user's allowed-permission set via
// IRolePermissionResolver.ResolveForCurrentUserAsync(); if the configured
// PermissionKey isn't in the set, short-circuits with 403 Forbidden.
//
// DF Admin (UserGroupID=1) bypasses every gate via the resolver's bypass.
// Users without an NpRoleId claim are denied (defensive default).
//
// Replaces the 9 hardcoded NP authorization policies (NpManageUsers /
// NpEditSettings / etc.) wired in §B.2 — the matrix is now the source
// of truth for "which role gets which permission", swappable at runtime
// via the matrix UI without a code change.
//
// AsyncFilter pattern with service-locator (RequestServices.GetRequiredService)
// is the standard .NET approach for attributes that need DI — the
// alternative TypeFilter/ServiceFilter pattern is verbose for a simple
// per-method gate.
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false, Inherited = true)]
public sealed class RequirePermissionAttribute(string permissionKey) : Attribute, IAsyncAuthorizationFilter
{
    public string PermissionKey { get; } = permissionKey
        ?? throw new ArgumentNullException(nameof(permissionKey));

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var resolver = context.HttpContext.RequestServices.GetRequiredService<IRolePermissionResolver>();
        var allowed = await resolver.ResolveForCurrentUserAsync();

        if (allowed.Contains(PermissionKey)) return;

        Log.Information(
            "RequirePermission deny: user lacks permission '{PermissionKey}' for {Method} {Path}",
            PermissionKey, context.HttpContext.Request.Method, context.HttpContext.Request.Path);
        context.Result = new ForbidResult();
    }
}
