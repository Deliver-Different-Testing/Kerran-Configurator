using System;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

public class NpDashboardService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    INpScopeResolver scopeResolver) : BaseService(contextFactory)
{
    public async Task<NpDashboardStatsResponse> GetStats(Guid messageId)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return new NpDashboardStatsResponse(messageId)
            {
                Success = true,
                Stats = EmptyStats(),
            };
        }

        var today = DateTime.Today;
        // Match SQL Server's Sunday-start week to keep "revenue this week" stable
        // across server timezones.
        var startOfWeek = today.AddDays(-(int)today.DayOfWeek);

        var couriers = Context.TucCouriers.AsQueryable();
        var jobs = Context.TucJobs.AsQueryable();
        if (!scope.IsAdmin)
        {
            couriers = couriers.Where(c => c.NpAgentId == scope.NpAgentId!.Value);
            jobs = jobs.Where(j => j.NpAgentId == scope.NpAgentId!.Value);
        }

        var activeCouriers = await couriers
            .Where(c => c.Active && (c.UccrFinishDate == null || c.UccrFinishDate > today))
            .CountAsync();

        var jobsToday = await jobs
            .Where(j => j.UcjbDate == today && !j.UcjbVoid)
            .CountAsync();

        var completedToday = await jobs
            .Where(j => j.UcjbDate == today && j.UcjbJobDone && !j.UcjbVoid)
            .CountAsync();

        var revenue = await jobs
            .Where(j => j.UcjbDate >= startOfWeek && j.UcjbJobDone && !j.UcjbVoid)
            .SumAsync(j => (decimal?)j.UcjbAmount) ?? 0m;

        // Fetch the NP's display info for the welcome card. Admins viewing
        // without scope leave these null and the frontend hides the card.
        string? agentName = null;
        string? agentInitials = null;
        string? agentTier = null;
        if (scope.NpAgentId is { } scopedAgentId)
        {
            var agent = await Context.TucAgents
                .AsNoTracking()
                .Where(a => a.UcagId == scopedAgentId)
                .Select(a => new { a.UcagName, a.NpTier })
                .FirstOrDefaultAsync();

            if (agent is not null)
            {
                agentName = agent.UcagName ?? string.Empty;
                agentInitials = ComputeInitials(agentName);
                agentTier = agent.NpTier == 2 ? "Multi-Client" : "Base";
            }
        }

        return new NpDashboardStatsResponse(messageId)
        {
            Success = true,
            Stats = new NpDashboardStatsDto
            {
                ActiveCouriers = activeCouriers,
                JobsToday = jobsToday,
                Completed = completedToday,
                RevenueThisWeek = revenue.ToString("C0", CultureInfo.GetCultureInfo("en-US")),
                AgentName = agentName,
                AgentInitials = agentInitials,
                AgentTier = agentTier,
            },
        };
    }

    private static string ComputeInitials(string name)
    {
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return string.Empty;
        if (parts.Length == 1) return parts[0][..Math.Min(2, parts[0].Length)].ToUpperInvariant();
        return $"{char.ToUpperInvariant(parts[0][0])}{char.ToUpperInvariant(parts[1][0])}";
    }

    public async Task<NpActivityFeedResponse> GetActivityFeed(Guid messageId)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return new NpActivityFeedResponse(messageId) { Success = true, Items = [] };
        }

        // Last 5 completed jobs from today + a courier-name lookup. Keeps the
        // feed cheap; richer events (jobs assigned, shifts started, etc.) come
        // when the activity-tracking schema is plumbed.
        var today = DateTime.Today;

        var jobs = Context.TucJobs.AsQueryable();
        if (!scope.IsAdmin)
        {
            jobs = jobs.Where(j => j.NpAgentId == scope.NpAgentId!.Value);
        }

        var rows = await (
            from j in jobs
            join c in Context.TucCouriers on j.UcjbCourierId equals c.UccrId into jc
            from c in jc.DefaultIfEmpty()
            where j.UcjbDate == today && j.UcjbJobDone && !j.UcjbVoid
            orderby j.UcjbComplTime descending
            select new
            {
                j.UcjbNumber,
                j.UcjbComplTime,
                CourierFirst = c != null ? c.UccrName : null,
                CourierLast = c != null ? c.UccrSurname : null,
                j.UcjbFromAddr,
                j.UcjbToAddr,
            })
            .Take(5)
            .ToListAsync();

        var items = rows.Select(r => new NpActivityFeedItemDto
        {
            Time = r.UcjbComplTime?.ToString("HH:mm") ?? "—",
            Description = $"Job #{r.UcjbNumber} delivered by <strong>{(r.CourierFirst ?? "Unassigned")} {r.CourierLast}</strong>".Trim(),
        }).ToList();

        return new NpActivityFeedResponse(messageId)
        {
            Success = true,
            Items = items,
        };
    }

    private static NpDashboardStatsDto EmptyStats() => new()
    {
        ActiveCouriers = 0,
        JobsToday = 0,
        Completed = 0,
        RevenueThisWeek = 0m.ToString("C0", CultureInfo.GetCultureInfo("en-US")),
    };
}
