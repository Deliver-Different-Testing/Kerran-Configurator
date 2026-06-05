using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Permissions;

// Unified Permissions §8.2 — DTOs for the Role Management screens
// (Roles list + Role Detail modal). Backed by tblContactRole +
// tblRoleClientType + tblContactContactRole.

/// <summary>Row in the Roles list page (§8.2.1).</summary>
public record RoleListItemDto(
    int ContactRoleId,
    string Name,
    string Description,
    int? TenantClientId,
    string ScopeLabel,            // "Global Default" or the tenant's name
    IReadOnlyList<int> ClientTypeIds,
    int ContactCount,
    bool IsActive);

/// <summary>Role Detail modal payload (§8.2.2).</summary>
public record RoleDetailDto(
    int ContactRoleId,
    string Name,
    string Description,
    int? TenantClientId,
    IReadOnlyList<int> ClientTypeIds,
    bool IsActive,
    int AffectedContactsCount);   // contacts currently holding this role

/// <summary>Lookup pair for the Applies-To picker + matrix ClientType tabs.</summary>
public record ClientTypeRefDto(int Id, string Name);

/// <summary>Lookup pair for the Contact modal Relationship Type dropdown (§8.1).</summary>
public record RelationshipTypeRefDto(int RelationshipTypeId, string Name);

/// <summary>Client option for the matrix per-client override overlay (§8.3.1).</summary>
public record ClientRefDto(int Id, string Name, int ClientTypeId);

/// <summary>Permission tree + this role's graded cells (§8.2.2 Tab 3 / §8.3).</summary>
public record RolePermissionsForRoleDto(
    int ContactRoleId,
    IReadOnlyList<PermissionRefDto> Permissions,
    IReadOnlyList<RoleCellDto> Cells);

public record RoleCellDto(string PermissionKey, bool Allowed, byte? AccessLevel, int? ClientId);

// ---- Write bodies (mutable class per [FromBody] convention) --------------

public class CreateRoleDto
{
    public string Name { get; set; }
    public string Description { get; set; }
    public int? TenantClientId { get; set; }     // null = global default
    public List<int> ClientTypeIds { get; set; } = new();
}

public class UpdateRoleDto
{
    public string Name { get; set; }
    public string Description { get; set; }
    public bool IsActive { get; set; }
    public List<int> ClientTypeIds { get; set; } = new();
}
