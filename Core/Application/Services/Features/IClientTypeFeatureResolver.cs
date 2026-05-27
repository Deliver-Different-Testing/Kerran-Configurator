using System.Collections.Generic;
using System.Threading.Tasks;

namespace DfrntDriveConfigurator.Core.Application.Services.Features;

// Phase 5+31 R2 §2 — resolves the visible-feature set for a given ClientType
// (or for the current request's user). Backing data: dbo.Feature ×
// dbo.ClientTypeFeature matrix seeded by 20260527090000_FeatureAndClientTypeFeatureMatrix.sql.
//
// Two surface methods:
//   ResolveVisibleFeaturesAsync(clientTypeId)  — data-driven, accepts any
//      ClientTypeId. NULL is treated as 2 (Customer) per §1.4. Used by the
//      DF-admin matrix UI when previewing what another ClientType would see.
//   ResolveForCurrentUserAsync()               — derives ClientTypeId from
//      the current request's user (ClientID claim → tucClient.ClientTypeId).
//      DF Admin (UserGroupID=1) bypass returns ALL feature keys regardless
//      of their tucClient's ClientTypeId — belt + braces against a DF admin
//      who hasn't been reparented to ClientType=5 yet.
//
// Per-request caching on HttpContext.Items so multiple consumers in the same
// request (sidebar + tile renderer + page section) only hit the DB once.
// Cache key includes ClientTypeId so multiple lookups in one request (e.g.
// admin previewing several types) cache independently.
//
// Sibling to INpFeatureResolver / INpScopeResolver — same shape, different
// concern. ClientType-feature is the COARSE gate (does this client-type
// see this surface at all?); NP-feature is the FINE gate (within the NP
// portal, which capabilities are enabled?); NP-scope is row-level (which
// rows does this NP see?). All three layered at service entry.
public interface IClientTypeFeatureResolver
{
    /// <summary>
    /// Returns the visible feature keys for the given ClientType. NULL →
    /// 2 (Customer) per §1.4 of the Permissions plan.
    /// </summary>
    Task<HashSet<string>> ResolveVisibleFeaturesAsync(int? clientTypeId);

    /// <summary>
    /// Returns the visible feature keys for the current request's user.
    /// DF Admin (UserGroupID=1) bypass: returns the union of every visible
    /// feature regardless of the user's tucClient. Otherwise resolves the
    /// user's ClientID claim → tucClient.ClientTypeId → matrix.
    /// </summary>
    Task<HashSet<string>> ResolveForCurrentUserAsync();
}
