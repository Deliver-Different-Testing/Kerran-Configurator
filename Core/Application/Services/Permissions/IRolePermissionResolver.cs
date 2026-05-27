using System.Collections.Generic;
using System.Threading.Tasks;

namespace DfrntDriveConfigurator.Core.Application.Services.Permissions;

// Phase 5+31 R3 — resolves the allowed-permission set for a given role
// (or for the current request's user). Backing data: dbo.Permission ×
// dbo.RolePermission seeded by 20260528090000_CreatePermissionAndRolePermissionMatrix.sql.
//
// Override precedence per Steve's §3.3 scoping recommendation:
//   ClientId IS NOT NULL  → per-client override row (wins for that role+permission+client)
//   ClientId IS NULL      → global default row (used when no per-client override exists)
//
// Both Allowed=true and Allowed=false rows are stored; the resolver builds
// an effective set by overlaying per-client overrides on top of global
// defaults, then filters to Allowed=true.
//
// DF Admin (UserGroupID=1) bypass returns the union of every permission
// key in the catalog — admins have access to everything regardless of
// role / client. Mirrors the R2 ClientTypeFeatureResolver bypass pattern.
//
// Sibling to IClientTypeFeatureResolver (visibility, ClientType-keyed).
// This resolver answers "WHICH actions is this user allowed to perform?",
// which is checked at controller entry via [RequirePermission(key)] +
// in the React UI via the usePermissions hook.
public interface IRolePermissionResolver
{
    /// <summary>
    /// Returns the allowed permission keys for the given role under the
    /// given client scope. clientId=null returns the role's global defaults;
    /// clientId=&lt;id&gt; overlays per-client overrides on top of the
    /// global defaults (override wins per (role, permission) pair).
    /// </summary>
    Task<HashSet<string>> ResolveAllowedPermissionsAsync(int contactRoleId, int? clientId);

    /// <summary>
    /// Returns the allowed permission keys for the current request's user.
    /// DF Admin (UserGroupID=1) bypass: returns the full catalog set.
    /// Otherwise reads the user's NpRoleId claim (emitted by Hub from
    /// tucClientContact.ContactRoleId) + ClientID claim (their tucClient)
    /// and resolves with per-client overrides applied. Returns an empty
    /// set when the user has no NpRoleId claim (defensive deny).
    /// </summary>
    Task<HashSet<string>> ResolveForCurrentUserAsync();
}
