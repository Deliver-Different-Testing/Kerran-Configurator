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
    public string Role { get; set; } = "Dispatcher";
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
    public string Role { get; set; } = "Dispatcher";       // "Admin" | "Dispatcher" | "Read-Only"
    public string Status { get; set; } = "active";         // "active" | "inactive"
}

public class NpUserResponse : BaseResponse
{
    public NpUserResponse(Guid messageId) : base(messageId) { }
    public NpUserDto? User { get; set; }
}
