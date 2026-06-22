using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Courier modal §11 — compliance-profile ("role") assignment for a courier.
// Reuses ComplianceProfileOptionDto from the agent-side DTOs (same namespace).

// GET /couriers/{id}/compliance-profiles — the assign picker's data + the
// resolved required-document set (union of the assigned profiles' requirements).
public class CourierComplianceProfilesDto
{
    public List<ComplianceProfileOptionDto> Available { get; set; } = new();
    public List<int> AssignedProfileIds { get; set; } = new();
    // DocumentType ids required by the union of assigned profiles — drives the
    // required-doc list on the Compliance & Licensing tab.
    public List<int> RequiredDocumentTypeIds { get; set; } = new();
}

// PUT body — the full desired assignment set (replace semantics).
public class SetCourierProfilesDto
{
    public List<int> ProfileIds { get; set; } = new();
}
