using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Contacts;

// Unified Permissions §8.1 — DF-Admin multi-lane Team & Users surface. The
// list/detail/permissions/history/lookup payloads reuse the Np* DTOs (same
// shapes); these two add the cross-lane bits the NP page didn't need:
// an explicit target ClientId (which client the contact belongs to / moves to).

public class AdminContactCreateDto
{
    public int ClientId { get; set; }            // target client (lane decided by its ClientType)
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public List<int> RoleIds { get; set; } = new();
    public int? RelationshipTypeId { get; set; }
    public string JobTitle { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
}

public class AdminContactUpdateDto
{
    public int? ClientId { get; set; }           // non-null = move contact to this client (§B row 4)
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
