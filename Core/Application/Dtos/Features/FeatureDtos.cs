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

// FEATURE_MATRIX_CASCADE_2026-06-07 — ParentKey/Tier/SortOrder surface the
// dbo.Feature tree so the matrix renders as a hub-tile cascade. Nullable on
// the wire: when no feature carries a ParentKey the UI falls back to the
// legacy flat-by-Category layout, so the backend can roll cascade data out
// one tile at a time. (camelCases to parentKey/tier/sortOrder for the React
// FeatureMatrixFeature interface.)
public record FeatureRefDto(
    string FeatureKey, string DisplayName, string Description, string Category,
    string ParentKey, int? Tier, int? SortOrder,
    // SEED-SCOPE-ALL-HUBS §2 — comma list of ISO country codes the feature is
    // limited to (NULL = available everywhere). Editable in the matrix; the
    // resolver intersects it with the tenant CountryCode at runtime.
    string AvailableCountries);

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

/// <summary>Body for PUT /api/admin/features/{featureKey}/available-countries.
/// Comma list of ISO country codes the feature is limited to; null/empty stores
/// NULL = available everywhere (SEED-SCOPE-ALL-HUBS §2).</summary>
public class SetAvailableCountriesDto
{
    public string? AvailableCountries { get; set; }
}
