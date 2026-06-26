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
    // Fixes §8 — run-level Speed (service level) override. null = inherit schedule.
    public int? SpeedId { get; set; }
    // STEVE-LINEHAUL-RUN-MODAL-MASTER-JOB — the run's master booking (tucJobBooking
    // WHERE LinehaulRunId = Id AND IsLinehaulMaster = 1). null = none linked yet.
    public int? MasterBookingId { get; set; }
    public string? MasterBookingLabel { get; set; }   // "jobNo — name/client" for display
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
    // Fixes §8 — run-level Speed override (TucJobType.UcjtId). null = inherit schedule.
    public int? SpeedId { get; set; }
    // STEVE-LINEHAUL-RUN-MODAL-MASTER-JOB — the booking to mark as this run's master
    // job. null = clear/no master. Applied with the single-master invariant on save.
    public int? MasterBookingId { get; set; }
}

public class TenantDepotLookupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

// One schedule that binds a linehaul run (Recurring Routes Fixes §7 — the
// "Used by Schedules" drill-down). Weekday-variant binding rows are grouped
// into one logical schedule. ScheduleId = BulkRunScheduleId for the Open↗
// deep-link into DespatchWeb's Recurring Jobs editor (null = unlinked binding).
public class LinehaulScheduleBindingDto
{
    public int? ScheduleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool Active { get; set; }
    public string? WeekDay { get; set; }
}

// Candidate booking for the "link master job" picker on a Linehaul Run
// (STEVE-LINEHAUL-RUN-MODAL-MASTER-JOB spec). The server flags whether the
// booking is already linked — to THIS run or another — so the modal can warn
// or disable rather than silently steal a master from another run.
public class TenantLinehaulBookingLookupDto
{
    public int BookingId { get; set; }                 // tucJobBooking.UcbkId
    public string JobNumber { get; set; } = string.Empty; // UcbkJobNumber (primary match)
    public string? JobName { get; set; }               // CustomJobName
    public string? ClientName { get; set; }            // UcbkClient.UcclName
    public string? PickupSummary { get; set; }         // PickupAddressLine1 (display hint)
    public string? DeliverySummary { get; set; }       // DeliveryAddressLine1 (display hint)
    public int? LinkedRunId { get; set; }              // null = unlinked; set = already on a run
    public bool IsMaster { get; set; }                 // already a master booking for its run
    public bool LinkedToThisRun { get; set; }          // already linked to the run being edited
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
