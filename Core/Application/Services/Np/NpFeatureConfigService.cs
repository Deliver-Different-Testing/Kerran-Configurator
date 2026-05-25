using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// CRUD for per-NP feature toggles. Backs the DF Admin feature-flags UI.
//
// Read shape: outer join NpFeatureConfig over TucAgent — every NP appears in
// the list whether or not it has a config row. NPs without a row are shown
// with the schema defaults (NpFeatures.Defaults), so the UI can render their
// effective values and the first toggle save promotes them to an explicit row.
//
// Write shape: PUT is upsert. CreatedDate stamped on first write; UpdatedDate
// re-stamped on every write. NPs cannot edit their own flags — controller is
// DF-Admin-only — so we don't NP-scope here.
public class NpFeatureConfigService(IDbContextFactory<DynamicDespatchDbContext> contextFactory)
    : BaseService(contextFactory)
{
    public async Task<NpFeatureConfigsResponse> GetAll(Guid messageId)
    {
        var agents = await Context.TucAgents.AsNoTracking()
            .Select(a => new { a.UcagId, a.UcagName })
            .OrderBy(a => a.UcagName)
            .ToListAsync();

        var configs = await Context.NpFeatureConfigs.AsNoTracking().ToListAsync();
        var byAgent = configs.ToDictionary(c => c.AgentId);

        var rows = agents.Select(a =>
        {
            if (byAgent.TryGetValue(a.UcagId, out var c))
            {
                return new NpFeatureConfigDto
                {
                    AgentId = a.UcagId,
                    AgentName = a.UcagName ?? string.Empty,
                    HasConfigRow = true,
                    CanCreateTasks = c.CanCreateTasks,
                    CanAddStops = c.CanAddStops,
                    CanSeeFlightInfo = c.CanSeeFlightInfo,
                    CanAccessScheduler = c.CanAccessScheduler,
                    CanManageApplicants = c.CanManageApplicants,
                    MultiClientEnabled = c.MultiClientEnabled,
                    AutoDispatchEnabled = c.AutoDispatchEnabled,
                    UpdatedDate = c.UpdatedDate,
                };
            }
            var d = NpFeatures.Defaults;
            return new NpFeatureConfigDto
            {
                AgentId = a.UcagId,
                AgentName = a.UcagName ?? string.Empty,
                HasConfigRow = false,
                CanCreateTasks = d.CanCreateTasks,
                CanAddStops = d.CanAddStops,
                CanSeeFlightInfo = d.CanSeeFlightInfo,
                CanAccessScheduler = d.CanAccessScheduler,
                CanManageApplicants = d.CanManageApplicants,
                MultiClientEnabled = d.MultiClientEnabled,
                AutoDispatchEnabled = d.AutoDispatchEnabled,
                UpdatedDate = null,
            };
        }).ToList();

        return new NpFeatureConfigsResponse(messageId) { Success = true, Configs = rows };
    }

    public async Task<NpFeatureConfigResponse> GetByAgentId(int agentId, Guid messageId)
    {
        var agent = await Context.TucAgents.AsNoTracking()
            .Where(a => a.UcagId == agentId)
            .Select(a => new { a.UcagId, a.UcagName })
            .FirstOrDefaultAsync();
        if (agent is null)
            return Fail(messageId, $"NP agent {agentId} not found.");

        var c = await Context.NpFeatureConfigs.AsNoTracking()
            .FirstOrDefaultAsync(x => x.AgentId == agentId);

        var dto = c is null
            ? BuildDefaults(agent.UcagId, agent.UcagName ?? string.Empty)
            : new NpFeatureConfigDto
            {
                AgentId = agent.UcagId,
                AgentName = agent.UcagName ?? string.Empty,
                HasConfigRow = true,
                CanCreateTasks = c.CanCreateTasks,
                CanAddStops = c.CanAddStops,
                CanSeeFlightInfo = c.CanSeeFlightInfo,
                CanAccessScheduler = c.CanAccessScheduler,
                CanManageApplicants = c.CanManageApplicants,
                MultiClientEnabled = c.MultiClientEnabled,
                AutoDispatchEnabled = c.AutoDispatchEnabled,
                UpdatedDate = c.UpdatedDate,
            };

        return new NpFeatureConfigResponse(messageId) { Success = true, Config = dto };
    }

    public async Task<NpFeatureConfigResponse> UpsertAsync(int agentId, NpFeatureConfigUpsertDto dto, Guid messageId)
    {
        var agent = await Context.TucAgents.AsNoTracking()
            .Where(a => a.UcagId == agentId)
            .Select(a => new { a.UcagId, a.UcagName })
            .FirstOrDefaultAsync();
        if (agent is null)
            return Fail(messageId, $"NP agent {agentId} not found.");

        var row = await Context.NpFeatureConfigs.FirstOrDefaultAsync(x => x.AgentId == agentId);
        var now = DateTime.UtcNow;
        var isNew = row is null;

        if (row is null)
        {
            row = new NpFeatureConfig { AgentId = agentId, CreatedDate = now };
            Context.NpFeatureConfigs.Add(row);
        }

        row.CanCreateTasks = dto.CanCreateTasks;
        row.CanAddStops = dto.CanAddStops;
        row.CanSeeFlightInfo = dto.CanSeeFlightInfo;
        row.CanAccessScheduler = dto.CanAccessScheduler;
        row.CanManageApplicants = dto.CanManageApplicants;
        row.MultiClientEnabled = dto.MultiClientEnabled;
        row.AutoDispatchEnabled = dto.AutoDispatchEnabled;
        row.UpdatedDate = now;

        await Context.SaveChangesAsync();

        return new NpFeatureConfigResponse(messageId)
        {
            Success = true,
            Config = new NpFeatureConfigDto
            {
                AgentId = agent.UcagId,
                AgentName = agent.UcagName ?? string.Empty,
                HasConfigRow = true,
                CanCreateTasks = row.CanCreateTasks,
                CanAddStops = row.CanAddStops,
                CanSeeFlightInfo = row.CanSeeFlightInfo,
                CanAccessScheduler = row.CanAccessScheduler,
                CanManageApplicants = row.CanManageApplicants,
                MultiClientEnabled = row.MultiClientEnabled,
                AutoDispatchEnabled = row.AutoDispatchEnabled,
                UpdatedDate = row.UpdatedDate,
            },
        };
    }

    private static NpFeatureConfigDto BuildDefaults(int agentId, string agentName)
    {
        var d = NpFeatures.Defaults;
        return new NpFeatureConfigDto
        {
            AgentId = agentId,
            AgentName = agentName,
            HasConfigRow = false,
            CanCreateTasks = d.CanCreateTasks,
            CanAddStops = d.CanAddStops,
            CanSeeFlightInfo = d.CanSeeFlightInfo,
            CanAccessScheduler = d.CanAccessScheduler,
            CanManageApplicants = d.CanManageApplicants,
            MultiClientEnabled = d.MultiClientEnabled,
            AutoDispatchEnabled = d.AutoDispatchEnabled,
            UpdatedDate = null,
        };
    }

    private static NpFeatureConfigResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new() { Message = message } },
    };
}
