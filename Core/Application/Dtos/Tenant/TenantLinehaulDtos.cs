using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Tenant;

// Linehaul (depot-to-depot middle-mile) run — the tenant-facing Linehaul tab on
// Recurring Routes (spec §3). Server resolves depot/driver names + the two
// counts so the front-end renders each row without a join.
public class TenantLinehaulRunDto
{
    public int Id { get; set; }
    public string RunName { get; set; } = string.Empty;
    public int FromDepotId { get; set; }
    public int ToDepotId { get; set; }
    public string FromDepotName { get; set; } = string.Empty;
    public string ToDepotName { get; set; } = string.Empty;
    public string? StartTime { get; set; }      // "HH:mm" (null when unset)
    public string? DespatchTime { get; set; }   // "HH:mm" (null when unset)
    public int? CourierId { get; set; }          // null when unbound (0 in DB)
    public string? DefaultDriverName { get; set; }
    public int MappedStopsCount { get; set; }    // tblBulkJob WHERE LinehaulRunID = Id AND !Void
    public int UsedBySchedulesCount { get; set; } // tblBulkScheduleLinehaul WHERE LinehaulRunID = Id AND Active
    public bool Active { get; set; }             // derived: >=1 active schedule binding
}

// Create / update payload. Optional string fields are nullable so a PUT that
// omits an untouched field doesn't trip [ApiController] implicit-required 400s
// (see the courier-portal nullable-DTO gotcha).
public class TenantLinehaulRunUpsertDto
{
    public string? RunName { get; set; }
    public int FromDepotId { get; set; }
    public int ToDepotId { get; set; }
    public string? StartTime { get; set; }      // "HH:mm"
    public string? DespatchTime { get; set; }   // "HH:mm"
    public int? CourierId { get; set; }          // null/0 => unbound
}

public class TenantDepotLookupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

// TenantCourierLookupDto is reused from TenantRouteDtos.cs (same {Id,Name,Code} shape).

public class TenantLinehaulLookupsDto
{
    public List<TenantDepotLookupDto> Depots { get; set; } = [];
    public List<TenantCourierLookupDto> Couriers { get; set; } = [];
}

// ── Linehaul Roster (spec §4) — Run × Day driver grid ──────────────────

public class LinehaulRosterCellDto
{
    public int RosterId { get; set; }
    public int DayOfWeek { get; set; }   // 1 = Mon .. 7 = Sun
    public int? CourierId { get; set; }
    public string? CourierName { get; set; }
}

public class LinehaulRosterRowDto
{
    public int RunId { get; set; }
    public string RunName { get; set; } = string.Empty;
    public string FromDepotName { get; set; } = string.Empty;
    public string ToDepotName { get; set; } = string.Empty;
    public int? DefaultCourierId { get; set; }
    public string? DefaultDriverName { get; set; }
    public bool Active { get; set; }   // derived: run has >=1 active schedule binding
    public List<LinehaulRosterCellDto> Cells { get; set; } = [];
}

public class LinehaulRosterGridDto
{
    public List<LinehaulRosterRowDto> Rows { get; set; } = [];
    public List<TenantCourierLookupDto> Couriers { get; set; } = [];
}

public class LinehaulRosterUpsertDto
{
    public int LinehaulRunId { get; set; }
    public int DayOfWeek { get; set; }   // 1 = Mon .. 7 = Sun
    public int CourierId { get; set; }
}

// Service-level outcome so the controller can map to the right HTTP status
// without throwing for expected cases (not-found / blocked / validation).
public class TenantLinehaulMutationResult
{
    public TenantLinehaulRunDto? Dto { get; set; }
    public bool NotFound { get; set; }
    public bool BlockedBySchedules { get; set; }
    public string? ValidationError { get; set; }

    public static TenantLinehaulMutationResult Ok(TenantLinehaulRunDto dto) => new() { Dto = dto };
    public static TenantLinehaulMutationResult NotFoundResult() => new() { NotFound = true };
    public static TenantLinehaulMutationResult Blocked() => new() { BlockedBySchedules = true };
    public static TenantLinehaulMutationResult Invalid(string error) => new() { ValidationError = error };
}
