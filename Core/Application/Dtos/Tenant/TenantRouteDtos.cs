using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Tenant;

// ─── Route read shape ─────────────────────────────────────────────────
public class TenantRouteDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public int? DefaultCourierId { get; set; }
    public string DefaultCourierName { get; set; } = string.Empty;
    public string DefaultCourierCode { get; set; } = string.Empty;
    // Unified default target (Courier / Agent / NetworkPartner). Resolved
    // server-side; DefaultCourierId/Name/Code are kept for the roster's
    // courier-only fallback path. DefaultAgentId carries the agent/NP id.
    public int? DefaultAgentId { get; set; }
    public string? DefaultTargetType { get; set; }   // "Courier" | "Agent" | "NetworkPartner" | null
    public int? DefaultTargetId { get; set; }
    public string DefaultTargetName { get; set; } = string.Empty;
    public string DefaultTargetHint { get; set; } = string.Empty;
    public bool Active { get; set; }
    public List<TenantRouteZipcodeDto> Zipcodes { get; set; } = new();
    public int RosterEntryCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class TenantRouteZipcodeDto
{
    public int ZipPolygonId { get; set; }
    public string Zip { get; set; } = string.Empty;
}

// ─── Route upsert (Create + Update share the same shape) ──────────────
public class TenantRouteUpsertDto
{
    public string Name { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    // Default target: Courier / Agent / NetworkPartner + the chosen id.
    // Null type clears the default. NP = an agent with IsNetworkPartner = 1,
    // so Agent + NetworkPartner both resolve to DefaultAgentId server-side.
    public string? DefaultTargetType { get; set; }
    public int? DefaultTargetId { get; set; }
    public bool Active { get; set; } = true;
    public List<int> ZipPolygonIds { get; set; } = new();
}

public class TenantRoutesResponse : BaseResponse
{
    public TenantRoutesResponse(Guid messageId) : base(messageId) { }
    public List<TenantRouteDto> Routes { get; set; } = new();
}

public class TenantRouteResponse : BaseResponse
{
    public TenantRouteResponse(Guid messageId) : base(messageId) { }
    public TenantRouteDto Route { get; set; }
}

// ─── Roster ──────────────────────────────────────────────────────────
public class TenantRouteRosterEntryDto
{
    public int Id { get; set; }
    public int RouteId { get; set; }
    public int CourierId { get; set; }
    public string CourierName { get; set; } = string.Empty;
    public string CourierCode { get; set; } = string.Empty;
    public DateTime? RosterDate { get; set; }
    public byte? DayOfWeek { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class TenantRouteRosterUpsertDto
{
    public int CourierId { get; set; }
    public DateTime? RosterDate { get; set; }
    public byte? DayOfWeek { get; set; }   // Required when RosterDate is null
}

public class TenantRouteRosterResponse : BaseResponse
{
    public TenantRouteRosterResponse(Guid messageId) : base(messageId) { }
    public List<TenantRouteRosterEntryDto> Entries { get; set; } = new();
}

public class TenantRouteRosterEntryResponse : BaseResponse
{
    public TenantRouteRosterEntryResponse(Guid messageId) : base(messageId) { }
    public TenantRouteRosterEntryDto Entry { get; set; }
}

// ─── Lookups ──────────────────────────────────────────────────────────
public class TenantZipcodeLookupDto
{
    public int ZipPolygonId { get; set; }
    public string Zip { get; set; } = string.Empty;
}

public class TenantZipcodeLookupResponse : BaseResponse
{
    public TenantZipcodeLookupResponse(Guid messageId) : base(messageId) { }
    public List<TenantZipcodeLookupDto> Zipcodes { get; set; } = new();
}

public class TenantCourierLookupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}

public class TenantCourierLookupResponse : BaseResponse
{
    public TenantCourierLookupResponse(Guid messageId) : base(messageId) { }
    public List<TenantCourierLookupDto> Couriers { get; set; } = new();
}

// ─── Assignable targets (Courier / Agent / NP picker) ─────────────────
// Normalised to {Id, Name, Hint} per list so the React picker renders any
// type uniformly. Mirrors RunViewer's assignable-targets contract so the
// picker UI stays portable across the two apps.
public class TenantAssignTargetDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Hint { get; set; } = string.Empty;   // courier code, or agent association
}

public class TenantAssignableTargetsResponse : BaseResponse
{
    public TenantAssignableTargetsResponse(Guid messageId) : base(messageId) { }
    public List<TenantAssignTargetDto> Couriers { get; set; } = new();
    public List<TenantAssignTargetDto> Agents { get; set; } = new();
    public List<TenantAssignTargetDto> Nps { get; set; } = new();
}
