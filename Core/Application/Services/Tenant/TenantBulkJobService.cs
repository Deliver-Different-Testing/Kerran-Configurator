using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Tenant;

// Mapped Stops drill-down + Job-detail Speed editing (Recurring Routes spec §5).
// A "stop" is a tblBulkJob; v1 lists the jobs on a linehaul run and lets an
// operator change the Speed (service level) without leaving the configurator.
public class TenantBulkJobService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseService(contextFactory)
{
    public async Task<List<BulkJobListItemDto>> ListForLinehaulRunAsync(int linehaulRunId)
    {
        var jobs = await Context.TblBulkJobs.AsNoTracking()
            .Where(j => j.LinehaulRunId == linehaulRunId && !j.Void)
            .OrderBy(j => j.BookDate).ThenBy(j => j.BookTime)
            .ToListAsync();
        if (jobs.Count == 0) return [];

        var (speeds, statuses) = await LoadLookupsAsync();

        return jobs.Select(j =>
        {
            var sp = speeds.GetValueOrDefault(j.Speed);
            return new BulkJobListItemDto
            {
                Id = j.BulkJobId,
                JobNumber = j.JobNumber ?? string.Empty,
                Pickup = Compact(j.PickupAddressLine1, j.FromSuburb),
                Drop = Compact(j.DeliveryAddressLine1, j.ToSuburb),
                SpeedId = j.Speed,
                SpeedShortName = sp?.ShortName ?? string.Empty,
                SpeedName = sp?.Name ?? string.Empty,
                SpeedGroupingId = sp?.GroupingId ?? 0,
                SpeedGroupingName = sp?.GroupingName,
                BookDate = FormatDate(j.BookDate),
                BookTime = FormatTime(j.BookTime),
                StatusName = statuses.GetValueOrDefault(j.JobStatus) ?? string.Empty,
            };
        }).ToList();
    }

    public async Task<BulkJobDetailDto?> GetDetailAsync(int jobId)
    {
        var job = await Context.TblBulkJobs.AsNoTracking().FirstOrDefaultAsync(j => j.BulkJobId == jobId);
        if (job is null) return null;
        return await BuildDetailAsync(job);
    }

    public async Task<BulkJobSpeedUpdateResult> UpdateSpeedAsync(int jobId, int speedId)
    {
        var job = await Context.TblBulkJobs.FirstOrDefaultAsync(j => j.BulkJobId == jobId);
        if (job is null) return BulkJobSpeedUpdateResult.NotFoundResult();

        if (!await Context.TucJobTypes.AsNoTracking().AnyAsync(t => t.UcjtId == speedId))
            return BulkJobSpeedUpdateResult.Invalid();

        var statusName = await Context.TucJobStatuses.AsNoTracking()
            .Where(s => s.UcjsId == job.JobStatus).Select(s => s.UcjsName).FirstOrDefaultAsync();
        if (IsLocked(statusName)) return BulkJobSpeedUpdateResult.Locked();

        job.Speed = speedId;
        await Context.SaveChangesAsync();

        return BulkJobSpeedUpdateResult.Ok((await BuildDetailAsync(job))!);
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private async Task<BulkJobDetailDto> BuildDetailAsync(TblBulkJob job)
    {
        var (speeds, statuses) = await LoadLookupsAsync();
        var sp = speeds.GetValueOrDefault(job.Speed);
        var statusName = statuses.GetValueOrDefault(job.JobStatus) ?? string.Empty;
        var runName = job.LinehaulRunId == null ? null : await Context.TblbulkLinehaulRuns.AsNoTracking()
            .Where(r => r.Id == job.LinehaulRunId).Select(r => r.RunName).FirstOrDefaultAsync();

        return new BulkJobDetailDto
        {
            Id = job.BulkJobId,
            JobNumber = job.JobNumber ?? string.Empty,
            Customer = job.FromCompany ?? string.Empty,
            PickupAddress = Compact(job.PickupAddressLine1, job.FromSuburb),
            DropAddress = Compact(job.DeliveryAddressLine1, job.ToSuburb),
            SpeedId = job.Speed,
            SpeedShortName = sp?.ShortName ?? string.Empty,
            SpeedName = sp?.Name ?? string.Empty,
            SpeedGroupingId = sp?.GroupingId ?? 0,
            SpeedGroupingName = sp?.GroupingName,
            BookDate = FormatDate(job.BookDate),
            BookTime = FormatTime(job.BookTime),
            LinehaulRunName = runName,
            StatusName = statusName,
            SpeedEditable = !IsLocked(statusName),
            Notes = job.Notes,
        };
    }

    private sealed record SpeedInfo(string ShortName, string Name, int GroupingId, string? GroupingName);

    private async Task<(Dictionary<int, SpeedInfo> Speeds, Dictionary<int, string> Statuses)> LoadLookupsAsync()
    {
        var groupNames = await Context.TucJobTypeGroupings.AsNoTracking()
            .ToDictionaryAsync(g => g.GroupingId, g => g.GroupingName);

        var speeds = (await Context.TucJobTypes.AsNoTracking()
                .Select(t => new { t.UcjtId, t.ShortName, t.UcjtName, t.GroupingId })
                .ToListAsync())
            .ToDictionary(t => t.UcjtId, t => new SpeedInfo(
                t.ShortName ?? string.Empty, t.UcjtName ?? string.Empty, t.GroupingId,
                groupNames.GetValueOrDefault(t.GroupingId)));

        var statuses = await Context.TucJobStatuses.AsNoTracking()
            .ToDictionaryAsync(s => s.UcjsId, s => s.UcjsName ?? string.Empty);

        return (speeds, statuses);
    }

    // Speed is immutable once the job is delivered or cancelled. Matched on the
    // status name (no stable status-id contract across tenant DBs).
    private static bool IsLocked(string? statusName)
    {
        if (string.IsNullOrEmpty(statusName)) return false;
        var s = statusName.ToLowerInvariant();
        return s.Contains("deliver") || s.Contains("cancel");
    }

    private static string Compact(string? line1, string? suburb)
    {
        var parts = new[] { line1, suburb }.Where(p => !string.IsNullOrWhiteSpace(p));
        return string.Join(", ", parts);
    }

    private static string FormatDate(DateTime value) =>
        value == default ? string.Empty : value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static string FormatTime(DateTime value) =>
        value == default ? string.Empty : value.ToString("HH:mm", CultureInfo.InvariantCulture);
}
