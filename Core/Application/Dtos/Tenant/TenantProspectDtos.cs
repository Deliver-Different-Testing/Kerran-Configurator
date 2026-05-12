using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Tenant;

// Read DTO for the ProspectAgent directory (the 821-row pre-seeded carrier
// list from migration 023). Powers the /agents/find page.
public class TenantProspectDto
{
    public int Id { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Association { get; set; } = string.Empty;
    public List<string> Specialties { get; set; } = new();
    public int? FleetSize { get; set; }
    public bool IsVerified { get; set; }
    public bool ConvertedToAgent { get; set; }
}

public class TenantProspectsResponse : BaseResponse
{
    public TenantProspectsResponse(Guid messageId) : base(messageId) { }
    public List<TenantProspectDto> Prospects { get; set; } = new();
}

// Returned by POST /api/v1/tenant/prospects/{id}/convert. Carries enough info
// for the frontend to navigate to the new agent's edit page if desired.
public class TenantProspectConvertResponse : BaseResponse
{
    public TenantProspectConvertResponse(Guid messageId) : base(messageId) { }
    public int? AgentId { get; set; }
    public string AgentName { get; set; } = string.Empty;
}
