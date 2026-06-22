using System;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Courier;

namespace DfrntDriveConfigurator.Core.Application.Services.Courier;

/// <summary>
/// Courier Portal (finish-line P0) — dashboard tile stats. This is purely an
/// aggregator: it composes the existing Runs / Schedule / Documents services
/// rather than introducing its own queries, per the spec ("make the existing
/// cards real using data already derivable from runs/schedule/documents — do
/// not overbuild"). Scope is enforced inside each delegate service via
/// ICourierScopeResolver, so the courier only ever sees their own numbers.
/// </summary>
public class CourierDashboardService(
    CourierRunsService runsService,
    CourierScheduleService scheduleService,
    CourierDocumentsService documentsService)
{
    private const int Available = 1;

    public async Task<CourierDashboardDto> GetMyDashboardAsync(CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;
        var weekStart = today.AddDays(-(((int)today.DayOfWeek + 6) % 7)); // Monday

        var runs = await runsService.GetMyRunsAsync(ct);
        var schedule = await scheduleService.GetMyScheduleAsync(ct);
        var documents = await documentsService.GetMyDocumentsAsync(ct);

        var todaysRuns = runs.Current.Count(r => r.BookDate.Date == today)
                       + runs.Past.Count(r => r.BookDate.Date == today);

        // Past runs are fully completed (no open non-void job in the group).
        var weekCompleted = runs.Past.Count(r => r.BookDate.Date >= weekStart && r.BookDate.Date <= today);

        // Next shift = earliest upcoming schedule the courier has accepted.
        var next = schedule
            .Where(s => s.Response?.StatusId == Available)
            .OrderBy(s => s.BookDate)
            .ThenBy(s => s.StartTime, StringComparer.Ordinal)
            .FirstOrDefault();
        var nextShift = next is null
            ? null
            : $"{next.BookDate.ToString("ddd dd MMM", CultureInfo.InvariantCulture)} · {next.StartTime}";

        return new CourierDashboardDto
        {
            TodaysRuns = todaysRuns,
            WeekCompletedRuns = weekCompleted,
            NextShift = nextShift,
            DocumentsPending = documents.Count(d => d.Status == "Pending"),
            DocumentsRejected = documents.Count(d => d.Status == "Rejected"),
            DocumentsExpiringSoon = documents.Count(d =>
                d.Status == "Verified"
                && DateOnly.TryParse(d.ExpiryDate, out var exp)
                && exp <= DateOnly.FromDateTime(today.AddDays(30))),
            DocumentsMissingRequired = documents.Count(d => d.Mandatory && d.Status == "Missing"),
        };
    }
}
