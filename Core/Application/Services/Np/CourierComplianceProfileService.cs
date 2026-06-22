using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Courier modal §11 — tenant-administered assignment of ComplianceProfiles
// ("roles") to a courier. Many-to-many via tucCourierComplianceProfile
// (database/054). The assigned profiles' required DocumentTypes are unioned
// into the courier's required-document list on the Compliance & Licensing tab.
// Mirrors the agent-side AgentComplianceProfileService. Tenant/DF-admin only.
public class CourierComplianceProfileService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    /// <summary>Assign-picker payload: active profiles + the courier's current
    /// assignments + the resolved required-document-type set.</summary>
    public async Task<CourierComplianceProfilesDto> GetForCourierAsync(int courierId, CancellationToken ct = default)
    {
        var available = await Context.ComplianceProfiles.AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.Name)
            .Select(p => new ComplianceProfileOptionDto
            {
                Id = p.Id,
                Name = p.Name ?? string.Empty,
                Description = p.Description ?? string.Empty,
            })
            .ToListAsync(ct);

        var assigned = await Context.CourierComplianceProfiles.AsNoTracking()
            .Where(a => a.CourierId == courierId)
            .Select(a => a.ProfileId)
            .ToListAsync(ct);

        var requiredDocTypeIds = assigned.Count == 0
            ? new List<int>()
            : await Context.ComplianceProfileRequirements.AsNoTracking()
                .Where(r => assigned.Contains(r.ProfileId))
                .Select(r => r.DocumentTypeId)
                .Distinct()
                .ToListAsync(ct);

        return new CourierComplianceProfilesDto
        {
            Available = available,
            AssignedProfileIds = assigned,
            RequiredDocumentTypeIds = requiredDocTypeIds,
        };
    }

    /// <summary>Replace the courier's assigned profiles with the supplied set.
    /// Removing a profile only drops the assignment row — it never deletes the
    /// courier's uploaded documents (those just become no-longer-required).</summary>
    public async Task<CourierComplianceProfilesDto> SetForCourierAsync(int courierId, IReadOnlyCollection<int> profileIds, CancellationToken ct = default)
    {
        var requested = (profileIds ?? Array.Empty<int>()).Distinct().ToList();
        var validIds = requested.Count == 0
            ? new List<int>()
            : await Context.ComplianceProfiles.AsNoTracking()
                .Where(p => p.IsActive && requested.Contains(p.Id))
                .Select(p => p.Id)
                .ToListAsync(ct);

        var existing = await Context.CourierComplianceProfiles
            .Where(a => a.CourierId == courierId)
            .ToListAsync(ct);

        var existingIds = existing.Select(e => e.ProfileId).ToHashSet();
        var desired = validIds.ToHashSet();

        var toRemove = existing.Where(e => !desired.Contains(e.ProfileId)).ToList();
        if (toRemove.Count > 0) Context.CourierComplianceProfiles.RemoveRange(toRemove);

        var actor = ResolveActor();
        foreach (var pid in desired.Where(d => !existingIds.Contains(d)))
        {
            Context.CourierComplianceProfiles.Add(new CourierComplianceProfile
            {
                CourierId = courierId,
                ProfileId = pid,
                AssignedDate = DateTime.UtcNow,
                AssignedBy = actor,
            });
        }

        await Context.SaveChangesAsync(ct);
        return await GetForCourierAsync(courierId, ct);
    }

    private string ResolveActor() =>
        httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
        ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
        ?? "system";
}
