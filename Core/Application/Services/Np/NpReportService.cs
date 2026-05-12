using System;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

public class NpReportService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    INpScopeResolver scopeResolver) : BaseService(contextFactory)
{
    public async Task<NpReportDataResponse> GetData(DateTime from, DateTime to, Guid messageId)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return new NpReportDataResponse(messageId)
            {
                Success = true,
                Data = EmptyData(),
            };
        }

        // Inclusive of both endpoints — the UI sends date-only ranges.
        var fromDate = from.Date;
        var toDate = to.Date;

        var jobs = Context.TucJobs
            .Where(j => j.UcjbDate >= fromDate && j.UcjbDate <= toDate && !j.UcjbVoid);

        if (!scope.IsAdmin)
        {
            jobs = jobs.Where(j => j.NpAgentId == scope.NpAgentId!.Value);
        }

        var completedJobs = jobs.Where(j => j.UcjbJobDone);

        var jobsCompleted = await completedJobs.CountAsync();

        // On-time: completed jobs where neither pickup nor delivery were flagged late.
        var onTime = await completedJobs
            .Where(j => (j.UcjbLatePick == null || j.UcjbLatePick == 0)
                     && (j.UcjbLateDel == null || j.UcjbLateDel == 0))
            .CountAsync();

        var onTimePercent = jobsCompleted == 0
            ? 0d
            : Math.Round((onTime / (double)jobsCompleted) * 100d, 1);

        var revenue = await completedJobs
            .SumAsync(j => (decimal?)j.UcjbAmount) ?? 0m;

        var dailyRows = await completedJobs
            .GroupBy(j => j.UcjbDate)
            .Select(g => new { Date = g.Key, Count = g.Count() })
            .OrderBy(g => g.Date)
            .ToListAsync();

        var dailyVolume = dailyRows
            .Select(r => new NpReportDailyVolumeDto
            {
                Day = r.Date.ToString("ddd", CultureInfo.InvariantCulture),
                Value = r.Count,
            })
            .ToList();

        return new NpReportDataResponse(messageId)
        {
            Success = true,
            Data = new NpReportDataDto
            {
                JobsCompleted = jobsCompleted,
                OnTimePercent = onTimePercent,
                Revenue = revenue.ToString("C0", CultureInfo.GetCultureInfo("en-US")),
                DailyVolume = dailyVolume,
            },
        };
    }

    private static NpReportDataDto EmptyData() => new()
    {
        JobsCompleted = 0,
        OnTimePercent = 0d,
        Revenue = 0m.ToString("C0", CultureInfo.GetCultureInfo("en-US")),
        DailyVolume = [],
    };
}
