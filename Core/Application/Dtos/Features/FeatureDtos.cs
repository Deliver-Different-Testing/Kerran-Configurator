using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Features;

// Phase 5+31 R2 §2 — DTOs for the Feature × ClientType matrix endpoints.

/// <summary>
/// Full matrix view for the DF-admin matrix UI. Shape:
///   ClientTypes = column headers (1..5)
///   Features    = row headers (13 seed rows + any future additions)
///   Matrix      = the (ClientTypeId, FeatureKey) → Visible cells that
///                 currently exist. Absent combinations render as
///                 unchecked / Visible=false in the UI.
/// </summary>
public record ClientTypeFeatureMatrixDto(
    IReadOnlyList<ClientTypeRefDto>          ClientTypes,
    IReadOnlyList<FeatureRefDto>             Features,
    IReadOnlyList<ClientTypeFeatureCellDto>  Matrix);

public record ClientTypeRefDto(int Id, string Name);

public record FeatureRefDto(string FeatureKey, string DisplayName, string Description, string Category);

public record ClientTypeFeatureCellDto(int ClientTypeId, string FeatureKey, bool Visible);

/// <summary>Body for PUT /api/admin/client-type-features/{clientTypeId}/{featureKey}.
/// Mutable class (not positional record) to match the codebase-wide [FromBody]
/// convention — every other request-body DTO in this repo uses
/// <c>public class XxxDto { public T Prop { get; set; } }</c> shape rather
/// than a positional record. Both bind correctly via Newtonsoft.Json
/// (configured at Program.cs:47 AddNewtonsoftJson); the convention exists
/// for consistency, not because records would fail.</summary>
public class SetVisibilityDto
{
    public bool Visible { get; set; }
}
