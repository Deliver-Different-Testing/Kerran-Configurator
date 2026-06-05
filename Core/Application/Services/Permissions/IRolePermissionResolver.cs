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
    /// Returns the allowed permission keys (AccessLevel >= View) for the
    /// current request's user. DF Admin (ClientTypeId=5) bypass returns the
    /// full catalog. Otherwise resolves the union of the contact's stacked
    /// roles (tblContactContactRole via the ContactID claim, falling back to
    /// the single RoleId/NpRoleId claim) with per-client overrides + tier
    /// cascade applied. Empty set when the user has no resolvable role.
    /// </summary>
    Task<HashSet<string>> ResolveForCurrentUserAsync();

    /// <summary>
    /// Unified Permissions §6 — like <see cref="ResolveForCurrentUserAsync"/>
    /// but returns the graded AccessLevel per permission key (0=None, 1=View,
    /// 2=Edit, 3=Action) after union + cascade + walk-up. Powers the tri-state
    /// matrix + the Contact modal's resolved-permissions view.
    /// </summary>
    Task<Dictionary<string, byte>> ResolveAccessLevelsForCurrentUserAsync();

    /// <summary>
    /// Resolves the graded AccessLevel map for a SPECIFIC contact (by
    /// tucClientContact PK), independent of the current request's user. Loads
    /// the contact's stacked roles (tblContactContactRole, falling back to the
    /// single ContactRoleId) + their client scope, then runs the same
    /// union + cascade + walk-up engine. Powers the Contact modal's read-only
    /// "what can this user actually do" Permissions tab (§8.1 Tab 2).
    /// </summary>
    Task<Dictionary<string, byte>> ResolveAccessLevelsForContactAsync(int clientContactId);
}
