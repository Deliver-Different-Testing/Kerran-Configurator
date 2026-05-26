using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Shape matches the React User type at wwwroot/app/react/types/index.ts.
public class NpUserDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "Admin";       // Phase 5+27.2 — Steve req'd Administrator as the default
    public string Status { get; set; } = "active";
    public string LastLogin { get; set; } = string.Empty;
}

public class NpUsersResponse : BaseResponse
{
    public NpUsersResponse(Guid messageId) : base(messageId) { }
    public List<NpUserDto> Users { get; set; } = new();
}

// Editable subset for PUT /api/v1/np/users/{id}. Drops Id (path param) and
// LastLogin (server-computed from tblUser.LastAccessed).
public class NpUserUpdateDto
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "Admin";       // Phase 5+27.2 — Steve req'd Administrator as the default       // "Admin" | "Dispatcher" | "Read-Only"
    public string Status { get; set; } = "active";         // "active" | "inactive"
}

// Phase 5+28b §B.2 — Add User from the NP team page. Operator-supplied
// name + email + role. Backend resolves the caller's NP scope, creates a
// tucClientContact under it, and calls the Hub invite cascade so the new
// user gets a set-password email. Role names map to tblContactRole IDs
// (1=Admin / 2=Dispatcher / 3=Read-Only) — see NpRole enum.
public class NpUserCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "Admin";       // Phase 5+27.2 — Steve req'd Administrator as the default       // "Admin" | "Dispatcher" | "Read-Only"
}

public class NpUserResponse : BaseResponse
{
    public NpUserResponse(Guid messageId) : base(messageId) { }
    public NpUserDto? User { get; set; }
}
