using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Unified Permissions §8.1 — the Users list + 3-tab Contact modal. Roles are
// now real ContactRoleIds (multi-role via tblContactContactRole), NOT the
// legacy hardcoded 1/2/3 NpRole mapping.

public class NpRoleRef
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

// List row (enriched: Client/NP name + role badges).
public class NpUserDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string ClientName { get; set; } = string.Empty;
    public List<NpRoleRef> Roles { get; set; } = new();
    public string Status { get; set; } = "active";
    public string LastLogin { get; set; } = string.Empty;
}

public class NpUsersResponse : BaseResponse
{
    public NpUsersResponse(Guid messageId) : base(messageId) { }
    public List<NpUserDto> Users { get; set; } = new();
}

// Detail — modal Profile tab load.
public class NpUserDetailDto
{
    public int Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string JobTitle { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string DirectDial { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public int? RelationshipTypeId { get; set; }
    public List<int> RoleIds { get; set; } = new();
    public string Status { get; set; } = "active";
    public int? ClientId { get; set; }
    public string ClientName { get; set; } = string.Empty;
    public int ClientTypeId { get; set; }   // drives clientType-aware role lookup in the modal
}

// Update — modal Save (Profile tab). Mutable class per [FromBody] convention.
public class NpUserUpdateDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string JobTitle { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string DirectDial { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public int? RelationshipTypeId { get; set; }
    public List<int> RoleIds { get; set; } = new();
    public string Status { get; set; } = "active";
}

// Create — Add User (modal Add mode).
public class NpUserCreateDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public List<int> RoleIds { get; set; } = new();
    public int? RelationshipTypeId { get; set; }
    public string JobTitle { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
}

public class NpUserResponse : BaseResponse
{
    public NpUserResponse(Guid messageId) : base(messageId) { }
    public NpUserDetailDto? User { get; set; }
}

// Tab 2 — resolved permissions, grouped by hub tile.
public class NpResolvedPerm
{
    public string Key { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public byte Level { get; set; }   // 0=None,1=View,2=Edit,3=Action
}

public class NpResolvedTile
{
    public string Key { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public byte Level { get; set; }
    public List<NpResolvedPerm> Items { get; set; } = new();
}

// Lookups for the modal.
public class NpRoleOptionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class NpRelationshipTypeDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

// Tab 3 — one audited field change (actor masked for non-DF viewers).
public class NpContactAuditDto
{
    public DateTime ChangedAt { get; set; }
    public string Field { get; set; } = string.Empty;
    public string OldValue { get; set; } = string.Empty;
    public string NewValue { get; set; } = string.Empty;
    public string ChangedBy { get; set; } = string.Empty;
}
