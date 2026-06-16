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

// Tenant-side CRUD for linehaul (depot-to-depot middle-mile) runs — the
// Linehaul tab on Recurring Routes (spec §3). Native EF reimplementation of
// ClientManager's LinehaulRunsController (which was thin EF, no side-effects);
// CM stays the reference, not a runtime dependency. Reads/writes the existing
// tenant-DB table tblbulkLinehaulRun and enriches each row with depot names,
// the default-driver name, a live Mapped Stops count (tblBulkJob), and the
// Used-by-Schedules count (tblBulkScheduleLinehaul) that also guards delete.
public class TenantLinehaulService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseService(contextFactory)
{
    public async Task<List<TenantLinehaulRunDto>> ListAsync()
    {
        var runs = await Context.TblbulkLinehaulRuns.AsNoTracking()
            .OrderBy(r => r.RunName)
            .ToListAsync();
        return await EnrichAsync(runs);
    }

    public async Task<TenantLinehaulRunDto?> GetAsync(int id)
    {
        var run = await Context.TblbulkLinehaulRuns.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id);
        if (run is null) return null;
        return (await EnrichAsync([run])).Single();
    }

    public async Task<TenantLinehaulLookupsDto> GetLookupsAsync()
    {
        var depots = await Context.TblBulkRegions.AsNoTracking()
            .Where(d => d.Active)
            .OrderBy(d => d.Name)
            .Select(d => new TenantDepotLookupDto { Id = d.BulkRegionId, Name = d.Name ?? string.Empty })
            .ToListAsync();

        var couriers = await Context.TucCouriers.AsNoTracking()
            .Where(c => c.Active)
            .OrderBy(c => c.UccrName).ThenBy(c => c.UccrSurname)
            .Select(c => new TenantCourierLookupDto
            {
                Id = c.UccrId,
                Name = (c.UccrName + " " + c.UccrSurname).Trim(),
                Code = c.Code ?? string.Empty,
            })
            .ToListAsync();

        return new TenantLinehaulLookupsDto { Depots = depots, Couriers = couriers };
    }

    public async Task<TenantLinehaulMutationResult> CreateAsync(TenantLinehaulRunUpsertDto dto)
    {
        var error = await ValidateAsync(dto, null);
        if (error is not null) return TenantLinehaulMutationResult.Invalid(error);

        var run = new TblbulkLinehaulRun
        {
            RunName = dto.RunName!.Trim(),
            FromDepotId = dto.FromDepotId,
            ToDepotId = dto.ToDepotId,
            StartTime = ParseTime(dto.StartTime),
            DespatchTime = ParseTime(dto.DespatchTime),
            CourierId = dto.CourierId ?? 0,
        };
        Context.TblbulkLinehaulRuns.Add(run);
        await Context.SaveChangesAsync();

        return TenantLinehaulMutationResult.Ok((await EnrichAsync([run])).Single());
    }

    public async Task<TenantLinehaulMutationResult> UpdateAsync(int id, TenantLinehaulRunUpsertDto dto)
    {
        var run = await Context.TblbulkLinehaulRuns.FirstOrDefaultAsync(r => r.Id == id);
        if (run is null) return TenantLinehaulMutationResult.NotFoundResult();

        var error = await ValidateAsync(dto, id);
        if (error is not null) return TenantLinehaulMutationResult.Invalid(error);

        run.RunName = dto.RunName!.Trim();
        run.FromDepotId = dto.FromDepotId;
        run.ToDepotId = dto.ToDepotId;
        run.StartTime = ParseTime(dto.StartTime);
        run.DespatchTime = ParseTime(dto.DespatchTime);
        run.CourierId = dto.CourierId ?? 0;
        await Context.SaveChangesAsync();

        return TenantLinehaulMutationResult.Ok((await EnrichAsync([run])).Single());
    }

    public async Task<TenantLinehaulMutationResult> DeleteAsync(int id)
    {
        var run = await Context.TblbulkLinehaulRuns.FirstOrDefaultAsync(r => r.Id == id);
        if (run is null) return TenantLinehaulMutationResult.NotFoundResult();

        var activeBindings = await Context.TblBulkScheduleLinehauls.AsNoTracking()
            .CountAsync(s => s.LinehaulRunId == id && s.Active == true);
        if (activeBindings > 0) return TenantLinehaulMutationResult.Blocked();

        Context.TblbulkLinehaulRuns.Remove(run);
        await Context.SaveChangesAsync();
        return new TenantLinehaulMutationResult();   // success, no body
    }

    public async Task<TenantLinehaulMutationResult> CopyAsync(int id)
    {
        var src = await Context.TblbulkLinehaulRuns.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id);
        if (src is null) return TenantLinehaulMutationResult.NotFoundResult();

        // Unique-ify the "(copy)" name so a second copy doesn't collide.
        var baseName = $"{src.RunName} (copy)";
        var name = baseName;
        var n = 2;
        while (await Context.TblbulkLinehaulRuns.AnyAsync(r => r.RunName == name))
            name = $"{baseName} {n++}";

        var copy = new TblbulkLinehaulRun
        {
            RunName = name.Length > 50 ? name[..50] : name,
            FromDepotId = src.FromDepotId,
            ToDepotId = src.ToDepotId,
            StartTime = src.StartTime,
            DespatchTime = src.DespatchTime,
            CourierId = src.CourierId,
            // Schedule bindings + roster rows are NOT carried — operators bind/roster the copy fresh.
        };
        Context.TblbulkLinehaulRuns.Add(copy);
        await Context.SaveChangesAsync();

        return TenantLinehaulMutationResult.Ok((await EnrichAsync([copy])).Single());
    }

    // ── Roster (spec §4) — Run × Day driver grid ──────────────────────────

    public async Task<LinehaulRosterGridDto> GetRosterGridAsync()
    {
        var runs = await Context.TblbulkLinehaulRuns.AsNoTracking().OrderBy(r => r.RunName).ToListAsync();
        var enriched = await EnrichAsync(runs);   // depot names + default-driver name
        var runIds = runs.Select(r => r.Id).ToList();

        // v1 = recurring weekly rows only (RosterDate null); date overrides are v1.1.
        var cells = await Context.DispatchLinehaulRunRosters.AsNoTracking()
            .Where(x => x.IsActive && x.RosterDate == null && x.DayOfWeek != null && runIds.Contains(x.LinehaulRunId))
            .ToListAsync();

        var cellCourierIds = cells.Where(c => c.CourierId.HasValue).Select(c => c.CourierId!.Value).Distinct().ToList();
        var courierNames = await Context.TucCouriers.AsNoTracking()
            .Where(c => cellCourierIds.Contains(c.UccrId))
            .ToDictionaryAsync(c => c.UccrId, c => (c.UccrName + " " + c.UccrSurname).Trim());

        var cellsByRun = cells
            .GroupBy(c => c.LinehaulRunId)
            .ToDictionary(g => g.Key, g => g.Select(c => new LinehaulRosterCellDto
            {
                RosterId = c.LinehaulRunRosterId,
                DayOfWeek = c.DayOfWeek!.Value,
                CourierId = c.CourierId,
                CourierName = c.CourierId.HasValue ? courierNames.GetValueOrDefault(c.CourierId.Value) : null,
            }).ToList());

        var rows = enriched.Select(e => new LinehaulRosterRowDto
        {
            RunId = e.Id,
            RunName = e.RunName,
            FromDepotName = e.FromDepotName,
            ToDepotName = e.ToDepotName,
            DefaultCourierId = e.CourierId,
            DefaultDriverName = e.DefaultDriverName,
            Active = e.Active,
            Cells = cellsByRun.GetValueOrDefault(e.Id) ?? [],
        }).ToList();

        var couriers = (await GetLookupsAsync()).Couriers;
        return new LinehaulRosterGridDto { Rows = rows, Couriers = couriers };
    }

    // Upsert a single weekly cell. Deactivates the existing active row for the
    // (run, day) before inserting — matches the filtered unique index and keeps
    // the run's own default driver (tblbulkLinehaulRun.CourierId) untouched.
    public async Task<LinehaulRosterCellDto?> UpsertRosterCellAsync(LinehaulRosterUpsertDto dto)
    {
        if (dto.DayOfWeek < 1 || dto.DayOfWeek > 7) return null;
        if (dto.CourierId <= 0) return null;
        if (!await Context.TblbulkLinehaulRuns.AnyAsync(r => r.Id == dto.LinehaulRunId)) return null;

        var existing = await Context.DispatchLinehaulRunRosters
            .Where(x => x.IsActive && x.RosterDate == null
                        && x.LinehaulRunId == dto.LinehaulRunId && x.DayOfWeek == (byte)dto.DayOfWeek)
            .ToListAsync();
        foreach (var e in existing) e.IsActive = false;

        var row = new DispatchLinehaulRunRoster
        {
            LinehaulRunId = dto.LinehaulRunId,
            CourierId = dto.CourierId,
            DayOfWeek = (byte)dto.DayOfWeek,
            RosterDate = null,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "configurator",
        };
        Context.DispatchLinehaulRunRosters.Add(row);
        await Context.SaveChangesAsync();

        var courier = await Context.TucCouriers.AsNoTracking().FirstOrDefaultAsync(c => c.UccrId == dto.CourierId);
        return new LinehaulRosterCellDto
        {
            RosterId = row.LinehaulRunRosterId,
            DayOfWeek = dto.DayOfWeek,
            CourierId = dto.CourierId,
            CourierName = courier is null ? null : (courier.UccrName + " " + courier.UccrSurname).Trim(),
        };
    }

    public async Task<bool> DeleteRosterCellAsync(int rosterId)
    {
        var row = await Context.DispatchLinehaulRunRosters.FirstOrDefaultAsync(x => x.LinehaulRunRosterId == rosterId);
        if (row is null) return false;
        row.IsActive = false;   // soft-delete
        await Context.SaveChangesAsync();
        return true;
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private async Task<string?> ValidateAsync(TenantLinehaulRunUpsertDto dto, int? id)
    {
        var name = dto.RunName?.Trim();
        if (string.IsNullOrWhiteSpace(name)) return "Run name is required.";
        if (name.Length > 50) return "Run name must be 50 characters or fewer.";
        if (dto.FromDepotId <= 0 || dto.ToDepotId <= 0) return "From and To depots are required.";
        if (dto.FromDepotId == dto.ToDepotId) return "From and To depots must be different.";

        var start = ParseTime(dto.StartTime);
        var despatch = ParseTime(dto.DespatchTime);
        if (start.HasValue && despatch.HasValue && despatch.Value < start.Value)
            return "Despatch time must be at or after the start time.";

        var dupe = await Context.TblbulkLinehaulRuns.AsNoTracking()
            .AnyAsync(r => r.RunName == name && (id == null || r.Id != id));
        if (dupe) return $"A linehaul run named \"{name}\" already exists.";

        return null;
    }

    private async Task<List<TenantLinehaulRunDto>> EnrichAsync(List<TblbulkLinehaulRun> runs)
    {
        if (runs.Count == 0) return [];

        var runIds = runs.Select(r => r.Id).ToList();
        var depotIds = runs.SelectMany(r => new[] { r.FromDepotId, r.ToDepotId }).Distinct().ToList();
        var courierIds = runs.Where(r => r.CourierId > 0).Select(r => r.CourierId).Distinct().ToList();

        var depotNames = await Context.TblBulkRegions.AsNoTracking()
            .Where(d => depotIds.Contains(d.BulkRegionId))
            .ToDictionaryAsync(d => d.BulkRegionId, d => d.Name ?? string.Empty);

        var courierNames = await Context.TucCouriers.AsNoTracking()
            .Where(c => courierIds.Contains(c.UccrId))
            .ToDictionaryAsync(c => c.UccrId, c => (c.UccrName + " " + c.UccrSurname).Trim());

        // Live Mapped Stops — same not-void rule used across the bulk-job surfaces.
        var stopCounts = await Context.TblBulkJobs.AsNoTracking()
            .Where(j => j.LinehaulRunId != null && runIds.Contains(j.LinehaulRunId.Value) && !j.Void)
            .GroupBy(j => j.LinehaulRunId!.Value)
            .Select(g => new { RunId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RunId, x => x.Count);

        var activeBindingCounts = await Context.TblBulkScheduleLinehauls.AsNoTracking()
            .Where(s => s.LinehaulRunId != null && runIds.Contains(s.LinehaulRunId.Value) && s.Active == true)
            .GroupBy(s => s.LinehaulRunId!.Value)
            .Select(g => new { RunId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RunId, x => x.Count);

        return runs.Select(r =>
        {
            var usedBy = activeBindingCounts.GetValueOrDefault(r.Id);
            return new TenantLinehaulRunDto
            {
                Id = r.Id,
                RunName = r.RunName ?? string.Empty,
                FromDepotId = r.FromDepotId,
                ToDepotId = r.ToDepotId,
                FromDepotName = depotNames.GetValueOrDefault(r.FromDepotId, string.Empty),
                ToDepotName = depotNames.GetValueOrDefault(r.ToDepotId, string.Empty),
                StartTime = FormatTime(r.StartTime),
                DespatchTime = FormatTime(r.DespatchTime),
                CourierId = r.CourierId > 0 ? r.CourierId : null,
                DefaultDriverName = r.CourierId > 0 ? courierNames.GetValueOrDefault(r.CourierId) : null,
                MappedStopsCount = stopCounts.GetValueOrDefault(r.Id),
                UsedBySchedulesCount = usedBy,
                Active = usedBy > 0,
            };
        }).ToList();
    }

    private static TimeOnly? ParseTime(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return TimeOnly.TryParse(value, CultureInfo.InvariantCulture, out var t) ? t : null;
    }

    private static string? FormatTime(TimeOnly? value) => value?.ToString("HH:mm", CultureInfo.InvariantCulture);
}
