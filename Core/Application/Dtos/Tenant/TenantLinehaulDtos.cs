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
    // Recurring Routes Fixes §5 — polymorphic default target (Courier/Agent/NP).
    // CourierId/DefaultDriverName kept for back-compat (roster courier fallback).
    public int? DefaultAgentId { get; set; }
    public string? DefaultTargetType { get; set; }   // "Courier" / "Agent" / "NetworkPartner" / null
    public int? DefaultTargetId { get; set; }
    public string? DefaultTargetName { get; set; }
    public string? DefaultTargetHint { get; set; }
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
    // Recurring Routes Fixes §5 — polymorphic default target (replaces the
    // courier-only CourierId). null type => unbound.
    public string? DefaultTargetType { get; set; }   // "Courier" / "Agent" / "NetworkPartner"
    public int? DefaultTargetId { get; set; }
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
    // Courier fields kept for the driver filter + back-compat; null for Agent/NP.
    public int? CourierId { get; set; }
    public string? CourierName { get; set; }
    // Recurring Routes Fixes §6 — polymorphic target (Courier/Agent/NP).
    public string? TargetType { get; set; }   // "Courier" / "Agent" / "NetworkPartner"
    public int? TargetId { get; set; }
    public string? TargetName { get; set; }
    public string? TargetHint { get; set; }
}

public class LinehaulRosterRowDto
{
    public int RunId { get; set; }
    public string RunName { get; set; } = string.Empty;
    public string FromDepotName { get; set; } = string.Empty;
    public string ToDepotName { get; set; } = string.Empty;
    public int? DefaultCourierId { get; set; }
    public string? DefaultDriverName { get; set; }
    // Run's default target (whichever type) — cells pre-fill from this (AR-Fix6.2).
    public string? DefaultTargetType { get; set; }
    public int? DefaultTargetId { get; set; }
    public string? DefaultTargetName { get; set; }
    public string? DefaultTargetHint { get; set; }
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
    // Recurring Routes Fixes §6 — polymorphic target (replaces courier-only).
    public string? TargetType { get; set; }   // "Courier" / "Agent" / "NetworkPartner"
    public int TargetId { get; set; }
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
