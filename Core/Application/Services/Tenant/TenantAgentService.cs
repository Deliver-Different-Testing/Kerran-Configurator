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
        var agent = await Context.TucAgents.FirstOrDefaultAsync(a => a.UcagId == id);
        if (agent is null)
        {
            return Fail(messageId, "Agent not found.");
        }

        ApplyUpdate(agent, dto);
        var actor = ResolveActor();
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
        PostCode = a.PostCode ?? string.Empty,
        StatusId = a.StatusId,
        StatusName = a.Status != null ? (a.Status.AgentStatusName ?? string.Empty) : string.Empty,
        RankingId = a.RankingId,
        RankingName = a.Ranking != null ? (a.Ranking.AgentRankingName ?? string.Empty) : string.Empty,
        IsNetworkPartner = a.IsNetworkPartner,
        NpPortalEnabled = a.NpPortalEnabled,
        NpTier = a.NpTier,
        Notes = a.Notes ?? a.UcagNotes ?? string.Empty,
        Created = a.Created,
        LastModified = a.LastModified,
    };
}
