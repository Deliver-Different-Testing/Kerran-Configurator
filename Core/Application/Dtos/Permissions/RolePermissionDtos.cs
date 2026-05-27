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

public record PermissionRefDto(string PermissionKey, string DisplayName, string Description, string Category);

public record RolePermissionCellDto(
    int ContactRoleId,
    string PermissionKey,
    bool Allowed,
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
    public int? ClientId { get; set; }
}
