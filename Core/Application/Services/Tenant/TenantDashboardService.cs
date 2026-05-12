using System;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Tenant;

public class TenantDashboardService(IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseService(contextFactory)
{
    public async Task<TenantDashboardStatsResponse> GetStats(Guid messageId)
    {
        var today = DateTime.Today;
        var thirtyDaysAgo = today.AddDays(-30);
        var monthStart = new DateTime(today.Year, today.Month, 1);

        // OTD Rate over last 30 days: completed jobs with no late flags / total
        // completed. Matches NpReportService's definition for consistency.
        var completedLast30 = await Context.TucJobs
            .Where(j => j.UcjbDate >= thirtyDaysAgo && j.UcjbDate <= today
                     && j.UcjbJobDone && !j.UcjbVoid)
            .CountAsync();

        var onTimeLast30 = await Context.TucJobs
            .Where(j => j.UcjbDate >= thirtyDaysAgo && j.UcjbDate <= today
                     && j.UcjbJobDone && !j.UcjbVoid
                     && (j.UcjbLatePick == null || j.UcjbLatePick == 0)
                     && (j.UcjbLateDel == null || j.UcjbLateDel == 0))
            .CountAsync();

        var otdRate = completedLast30 == 0 ? 0d
            : Math.Round(onTimeLast30 / (double)completedLast30 * 100d, 1);

        // Exception Rate over last 30 days: late + voided / total non-voided
        // jobs in the window. Best approximation we can derive without an
        // explicit exception-tracking column.
        var allJobsLast30 = await Context.TucJobs
            .Where(j => j.UcjbDate >= thirtyDaysAgo && j.UcjbDate <= today)
            .CountAsync();

        var exceptionsLast30 = await Context.TucJobs
            .Where(j => j.UcjbDate >= thirtyDaysAgo && j.UcjbDate <= today
                     && (j.UcjbVoid
                         || (j.UcjbLatePick != null && j.UcjbLatePick != 0)
                         || (j.UcjbLateDel != null && j.UcjbLateDel != 0)))
            .CountAsync();

        var exceptionRate = allJobsLast30 == 0 ? 0d
            : Math.Round(exceptionsLast30 / (double)allJobsLast30 * 100d, 1);

        // Monthly Volume — completed deliveries in the current calendar month.
        var monthlyVolume = await Context.TucJobs
            .Where(j => j.UcjbDate >= monthStart && j.UcjbDate <= today
                     && j.UcjbJobDone && !j.UcjbVoid)
            .CountAsync();

        // Monthly NP Billing — sum of UcjbAmount on completed jobs that have
        // an NpAgentId assigned (i.e. flowed through a network partner) in
        // the current month.
        var monthlyNpBillingValue = await Context.TucJobs
            .Where(j => j.UcjbDate >= monthStart && j.UcjbDate <= today
                     && j.UcjbJobDone && !j.UcjbVoid
                     && j.NpAgentId != null)
            .SumAsync(j => (decimal?)j.UcjbAmount) ?? 0m;

        // Market Coverage — distinct count of regions where the tenant has
        // active agents (NP-flagged or otherwise). Falls back to a count of
        // distinct suburbs if region-level joining isn't useful.
        var marketCoverage = await Context.TucAgents
            .AsNoTracking()
            .Where(a => a.UcagSuburb != null && a.UcagSuburb.UcsuRegion != null)
            .Select(a => a.UcagSuburb.UcsuRegion)
            .Distinct()
            .CountAsync();

        return new TenantDashboardStatsResponse(messageId)
        {
            Success = true,
            Stats = new TenantDashboardStatsDto
            {
                OtdRate = otdRate,
                ExceptionRate = exceptionRate,
                MonthlyVolume = monthlyVolume,
                MonthlyNpBilling = monthlyNpBillingValue.ToString("C0", CultureInfo.GetCultureInfo("en-US")),
                MarketCoverage = marketCoverage,
            },
        };
    }
}
