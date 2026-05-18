using System;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Tenant;

public class TenantAgentService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    public async Task<TenantAgentsResponse> GetAll(Guid messageId)
    {
        // EF translates the navigation-property accesses into LEFT JOINs on
        // tucSuburb / tucAgentStatus / tucAgentRanking. Null-coalescing keeps
        // missing FKs (e.g. an agent with StatusId=null) from throwing.
        var rows = await Context.TucAgents
            .AsNoTracking()
            .OrderByDescending(a => a.IsNetworkPartner)   // NPs first
            .ThenBy(a => a.UcagName)
            .Select(ProjectToDto)
            .ToListAsync();

        return new TenantAgentsResponse(messageId)
        {
            Success = true,
            Agents = rows,
        };
    }

    public async Task<TenantAgentResponse> UpdateAsync(int id, TenantAgentUpsertDto dto, Guid messageId)
    {
        // Include the coverage rows so ApplyCoverageAreas can reconcile them.
        var agent = await Context.TucAgents
            .Include(a => a.AgentCoverageAreas)
            .FirstOrDefaultAsync(a => a.UcagId == id);
        if (agent is null)
        {
            return Fail(messageId, "Agent not found.");
        }

        var actor = ResolveActor();
        ApplyUpdate(agent, dto);
        ApplyCoverageAreas(agent, dto, actor);
        agent.LastModified = DateTime.UtcNow;
        agent.LastModifiedBy = actor;

        await Context.SaveChangesAsync();

        var read = await Context.TucAgents.AsNoTracking()
            .Where(a => a.UcagId == id)
            .Select(ProjectToDto)
            .FirstOrDefaultAsync();

        return new TenantAgentResponse(messageId)
        {
            Success = true,
            Agent = read,
        };
    }

    public async Task<TenantAgentResponse> CreateAsync(TenantAgentUpsertDto dto, Guid messageId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return Fail(messageId, "Name is required.");
        }

        var actor = ResolveActor();
        var now = DateTime.UtcNow;
        var agent = new TucAgent
        {
            UcagSuburbId = 152,                  // Default until a suburb picker exists.
            UcagAddress = string.Empty,
            UcagFax = string.Empty,
            UcagAltPhone = string.Empty,
            UcagAltFax = string.Empty,
            UcagNotes = string.Empty,
            CreatedBy = actor,
            LastModifiedBy = actor,
            Created = now,
            LastModified = now,
            Notes = string.Empty,
        };
        ApplyUpdate(agent, dto);
        ApplyCoverageAreas(agent, dto, actor);

        Context.TucAgents.Add(agent);
        await Context.SaveChangesAsync();

        var read = await Context.TucAgents.AsNoTracking()
            .Where(a => a.UcagId == agent.UcagId)
            .Select(ProjectToDto)
            .FirstOrDefaultAsync();

        return new TenantAgentResponse(messageId)
        {
            Success = true,
            Agent = read,
        };
    }

    private static void ApplyUpdate(TucAgent a, TenantAgentUpsertDto dto)
    {
        a.UcagName = dto.Name;
        a.UcagPhone = dto.Phone;
        a.AddressLine1 = dto.AddressLine1;
        a.PostCode = dto.PostCode;
        a.StatusId = dto.StatusId;
        a.RankingId = dto.RankingId;
        a.IsNetworkPartner = dto.IsNetworkPartner;
        a.NpPortalEnabled = dto.NpPortalEnabled;
        a.NpTier = dto.NpTier;
        a.Notes = dto.Notes;

        // Pass-4 fields (migration 029).
        a.Association = dto.Association;
        a.AssociationMemberId = dto.AssociationMemberId;
        a.ContactName = dto.ContactName;
        a.ContactEmail = dto.ContactEmail;
        a.DefaultCourierPayPercent = dto.DefaultCourierPayPercent;
    }

    // Reconciles the AgentCoverageArea child rows against the desired set on
    // the DTO: drops rows no longer wanted, adds rows that are new.
    // Case-insensitive + de-duped so a careless caller can't create "Chicago"
    // twice. Works for both create (empty starting collection) and update
    // (collection loaded via Include).
    private void ApplyCoverageAreas(TucAgent agent, TenantAgentUpsertDto dto, string actor)
    {
        var desired = (dto.CoverageAreas ?? Enumerable.Empty<string>())
            .Select(s => (s ?? string.Empty).Trim())
            .Where(s => s.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        // Delete rows no longer wanted via the DbSet — RemoveRange marks them
        // Deleted directly. Removing them from agent.AgentCoverageAreas instead
        // would make EF try to null the non-nullable AgentId FK ("relationship
        // severed"), since the scaffolded FK has no cascade-delete configured.
        var stale = agent.AgentCoverageAreas
            .Where(ca => !desired.Contains(ca.AreaName, StringComparer.OrdinalIgnoreCase))
            .ToList();
        if (stale.Count > 0)
            Context.AgentCoverageAreas.RemoveRange(stale);

        // Add rows not already present. Stale rows linger in the collection
        // but their names are (by definition) absent from `desired`, so they
        // never block a re-add.
        var existing = agent.AgentCoverageAreas
            .Select(ca => ca.AreaName)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var name in desired.Where(d => !existing.Contains(d)))
            agent.AgentCoverageAreas.Add(new AgentCoverageArea
            {
                AreaName = name,
                CreatedDate = DateTime.UtcNow,
                CreatedBy = actor,
            });
    }

    private string ResolveActor() =>
        httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
        ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
        ?? "system";

    private static TenantAgentResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
    };

    // Shared projection — used by GetAll and the post-mutation read so the
    // shapes never drift between read and write paths.
    private static readonly Expression<Func<TucAgent, TenantAgentDto>> ProjectToDto = a => new TenantAgentDto
    {
        Id = a.UcagId,
        Name = a.UcagName ?? string.Empty,
        Phone = a.UcagPhone ?? string.Empty,
        AddressLine1 = a.AddressLine1 ?? a.UcagAddress ?? string.Empty,
        City = a.UcagSuburb != null ? (a.UcagSuburb.City ?? a.UcagSuburb.UcsuName ?? string.Empty) : string.Empty,
        State = a.AddressLine6 ?? string.Empty,
        PostCode = a.PostCode ?? string.Empty,
        StatusId = a.StatusId,
        StatusName = a.Status != null ? (a.Status.AgentStatusName ?? string.Empty) : string.Empty,
        RankingId = a.RankingId,
        RankingName = a.Ranking != null ? (a.Ranking.AgentRankingName ?? string.Empty) : string.Empty,
        IsNetworkPartner = a.IsNetworkPartner,
        NpPortalEnabled = a.NpPortalEnabled,
        NpTier = a.NpTier,
        Notes = a.Notes ?? a.UcagNotes ?? string.Empty,
        Association = a.Association ?? string.Empty,
        AssociationMemberId = a.AssociationMemberId ?? string.Empty,
        ContactName = a.ContactName ?? string.Empty,
        ContactEmail = a.ContactEmail ?? string.Empty,
        DefaultCourierPayPercent = a.DefaultCourierPayPercent,
        CoverageAreas = a.AgentCoverageAreas
            .OrderBy(ca => ca.AreaName)
            .Select(ca => ca.AreaName)
            .ToList(),
        Created = a.Created,
        LastModified = a.LastModified,
    };
}
