using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Client compliance-profile overlays assigned to an agent/NP (Phase 4b-ii).

public class ComplianceProfileOptionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

// GET /agents/{id}/compliance-profiles — the assign picker's data.
public class AgentComplianceProfilesDto
{
    public List<ComplianceProfileOptionDto> Available { get; set; } = new();
    public List<int> AssignedProfileIds { get; set; } = new();
}

// PUT body — the full desired assignment set (replace semantics).
public class SetAgentProfilesDto
{
    public List<int> ProfileIds { get; set; } = new();
}

// GET /compliance-profiles/{id}/agents — reverse view (which NPs carry a profile).
public class ProfileAgentDto
{
    public int AgentId { get; set; }
    public string AgentName { get; set; } = string.Empty;
}
