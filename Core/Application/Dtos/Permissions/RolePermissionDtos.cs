using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Permissions;

// Phase 5+31 R3 — DTOs for the Role × Permission matrix endpoints.

/// <summary>
/// Full matrix view for the DF-admin matrix UI.
///   Roles       = row headers (3 rows from tblContactRole — NpAdmin /
///                 NpDispatcher / NpReadOnly, plus any future additions)
///   Permissions = column headers (9 catalog rows from dbo.Permission)
///   Matrix      = every RolePermission row (both global defaults where
///                 ClientId IS NULL and any per-client overrides).
/// </summary>
public record RolePermissionMatrixDto(
    IReadOnlyList<RoleRefDto>             Roles,
    IReadOnlyList<PermissionRefDto>       Permissions,
    IReadOnlyList<RolePermissionCellDto>  Matrix);

public record RoleRefDto(int ContactRoleId, string Name, string Description);

// Unified Permissions §4.2 — tree fields (ParentKey/Tier/AccessType/SortOrder)
// let the grid render tier-1 grouping headers + tri-state cells.
public record PermissionRefDto(
    string PermissionKey,
    string DisplayName,
    string Description,
    string Category,
    string ParentKey,
    byte Tier,
    byte AccessType,
    int SortOrder);

// AccessLevel (0=None,1=View,2=Edit,3=Action) supersedes Allowed; both are
// returned during the transition.
public record RolePermissionCellDto(
    int ContactRoleId,
    string PermissionKey,
    bool Allowed,
    byte? AccessLevel,
    int? ClientId);

/// <summary>
/// Body for PUT /api/admin/role-permissions/{contactRoleId}/{permissionKey}.
/// ClientId is optional — null/missing writes to the global default row;
/// non-null writes a per-client override row.
///
/// Mutable class (not positional record) per codebase [FromBody]
/// convention — see MEMORY.md note. Newtonsoft.Json model binding
/// works with both shapes but the convention exists for consistency.
/// </summary>
public class SetRolePermissionDto
{
    public bool Allowed { get; set; }

    // Unified Permissions §8.3.4 — optional graded level (0=None,1=View,
    // 2=Edit,3=Action). When supplied, the server writes AccessLevel and
    // derives Allowed = AccessLevel >= 1. When omitted, legacy Allowed-only
    // behaviour is preserved (AccessLevel left untouched).
    public byte? AccessLevel { get; set; }

    public int? ClientId { get; set; }
}
