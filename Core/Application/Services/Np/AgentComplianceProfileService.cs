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

// Tenant-administered assignment of client ComplianceProfiles to agents/NPs
// (Phase 4b-ii, Option 1). Many-to-many via tucAgentComplianceProfile. The
// assigned profiles' required doc types are unioned into the agent's scorecard
// by NpAgentComplianceService. Tenant/DF-admin only (NPs don't self-assign).
public class AgentComplianceProfileService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    /// <summary>The assign-picker payload: all active profiles + the agent's current assignments.</summary>
    public async Task<AgentComplianceProfilesDto> GetForAgentAsync(int agentId, CancellationToken ct = default)
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

        var assigned = await Context.TucAgentComplianceProfiles.AsNoTracking()
            .Where(a => a.AgentId == agentId)
            .Select(a => a.ProfileId)
            .ToListAsync(ct);

        return new AgentComplianceProfilesDto { Available = available, AssignedProfileIds = assigned };
    }

    /// <summary>Replace the agent's assigned profiles with the supplied set.</summary>
    public async Task<AgentComplianceProfilesDto> SetForAgentAsync(int agentId, IReadOnlyCollection<int> profileIds, CancellationToken ct = default)
    {
        // Keep only valid, active, distinct profile ids.
        var requested = (profileIds ?? Array.Empty<int>()).Distinct().ToList();
        var validIds = requested.Count == 0
            ? new List<int>()
            : await Context.ComplianceProfiles.AsNoTracking()
                .Where(p => p.IsActive && requested.Contains(p.Id))
                .Select(p => p.Id)
                .ToListAsync(ct);

        var existing = await Context.TucAgentComplianceProfiles
            .Where(a => a.AgentId == agentId)
            .ToListAsync(ct);

        var existingIds = existing.Select(e => e.ProfileId).ToHashSet();
        var desired = validIds.ToHashSet();

        // Remove unassigned.
        var toRemove = existing.Where(e => !desired.Contains(e.ProfileId)).ToList();
        if (toRemove.Count > 0) Context.TucAgentComplianceProfiles.RemoveRange(toRemove);

        // Add newly-assigned.
        var actor = ResolveActor();
        foreach (var pid in desired.Where(d => !existingIds.Contains(d)))
        {
            Context.TucAgentComplianceProfiles.Add(new TucAgentComplianceProfile
            {
                AgentId = agentId,
                ProfileId = pid,
                AssignedDate = DateTime.UtcNow,
                AssignedBy = actor,
            });
        }

        await Context.SaveChangesAsync(ct);
        return await GetForAgentAsync(agentId, ct);
    }

    /// <summary>Reverse view — the agents/NPs that carry a given profile.</summary>
    public async Task<List<ProfileAgentDto>> GetAgentsForProfileAsync(int profileId, CancellationToken ct = default)
    {
        return await Context.TucAgentComplianceProfiles.AsNoTracking()
            .Where(a => a.ProfileId == profileId)
            .Join(Context.TucAgents.AsNoTracking(),
                a => a.AgentId, ag => ag.UcagId,
                (a, ag) => new ProfileAgentDto { AgentId = ag.UcagId, AgentName = ag.UcagName ?? string.Empty })
            .OrderBy(x => x.AgentName)
            .ToListAsync(ct);
    }

    private string ResolveActor() =>
        httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
        ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
        ?? "system";
}
