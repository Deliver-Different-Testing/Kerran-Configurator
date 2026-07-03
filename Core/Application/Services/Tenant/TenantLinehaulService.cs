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
// the default-target name (Courier/Agent/NP — Fixes §5), a live Mapped Stops
// count (tblBulkJob), and the Used-by-Schedules count (tblBulkScheduleLinehaul)
// that also guards delete.
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

    // ── Master-job linking (STEVE-LINEHAUL-RUN-MODAL-MASTER-JOB spec) ──────────
    // Candidate lookup for "link a booking to this run as its master job".
    //
    // The spec's original query fuzzy-matched depot names against booking
    // CompanyName / Description and ranked by a ucbkReady time — but tucJobBooking
    // has NONE of those columns. Re-grounded against the real schema:
    //   • PRIMARY, reliable path = direct search on the booking/job number
    //     (UcbkJobNumber) + CustomJobName + client name — the spec's own happy
    //     path (operator makes the master booking, then links it by its number).
    //   • depot-name "fuzzy" matching is DEMOTED to a best-effort recall widener
    //     over the address / street text, folded into the SAME OR so it never
    //     hides a booking the operator is searching by number (AR2/AR3). It is
    //     not a hard filter, and there is no depot column to rank proximity by.
    //   • the ucbkReady time-ranking is dropped (no such column); recency falls
    //     back to UcbkTime.
    //
    // Universe = active, top-level recurring booking templates (ParentId IS NULL).
    // Requires a >= 2-char term so we never leading-wildcard-scan the whole table,
    // and caps at 50. Exact then prefix job-number matches float to the top.
    public async Task<List<TenantLinehaulBookingLookupDto>> SearchLinkableBookingsAsync(int runId, string? q)
    {
        var term = (q ?? string.Empty).Trim();
        if (term.Length < 2) return [];

        return await Context.TucJobBookings.AsNoTracking()
            .Where(b => b.UcbkActive == true && b.ParentId == null)
            .Where(b =>
                b.UcbkJobNumber.Contains(term) ||
                (b.CustomJobName != null && b.CustomJobName.Contains(term)) ||
                (b.UcbkClient != null && b.UcbkClient.UcclName != null && b.UcbkClient.UcclName.Contains(term)) ||
                // best-effort depot-name recall over address/street text (hint, not filter):
                (b.FromAddressStreetName != null && b.FromAddressStreetName.Contains(term)) ||
                (b.ToAddressStreetName != null && b.ToAddressStreetName.Contains(term)) ||
                (b.PickupAddressLine1 != null && b.PickupAddressLine1.Contains(term)) ||
                (b.DeliveryAddressLine1 != null && b.DeliveryAddressLine1.Contains(term)))
            .OrderByDescending(b => b.UcbkJobNumber == term)         // exact job no first
            .ThenByDescending(b => b.UcbkJobNumber.StartsWith(term)) // then prefix
            .ThenByDescending(b => b.UcbkTime)                       // then most recent
            .Take(50)
            .Select(b => new TenantLinehaulBookingLookupDto
            {
                BookingId = b.UcbkId,
                JobNumber = b.UcbkJobNumber ?? string.Empty,
                JobName = b.CustomJobName,
                ClientName = b.UcbkClient != null ? b.UcbkClient.UcclName : null,
                PickupSummary = b.PickupAddressLine1,
                DeliverySummary = b.DeliveryAddressLine1,
                LinkedRunId = b.LinehaulRunId,
                IsMaster = b.IsLinehaulMaster,
                LinkedToThisRun = b.LinehaulRunId == runId,
            })
            .ToListAsync();
    }

    // Enforce the single-master invariant on save (resolve-on-reopen): demote any
    // current master for this run, then promote the selected booking. The master
    // booking owns LinehaulRunId + IsLinehaulMaster + (P0-B) the inherited run
    // courier — nothing else writes these on tucJobBooking today (migration 052
    // left LinehaulRunId NULL, no backfill), so demoting clears them. Reassigning a
    // booking that is the master of ANOTHER run moves it here (the picker DTO
    // surfaces LinkedRunId so the UI can warn first). Mutates tracked entities only
    // — caller owns SaveChanges so the run + booking writes land in one transaction.
    //
    // P0-B (STEVE-LINEHAUL-DRIVER-WORKFLOW-SIMPLIFICATION): the realised master LH
    // job must be dispatched to the run courier. The booking->job realiser
    // (UTL_stpJobBooking_InsertJob) copies tucJobBooking.CourierId onto the live
    // job, so stamping the run courier on the master booking here is enough — no
    // legacy proc change. Re-stamped on every save so a later change to the run
    // courier re-syncs the master; that is why the promote branch also refreshes an
    // already-current (unchanged) master rather than skipping it.
    private async Task ApplyMasterBookingAsync(int runId, int? masterBookingId, int? runCourierId)
    {
        var current = await Context.TucJobBookings
            .Where(b => b.LinehaulRunId == runId && b.IsLinehaulMaster)
            .ToListAsync();

        // Demote any current master that is not the new selection. Clear the
        // inherited courier too: a booking that is no longer this run's master must
        // not keep dispatching its realised job to the run courier.
        foreach (var b in current.Where(b => b.UcbkId != masterBookingId))
        {
            b.IsLinehaulMaster = false;
            b.LinehaulRunId = null;
            b.CourierId = null;
        }

        if (masterBookingId is int id)
        {
            // Reuse the already-tracked master when it is unchanged; otherwise load
            // the selected booking (which may currently be the master of another run).
            var booking = current.FirstOrDefault(b => b.UcbkId == id)
                ?? await Context.TucJobBookings.FirstOrDefaultAsync(b => b.UcbkId == id);
            if (booking is not null)
            {
                booking.LinehaulRunId = runId;
                booking.IsLinehaulMaster = true;
                booking.CourierId = runCourierId;   // inherit run courier (NULL for Agent/NP runs)
            }
        }
    }

    public async Task<TenantLinehaulMutationResult> CreateAsync(TenantLinehaulRunUpsertDto dto)
    {
        var error = await ValidateAsync(dto, null);
        if (error is not null) return TenantLinehaulMutationResult.Invalid(error);

        var (targetType, courierId, agentId) = MapTarget(dto.DefaultTargetType, dto.DefaultTargetId);
        var run = new TblbulkLinehaulRun
        {
            RunName = dto.RunName!.Trim(),
            FromDepotId = dto.FromDepotId,
            ToDepotId = dto.ToDepotId,
            StartTime = ParseTime(dto.StartTime),
            DespatchTime = ParseTime(dto.DespatchTime),
            DefaultTargetType = targetType,
            CourierId = courierId,   // NULL when Agent/NP (no more 0 sentinel)
            DefaultAgentId = agentId,
            SpeedId = dto.SpeedId,
        };
        Context.TblbulkLinehaulRuns.Add(run);
        await Context.SaveChangesAsync();

        // run.Id is assigned by the insert above; link the master (if any) now.
        if (dto.MasterBookingId is not null)
        {
            await ApplyMasterBookingAsync(run.Id, dto.MasterBookingId, run.CourierId);
            await Context.SaveChangesAsync();
        }

        return TenantLinehaulMutationResult.Ok((await EnrichAsync([run])).Single());
    }

    public async Task<TenantLinehaulMutationResult> UpdateAsync(int id, TenantLinehaulRunUpsertDto dto)
    {
        var run = await Context.TblbulkLinehaulRuns.FirstOrDefaultAsync(r => r.Id == id);
        if (run is null) return TenantLinehaulMutationResult.NotFoundResult();

        var error = await ValidateAsync(dto, id);
        if (error is not null) return TenantLinehaulMutationResult.Invalid(error);

        var (targetType, courierId, agentId) = MapTarget(dto.DefaultTargetType, dto.DefaultTargetId);
        run.RunName = dto.RunName!.Trim();
        run.FromDepotId = dto.FromDepotId;
        run.ToDepotId = dto.ToDepotId;
        run.StartTime = ParseTime(dto.StartTime);
        run.DespatchTime = ParseTime(dto.DespatchTime);
        run.DefaultTargetType = targetType;
        run.CourierId = courierId;   // NULL when Agent/NP (no more 0 sentinel)
        run.DefaultAgentId = agentId;
        run.SpeedId = dto.SpeedId;
        await ApplyMasterBookingAsync(run.Id, dto.MasterBookingId, run.CourierId);   // single-master invariant + P0-B courier
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
            DefaultTargetType = src.DefaultTargetType,
            CourierId = src.CourierId,
            DefaultAgentId = src.DefaultAgentId,
            SpeedId = src.SpeedId,
            // Schedule bindings + roster rows are NOT carried — operators bind/roster the copy fresh.
        };
        Context.TblbulkLinehaulRuns.Add(copy);
        await Context.SaveChangesAsync();

        return TenantLinehaulMutationResult.Ok((await EnrichAsync([copy])).Single());
    }

    // Schedules binding a run (Fix 7 + the 2026-06-19 dedupe amendment). A schedule
    // is physically ONE tblBulkRunSchedule row PER WEEKDAY (DayOfWeek smallint),
    // each with its own BulkRunScheduleId — so the leg→schedule join emits one row
    // per active weekday and the old "group by BulkRunScheduleId" left N dupes
    // (and showed the leg-level WeekDay mask "1111111"). Collapse to one entry per
    // LOGICAL schedule = (Name, ClientId), and build the day label from the
    // schedule rows' DayOfWeek (active leg-bindings only), short-named + ordered.
    // Grouped in memory (small per-run set) — STRING_AGG / DateName don't translate
    // in EF, same pattern as TenantRouteService.BuildScheduleLookupAsync.
    public async Task<List<LinehaulScheduleBindingDto>> GetScheduleBindingsAsync(int runId)
    {
        var rows = await Context.TblBulkScheduleLinehauls.AsNoTracking()
            .Where(s => s.LinehaulRunId == runId && s.Active == true)
            .Select(s => new
            {
                s.BulkRunScheduleId,
                BindingName = s.Name,
                SchedName = s.BulkRunSchedule != null ? s.BulkRunSchedule.Name : null,
                ClientId = s.BulkRunSchedule != null ? s.BulkRunSchedule.ClientId : null,
                DayOfWeek = s.BulkRunSchedule != null ? (short?)s.BulkRunSchedule.DayOfWeek : null,
            })
            .ToListAsync();

        return rows
            // Collapse weekday rows: schedule-backed rows group by (Name, ClientId)
            // — NULL ClientId (shared/multi-client schedules) collapses to one group.
            // Bindings with no schedule fall back to their own name.
            .GroupBy(r => r.SchedName != null ? $"s|{r.SchedName}|{r.ClientId}" : $"b|{r.BindingName}")
            .Select(g =>
            {
                var first = g.First();
                var days = g.Where(x => x.DayOfWeek.HasValue)
                            .Select(x => (int)x.DayOfWeek!.Value).Distinct().OrderBy(d => d)
                            .Select(WeekdayShort).ToList();
                return new LinehaulScheduleBindingDto
                {
                    ScheduleId = g.Min(x => x.BulkRunScheduleId),   // representative row id for Open ↗
                    Name = !string.IsNullOrWhiteSpace(first.SchedName) ? first.SchedName!
                         : !string.IsNullOrWhiteSpace(first.BindingName) ? first.BindingName!
                         : "(unnamed schedule)",
                    Active = true,   // only active leg-bindings are fetched (matches the cell count)
                    WeekDay = days.Count > 0 ? string.Join(", ", days) : null,
                };
            })
            .OrderBy(d => d.Name)
            .ToList();
    }

    // tblBulkRunSchedule.DayOfWeek is ISO-ish in this schema: 1=Mon … 7=Sun (matches
    // the existing schedule-lookup / Routes day handling). 0 maps to Sun defensively.
    // CONFIRM on staging per the dedupe spec note; flip if the data is 1=Sunday.
    private static string WeekdayShort(int dow) => dow switch
    {
        1 => "Mon", 2 => "Tue", 3 => "Wed", 4 => "Thu", 5 => "Fri", 6 => "Sat", 7 => "Sun", 0 => "Sun",
        _ => dow.ToString(),
    };

    // ── Roster (spec §4 + Fixes §6) — Run × Day target grid ────────────────

    public async Task<LinehaulRosterGridDto> GetRosterGridAsync()
    {
        var runs = await Context.TblbulkLinehaulRuns.AsNoTracking().OrderBy(r => r.RunName).ToListAsync();
        var enriched = await EnrichAsync(runs);   // depot names + default target
        var runIds = runs.Select(r => r.Id).ToList();

        // v1 = recurring weekly rows only (RosterDate null); date overrides are v1.1.
        var cells = await Context.DispatchLinehaulRunRosters.AsNoTracking()
            .Where(x => x.IsActive && x.RosterDate == null && x.DayOfWeek != null && runIds.Contains(x.LinehaulRunId))
            .ToListAsync();

        var courierNames = await ResolveCourierNamesAsync(
            cells.Where(c => c.CourierId.HasValue).Select(c => c.CourierId!.Value));
        var agents = await ResolveAgentsAsync(
            cells.Where(c => c.AgentId.HasValue).Select(c => c.AgentId!.Value));

        var cellsByRun = cells
            .GroupBy(c => c.LinehaulRunId)
            .ToDictionary(g => g.Key, g => g.Select(c =>
            {
                var type = TargetTypeName(c.TargetType) ?? (c.CourierId.HasValue ? "Courier" : null);
                var (targetId, targetName, targetHint) = ResolveTarget(type, c.CourierId, c.AgentId, courierNames, agents);
                return new LinehaulRosterCellDto
                {
                    RosterId = c.LinehaulRunRosterId,
                    DayOfWeek = c.DayOfWeek!.Value,
                    CourierId = c.CourierId,
                    CourierName = c.CourierId.HasValue ? courierNames.GetValueOrDefault(c.CourierId.Value).Name : null,
                    TargetType = type,
                    TargetId = targetId,
                    TargetName = targetName,
                    TargetHint = targetHint,
                };
            }).ToList());

        var rows = enriched.Select(e => new LinehaulRosterRowDto
        {
            RunId = e.Id,
            RunName = e.RunName,
            FromDepotName = e.FromDepotName,
            ToDepotName = e.ToDepotName,
            DefaultCourierId = e.CourierId,
            DefaultDriverName = e.DefaultDriverName,
            DefaultTargetType = e.DefaultTargetType,
            DefaultTargetId = e.DefaultTargetId,
            DefaultTargetName = e.DefaultTargetName,
            DefaultTargetHint = e.DefaultTargetHint,
            Active = e.Active,
            Cells = cellsByRun.GetValueOrDefault(e.Id) ?? [],
        }).ToList();

        var couriers = (await GetLookupsAsync()).Couriers;
        return new LinehaulRosterGridDto { Rows = rows, Couriers = couriers };
    }

    // Upsert a single weekly cell. Deactivates the existing active row for the
    // (run, day) before inserting — matches the filtered unique index and keeps
    // the run's own default target (tblbulkLinehaulRun) untouched.
    public async Task<LinehaulRosterCellDto?> UpsertRosterCellAsync(LinehaulRosterUpsertDto dto)
    {
        if (dto.DayOfWeek < 1 || dto.DayOfWeek > 7) return null;
        var (targetType, courierId, agentId) = MapTarget(dto.TargetType, dto.TargetId);
        if (targetType is null || dto.TargetId <= 0) return null;
        if (!await Context.TblbulkLinehaulRuns.AnyAsync(r => r.Id == dto.LinehaulRunId)) return null;

        var existing = await Context.DispatchLinehaulRunRosters
            .Where(x => x.IsActive && x.RosterDate == null
                        && x.LinehaulRunId == dto.LinehaulRunId && x.DayOfWeek == (byte)dto.DayOfWeek)
            .ToListAsync();
        foreach (var e in existing) e.IsActive = false;

        var row = new DispatchLinehaulRunRoster
        {
            LinehaulRunId = dto.LinehaulRunId,
            TargetType = targetType,
            CourierId = courierId,
            AgentId = agentId,
            DayOfWeek = (byte)dto.DayOfWeek,
            RosterDate = null,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "configurator",
        };
        Context.DispatchLinehaulRunRosters.Add(row);
        await Context.SaveChangesAsync();

        var type = TargetTypeName(targetType);
        var courierNames = await ResolveCourierNamesAsync(courierId.HasValue ? [courierId.Value] : []);
        var agents = await ResolveAgentsAsync(agentId.HasValue ? [agentId.Value] : []);
        var (targetId, targetName, targetHint) = ResolveTarget(type, courierId, agentId, courierNames, agents);
        return new LinehaulRosterCellDto
        {
            RosterId = row.LinehaulRunRosterId,
            DayOfWeek = dto.DayOfWeek,
            CourierId = courierId,
            CourierName = courierId.HasValue ? courierNames.GetValueOrDefault(courierId.Value).Name : null,
            TargetType = type,
            TargetId = targetId,
            TargetName = targetName,
            TargetHint = targetHint,
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

        var depotNames = await Context.TblBulkRegions.AsNoTracking()
            .Where(d => depotIds.Contains(d.BulkRegionId))
            .ToDictionaryAsync(d => d.BulkRegionId, d => d.Name ?? string.Empty);

        var courierNames = await ResolveCourierNamesAsync(runs.Where(r => r.CourierId > 0).Select(r => r.CourierId!.Value));
        var agents = await ResolveAgentsAsync(runs.Where(r => r.DefaultAgentId.HasValue).Select(r => r.DefaultAgentId!.Value));

        // Live Mapped Stops — same not-void rule used across the bulk-job surfaces.
        var stopCounts = await Context.TblBulkJobs.AsNoTracking()
            .Where(j => j.LinehaulRunId != null && runIds.Contains(j.LinehaulRunId.Value) && !j.Void)
            .GroupBy(j => j.LinehaulRunId!.Value)
            .Select(g => new { RunId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RunId, x => x.Count);

        // Used-by-Schedules count = DISTINCT logical schedules (Name, ClientId) per
        // run, NOT raw per-weekday binding rows (a schedule is one tblBulkRunSchedule
        // row per weekday, so a plain bsl count over-reports — e.g. Mon–Fri = 5).
        // Matches the deduped modal list (GetScheduleBindingsAsync), same key scheme.
        // Deduped in memory (small per-tenant set).
        var bindingRows = await Context.TblBulkScheduleLinehauls.AsNoTracking()
            .Where(s => s.LinehaulRunId != null && runIds.Contains(s.LinehaulRunId.Value) && s.Active == true)
            .Select(s => new
            {
                RunId = s.LinehaulRunId!.Value,
                SchedName = s.BulkRunSchedule != null ? s.BulkRunSchedule.Name : null,
                ClientId = s.BulkRunSchedule != null ? s.BulkRunSchedule.ClientId : null,
                BindingName = s.Name,
            })
            .ToListAsync();
        var activeBindingCounts = bindingRows
            .GroupBy(r => r.RunId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(r => r.SchedName != null ? $"s|{r.SchedName}|{r.ClientId}" : $"b|{r.BindingName}")
                      .Distinct().Count());

        // Master booking per run (STEVE-LINEHAUL-RUN-MODAL-MASTER-JOB). One per run
        // by invariant; First() is a defensive collapse if data ever drifts.
        var masters = (await Context.TucJobBookings.AsNoTracking()
            .Where(b => b.LinehaulRunId != null && runIds.Contains(b.LinehaulRunId.Value) && b.IsLinehaulMaster)
            .Select(b => new
            {
                RunId = b.LinehaulRunId!.Value,
                b.UcbkId,
                b.UcbkJobNumber,
                b.CustomJobName,
                ClientName = b.UcbkClient != null ? b.UcbkClient.UcclName : null,
            })
            .ToListAsync())
            .GroupBy(m => m.RunId)
            .ToDictionary(g => g.Key, g => g.First());

        return runs.Select(r =>
        {
            var usedBy = activeBindingCounts.GetValueOrDefault(r.Id);
            var master = masters.GetValueOrDefault(r.Id);
            // Legacy/untyped rows with a courier fall back to Courier so the chip renders.
            var type = TargetTypeName(r.DefaultTargetType) ?? (r.CourierId > 0 ? "Courier" : null);
            var (targetId, targetName, targetHint) = ResolveTarget(type, r.CourierId > 0 ? r.CourierId : null, r.DefaultAgentId, courierNames, agents);
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
                DefaultDriverName = r.CourierId > 0 ? courierNames.GetValueOrDefault(r.CourierId!.Value).Name : null,
                DefaultAgentId = r.DefaultAgentId,
                DefaultTargetType = type,
                DefaultTargetId = targetId,
                DefaultTargetName = targetName,
                DefaultTargetHint = targetHint,
                SpeedId = r.SpeedId,
                MasterBookingId = master?.UcbkId,
                MasterBookingLabel = master is null ? null : BookingLabel(master.UcbkJobNumber, master.CustomJobName, master.ClientName),
                MappedStopsCount = stopCounts.GetValueOrDefault(r.Id),
                UsedBySchedulesCount = usedBy,
                Active = usedBy > 0,
            };
        }).ToList();
    }

    // Display label for a master booking: "jobNo — name/client" (name preferred,
    // falls back to client). Mirrors the picker's TenantLinehaulBookingLookupDto.
    private static string BookingLabel(string? jobNo, string? jobName, string? client)
    {
        var primary = string.IsNullOrWhiteSpace(jobNo) ? "(no job #)" : jobNo!.Trim();
        var secondary = !string.IsNullOrWhiteSpace(jobName) ? jobName!.Trim()
            : !string.IsNullOrWhiteSpace(client) ? client!.Trim() : null;
        return secondary is null ? primary : $"{primary} — {secondary}";
    }

    // Maps the picker's (type, id) onto the target columns. Agent + NP both land
    // in AgentId (NP = agent w/ IsNetworkPartner=1); the TargetType byte records
    // which the operator chose. Unknown/empty type clears the target. Mirrors
    // TenantRouteService.MapTarget.
    private static (byte? Type, int? CourierId, int? AgentId) MapTarget(string? type, int? id) => type switch
    {
        "Courier"        => ((byte?)1, id, null),
        "Agent"          => ((byte?)2, null, id),
        "NetworkPartner" => ((byte?)3, null, id),
        _                => (null, null, null),
    };

    private static string? TargetTypeName(byte? type) => type switch
    {
        1 => "Courier",
        2 => "Agent",
        3 => "NetworkPartner",
        _ => null,
    };

    private async Task<Dictionary<int, (string Name, string Code)>> ResolveCourierNamesAsync(IEnumerable<int> ids)
    {
        var idList = ids.Distinct().ToList();
        if (idList.Count == 0) return [];
        return (await Context.TucCouriers.AsNoTracking()
                .Where(c => idList.Contains(c.UccrId))
                .Select(c => new { c.UccrId, c.UccrName, c.UccrSurname, c.Code })
                .ToListAsync())
            .ToDictionary(c => c.UccrId, c => ((c.UccrName + " " + c.UccrSurname).Trim(), c.Code ?? string.Empty));
    }

    private async Task<Dictionary<int, (string Name, string Hint)>> ResolveAgentsAsync(IEnumerable<int> ids)
    {
        var idList = ids.Distinct().ToList();
        if (idList.Count == 0) return [];
        return (await Context.TucAgents.AsNoTracking()
                .Where(a => idList.Contains(a.UcagId))
                .Select(a => new { a.UcagId, a.UcagName, a.Association })
                .ToListAsync())
            .ToDictionary(a => a.UcagId, a => (a.UcagName ?? string.Empty, a.Association ?? string.Empty));
    }

    private static (int? Id, string? Name, string? Hint) ResolveTarget(
        string? type, int? courierId, int? agentId,
        Dictionary<int, (string Name, string Code)> couriers,
        Dictionary<int, (string Name, string Hint)> agents) => type switch
    {
        "Courier" when courierId.HasValue =>
            (courierId, couriers.GetValueOrDefault(courierId.Value).Name, couriers.GetValueOrDefault(courierId.Value).Code),
        "Agent" or "NetworkPartner" when agentId.HasValue =>
            (agentId, agents.GetValueOrDefault(agentId.Value).Name, agents.GetValueOrDefault(agentId.Value).Hint),
        _ => (null, null, null),
    };

    private static TimeOnly? ParseTime(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return TimeOnly.TryParse(value, CultureInfo.InvariantCulture, out var t) ? t : null;
    }

    private static string? FormatTime(TimeOnly? value) => value?.ToString("HH:mm", CultureInfo.InvariantCulture);
}
