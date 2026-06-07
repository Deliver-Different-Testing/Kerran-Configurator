using System;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Features;
using DfrntDriveConfigurator.Core.Application.Services.Features;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers;

// Phase 5+31 R2 §2 — endpoints over the dbo.Feature × dbo.ClientTypeFeature
// matrix added by 20260527090000_FeatureAndClientTypeFeatureMatrix.sql.
//
// Three endpoints per Steve's spec:
//   GET  /api/me/visible-features                               (any authed)
//   GET  /api/admin/client-type-features                        (AdminOnly)
//   PUT  /api/admin/client-type-features/{clientTypeId}/{featureKey}  (AdminOnly)
//
// The resolver does the per-request caching + the DF-admin bypass + the
// NULL→Customer rule. This controller is a thin shell over it.
[ApiController]
[Route("api")]
[Authorize]
public class FeaturesController(
    IClientTypeFeatureResolver resolver,
    IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseController
{
    /// <summary>
    /// Returns the feature keys the current user's ClientType can see.
    /// DF Admin bypass returns the union of every visible key. Used by the
    /// configurator sidebar + Hub tile renderer + per-page section gates to
    /// decide whether to render a surface.
    /// </summary>
    [HttpGet("me/visible-features")]
    public async Task<ActionResult<string[]>> GetMyVisibleFeatures()
    {
        try
        {
            var keys = await resolver.ResolveForCurrentUserAsync();
            // Sort for stable client-side comparisons / cache hashing.
            return Ok(keys.OrderBy(k => k, StringComparer.Ordinal).ToArray());
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Failed to resolve visible features for current user");
            throw;
        }
    }

    /// <summary>
    /// Returns the full ClientType × Feature matrix for the DF-admin matrix UI.
    /// Includes ALL ClientTypes + ALL Features so the UI can render empty
    /// (Visible=false) cells for combinations the matrix doesn't currently
    /// contain a row for.
    /// </summary>
    [HttpGet("admin/client-type-features")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ClientTypeFeatureMatrixDto>> GetMatrix()
    {
        try
        {
            await using var ctx = await contextFactory.CreateDbContextAsync();

            var clientTypes = await ctx.ClientTypes
                .AsNoTracking()
                .OrderBy(ct => ct.Id)
                .Select(ct => new ClientTypeRefDto(ct.Id, ct.Name))
                .ToListAsync();

            // Order by SortOrder (cascade tree ordering) then Category/key as a
            // stable fallback for rows that haven't been given a SortOrder yet.
            // The React side rebuilds the forest from ParentKey + re-sorts, so
            // this ordering only affects the legacy flat-by-category fallback.
            var features = await ctx.Features
                .AsNoTracking()
                .OrderBy(f => f.SortOrder == null).ThenBy(f => f.SortOrder)
                .ThenBy(f => f.Category).ThenBy(f => f.FeatureKey)
                .Select(f => new FeatureRefDto(
                    f.FeatureKey, f.DisplayName, f.Description, f.Category,
                    f.ParentKey, f.Tier, f.SortOrder))
                .ToListAsync();

            var cells = await ctx.ClientTypeFeatures
                .AsNoTracking()
                .Select(ctf => new ClientTypeFeatureCellDto(ctf.ClientTypeId, ctf.FeatureKey, ctf.Visible))
                .ToListAsync();

            return Ok(new ClientTypeFeatureMatrixDto(clientTypes, features, cells));
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Failed to load ClientType × Feature matrix");
            throw;
        }
    }

    /// <summary>
    /// Upsert a single (ClientTypeId, FeatureKey) cell. Body { visible: bool }.
    /// Creates the row if absent, updates Visible if present. Returns 204.
    /// Validates both ClientTypeId and FeatureKey reference real rows so the
    /// caller gets a clean 404 instead of a SaveChanges FK violation.
    /// </summary>
    [HttpPut("admin/client-type-features/{clientTypeId:int}/{featureKey}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> SetVisibility(
        int clientTypeId, string featureKey, [FromBody] SetVisibilityDto body)
    {
        if (body is null)
            return BadRequest(new { error = "Request body required." });
        if (string.IsNullOrWhiteSpace(featureKey))
            return BadRequest(new { error = "featureKey is required." });

        try
        {
            await using var ctx = await contextFactory.CreateDbContextAsync();

            var clientTypeExists = await ctx.ClientTypes.AnyAsync(ct => ct.Id == clientTypeId);
            if (!clientTypeExists)
                return NotFound(new { error = $"Unknown ClientType id={clientTypeId}." });

            var featureExists = await ctx.Features.AnyAsync(f => f.FeatureKey == featureKey);
            if (!featureExists)
                return NotFound(new { error = $"Unknown FeatureKey '{featureKey}'." });

            var existing = await ctx.ClientTypeFeatures
                .FirstOrDefaultAsync(c => c.ClientTypeId == clientTypeId && c.FeatureKey == featureKey);

            if (existing is null)
            {
                ctx.ClientTypeFeatures.Add(new ClientTypeFeature
                {
                    ClientTypeId = clientTypeId,
                    FeatureKey   = featureKey,
                    Visible      = body.Visible
                });
                Log.Information("ClientTypeFeature inserted: ClientTypeId={ClientTypeId}, FeatureKey={FeatureKey}, Visible={Visible}",
                    clientTypeId, featureKey, body.Visible);
            }
            else if (existing.Visible != body.Visible)
            {
                existing.Visible = body.Visible;
                Log.Information("ClientTypeFeature updated: ClientTypeId={ClientTypeId}, FeatureKey={FeatureKey}, Visible={Visible}",
                    clientTypeId, featureKey, body.Visible);
            }
            // else: no change — silent no-op, still returns 204

            await ctx.SaveChangesAsync();
            return NoContent();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Failed to set ClientTypeFeature visibility (ClientTypeId={ClientTypeId}, FeatureKey={FeatureKey})",
                clientTypeId, featureKey);
            throw;
        }
    }
}
