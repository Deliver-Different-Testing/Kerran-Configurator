using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Tenant;

// Tenant-side CRUD for Routes + RouteRoster. Powers the Routes and Route
// Roster pages under wwwroot/app/react/pages/tenant/. The data this writes
// is read downstream by uspPrebookSet (each night, to materialise tucJob
// rows with the correct courier) and surfaced in RunViewer via the modified
// RVW_stp* SPs — see docs/RECURRING-ROUTES-IMPLEMENTATION.md.
public class TenantRouteService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    // ─── ROUTES ───────────────────────────────────────────────────────

    public async Task<TenantRoutesResponse> GetAll(Guid messageId)
    {
        var rows = await Context.Routes
            .AsNoTracking()
            .OrderByDescending(r => r.Active)
            .ThenBy(r => r.Name)
            .Select(r => new TenantRouteDto
            {
                Id = r.RouteId,
                Name = r.Name ?? string.Empty,
                Area = r.Area ?? string.Empty,
                DefaultCourierId = r.DefaultCourierId,
                DefaultAgentId = r.DefaultAgentId,
                DefaultTargetType = r.DefaultTargetType == 1 ? "Courier"
                    : r.DefaultTargetType == 2 ? "Agent"
                    : r.DefaultTargetType == 3 ? "NetworkPartner"
                    : (r.DefaultCourierId != null ? "Courier" : null),
                Active = r.Active,
                CreatedAt = r.CreatedAt,
                UpdatedAt = r.UpdatedAt,
                Zipcodes = r.ZipPolygons.Select(z => new TenantRouteZipcodeDto
                {
                    ZipPolygonId = z.ZipPolygonId,
                    Zip = z.Zip ?? string.Empty,
                }).ToList(),
                RosterEntryCount = r.DispatchRouteRosters.Count(rr => rr.IsActive),
            })
            .ToListAsync();

        // Resolve default-courier names in a single follow-up query rather than navigating
        // through TucCourier in the projection (avoids the multi-tenant CourierId schema noise).
        var courierIds = rows.Where(r => r.DefaultCourierId.HasValue).Select(r => r.DefaultCourierId.Value).Distinct().ToList();
        var couriers = await Context.TucCouriers.AsNoTracking()
            .Where(c => courierIds.Contains(c.UccrId))
            .Select(c => new { c.UccrId, c.UccrName, c.UccrSurname, c.Code })
            .ToListAsync();
        foreach (var r in rows)
        {
            if (!r.DefaultCourierId.HasValue) continue;
            var c = couriers.FirstOrDefault(x => x.UccrId == r.DefaultCourierId.Value);
            if (c == null) continue;
            r.DefaultCourierName = $"{c.UccrName} {c.UccrSurname}".Trim();
            r.DefaultCourierCode = c.Code ?? string.Empty;
        }

        // Resolve agent (incl. NP) default-target names in a single follow-up.
        var agentIds = rows.Where(r => r.DefaultAgentId.HasValue).Select(r => r.DefaultAgentId!.Value).Distinct().ToList();
        var agents = agentIds.Count == 0
            ? new List<(int UcagId, string? UcagName, string? Association)>()
            : (await Context.TucAgents.AsNoTracking()
                .Where(a => agentIds.Contains(a.UcagId))
                .Select(a => new { a.UcagId, a.UcagName, a.Association })
                .ToListAsync())
              .Select(a => (a.UcagId, a.UcagName, a.Association)).ToList();

        // Populate the unified default-target fields (name + hint) per type.
        foreach (var r in rows)
        {
            if (r.DefaultTargetType == "Courier" && r.DefaultCourierId.HasValue)
            {
                r.DefaultTargetId = r.DefaultCourierId;
                r.DefaultTargetName = r.DefaultCourierName;
                r.DefaultTargetHint = r.DefaultCourierCode;
            }
            else if ((r.DefaultTargetType == "Agent" || r.DefaultTargetType == "NetworkPartner") && r.DefaultAgentId.HasValue)
            {
                var a = agents.FirstOrDefault(x => x.UcagId == r.DefaultAgentId.Value);
                r.DefaultTargetId = r.DefaultAgentId;
                r.DefaultTargetName = a.UcagName ?? string.Empty;
                r.DefaultTargetHint = a.Association ?? string.Empty;
            }
        }

        return new TenantRoutesResponse(messageId) { Success = true, Routes = rows };
    }

    public async Task<TenantRouteResponse> CreateAsync(TenantRouteUpsertDto dto, Guid messageId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return FailRoute(messageId, "Name is required.");
        if (dto.ZipPolygonIds == null || dto.ZipPolygonIds.Count == 0)
            return FailRoute(messageId, "At least one zip code is required.");

        var actor = ResolveActor();
        var (targetType, courierId, agentId) = MapTarget(dto.DefaultTargetType, dto.DefaultTargetId);
        var route = new Route
        {
            Name = dto.Name.Trim(),
            Area = dto.Area?.Trim() ?? string.Empty,
            DefaultTargetType = targetType,
            DefaultCourierId = courierId,
            DefaultAgentId = agentId,
            Active = dto.Active,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = actor,
        };
        // EF Power Tools regenerated RouteZipcodes as an implicit junction
        // (skip-navigation `Route.ZipPolygons`), so we attach existing
        // ZipPolygon rows by ID — EF inserts the junction rows on save.
        var newIds = dto.ZipPolygonIds.Distinct().ToList();
        var newZips = await Context.ZipPolygons
            .Where(z => newIds.Contains(z.ZipPolygonId))
            .ToListAsync();
        foreach (var z in newZips)
            route.ZipPolygons.Add(z);

        Context.Routes.Add(route);
        await Context.SaveChangesAsync();

        return await ReadRouteAsync(route.RouteId, messageId);
    }

    public async Task<TenantRouteResponse> UpdateAsync(int id, TenantRouteUpsertDto dto, Guid messageId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return FailRoute(messageId, "Name is required.");
        if (dto.ZipPolygonIds == null || dto.ZipPolygonIds.Count == 0)
            return FailRoute(messageId, "At least one zip code is required.");

        var route = await Context.Routes
            .Include(r => r.ZipPolygons)
            .FirstOrDefaultAsync(r => r.RouteId == id);
        if (route == null) return FailRoute(messageId, "Route not found.");

        var actor = ResolveActor();
        var (targetType, courierId, agentId) = MapTarget(dto.DefaultTargetType, dto.DefaultTargetId);
        route.Name = dto.Name.Trim();
        route.Area = dto.Area?.Trim() ?? string.Empty;
        route.DefaultTargetType = targetType;
        route.DefaultCourierId = courierId;
        route.DefaultAgentId = agentId;
        route.Active = dto.Active;
        route.UpdatedAt = DateTime.UtcNow;
        route.UpdatedBy = actor;

        // Replace zipcode set wholesale — small N, simpler than reconciling diffs.
        // Clear() on the skip-nav collection has EF delete the corresponding
        // implicit-junction rows; Add() inserts new ones on save.
        var newIds = dto.ZipPolygonIds.Distinct().ToList();
        var newZips = await Context.ZipPolygons
            .Where(z => newIds.Contains(z.ZipPolygonId))
            .ToListAsync();
        route.ZipPolygons.Clear();
        foreach (var z in newZips)
            route.ZipPolygons.Add(z);

        await Context.SaveChangesAsync();
        return await ReadRouteAsync(id, messageId);
    }

    public async Task<TenantRouteResponse> SoftDeleteAsync(int id, Guid messageId)
    {
        var route = await Context.Routes.FirstOrDefaultAsync(r => r.RouteId == id);
        if (route == null) return FailRoute(messageId, "Route not found.");

        route.Active = false;
        route.UpdatedAt = DateTime.UtcNow;
        route.UpdatedBy = ResolveActor();
        await Context.SaveChangesAsync();
        return await ReadRouteAsync(id, messageId);
    }

    private async Task<TenantRouteResponse> ReadRouteAsync(int id, Guid messageId)
    {
        var all = await GetAll(messageId);
        var route = all.Routes.FirstOrDefault(r => r.Id == id);
        return new TenantRouteResponse(messageId) { Success = true, Route = route };
    }

    // ─── ROSTER ───────────────────────────────────────────────────────

    public async Task<TenantRouteRosterResponse> GetRosterAsync(int routeId, Guid messageId)
    {
        var route = await Context.Routes.AsNoTracking().FirstOrDefaultAsync(r => r.RouteId == routeId);
        if (route == null) return new TenantRouteRosterResponse(messageId) { Success = false, Messages = { new MessageDto { Message = "Route not found." } } };

        var entries = await Context.DispatchRouteRosters.AsNoTracking()
            .Where(rr => rr.RouteId == routeId && rr.IsActive)
            .OrderBy(rr => rr.RosterDate == null ? 0 : 1)
            .ThenBy(rr => rr.DayOfWeek)
            .ThenBy(rr => rr.RosterDate)
            .ToListAsync();

        var courierIds = entries.Where(e => e.CourierId != null).Select(e => e.CourierId!.Value).Distinct().ToList();
        var couriers = await Context.TucCouriers.AsNoTracking()
            .Where(c => courierIds.Contains(c.UccrId))
            .Select(c => new { c.UccrId, c.UccrName, c.UccrSurname, c.Code })
            .ToListAsync();

        var agentIds = entries.Where(e => e.AgentId != null).Select(e => e.AgentId!.Value).Distinct().ToList();
        var agents = await Context.TucAgents.AsNoTracking()
            .Where(a => agentIds.Contains(a.UcagId))
            .Select(a => new { a.UcagId, a.UcagName, a.Association })
            .ToListAsync();

        var dtos = entries.Select(e =>
        {
            var c = e.CourierId == null ? null : couriers.FirstOrDefault(x => x.UccrId == e.CourierId);
            var a = e.AgentId == null ? null : agents.FirstOrDefault(x => x.UcagId == e.AgentId);
            var courierName = c == null ? string.Empty : $"{c.UccrName} {c.UccrSurname}".Trim();

            // Resolve the unified target. Legacy/untyped rows with a courier fall
            // back to Courier so the picker still renders them.
            var type = TargetTypeName(e.TargetType) ?? (e.CourierId != null ? "Courier" : null);
            var (targetId, targetName, targetHint) = type switch
            {
                "Courier"        => ((int?)e.CourierId, courierName, c?.Code ?? string.Empty),
                "Agent"          => ((int?)e.AgentId, a?.UcagName ?? string.Empty, a?.Association ?? string.Empty),
                "NetworkPartner" => ((int?)e.AgentId, a?.UcagName ?? string.Empty, a?.Association ?? string.Empty),
                _                => ((int?)null, string.Empty, string.Empty),
            };

            return new TenantRouteRosterEntryDto
            {
                Id = e.RouteRosterId,
                RouteId = e.RouteId,
                CourierId = e.CourierId,
                CourierName = courierName,
                CourierCode = c?.Code ?? string.Empty,
                TargetType = type,
                TargetId = targetId,
                TargetName = targetName,
                TargetHint = targetHint,
                RosterDate = e.RosterDate,
                DayOfWeek = e.DayOfWeek,
                IsActive = e.IsActive,
                CreatedAt = e.CreatedAt,
            };
        }).ToList();

        return new TenantRouteRosterResponse(messageId) { Success = true, Entries = dtos };
    }

    public async Task<TenantRouteRosterEntryResponse> CreateRosterAsync(int routeId, TenantRouteRosterUpsertDto dto, Guid messageId)
    {
        var (targetType, courierId, agentId) = MapTarget(dto.TargetType, dto.TargetId);
        if (targetType == null || (dto.TargetId ?? 0) <= 0)
            return FailRosterEntry(messageId, "A Courier, Agent, or Network Partner target is required.");
        if (dto.RosterDate == null && dto.DayOfWeek == null)
            return FailRosterEntry(messageId, "Either RosterDate or DayOfWeek must be set.");
        if (dto.RosterDate != null && dto.DayOfWeek != null)
            return FailRosterEntry(messageId, "Only one of RosterDate or DayOfWeek may be set.");

        // For DOW rows, deactivate any existing active row for the same (Route, DayOfWeek) — the
        // unique filtered index would reject otherwise. Date-specific rows do the same per date.
        var collisions = Context.DispatchRouteRosters
            .Where(rr => rr.RouteId == routeId && rr.IsActive
                && ((dto.RosterDate != null && rr.RosterDate == dto.RosterDate.Value.Date) ||
                    (dto.RosterDate == null && rr.RosterDate == null && rr.DayOfWeek == dto.DayOfWeek)));
        foreach (var c in await collisions.ToListAsync())
            c.IsActive = false;

        var entry = new DispatchRouteRoster
        {
            RouteId = routeId,
            TargetType = targetType,
            CourierId = courierId,
            AgentId = agentId,
            RosterDate = dto.RosterDate?.Date,
            DayOfWeek = dto.DayOfWeek,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = ResolveActor(),
        };
        Context.DispatchRouteRosters.Add(entry);
        await Context.SaveChangesAsync();

        var roster = await GetRosterAsync(routeId, messageId);
        var dtoOut = roster.Entries.FirstOrDefault(e => e.Id == entry.RouteRosterId);
        return new TenantRouteRosterEntryResponse(messageId) { Success = true, Entry = dtoOut };
    }

    public async Task<TenantRouteRosterEntryResponse> DeleteRosterAsync(int routeId, int rosterId, Guid messageId)
    {
        var entry = await Context.DispatchRouteRosters
            .FirstOrDefaultAsync(rr => rr.RouteRosterId == rosterId && rr.RouteId == routeId);
        if (entry == null) return FailRosterEntry(messageId, "Roster entry not found.");

        // Soft-delete to preserve history (matches the IsActive=0 pattern uspPrebookSet ignores).
        entry.IsActive = false;
        await Context.SaveChangesAsync();
        return new TenantRouteRosterEntryResponse(messageId) { Success = true };
    }

    // ─── LOOKUPS ──────────────────────────────────────────────────────

    public async Task<TenantZipcodeLookupResponse> SearchZipcodesAsync(string q, Guid messageId, int max = 50)
    {
        var query = Context.ZipPolygons.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var trimmed = q.Trim();
            query = query.Where(z => z.Zip.Contains(trimmed));
        }
        var rows = await query
            .OrderBy(z => z.Zip)
            .Take(max)
            .Select(z => new TenantZipcodeLookupDto
            {
                ZipPolygonId = z.ZipPolygonId,
                Zip = z.Zip ?? string.Empty,
            })
            .ToListAsync();

        return new TenantZipcodeLookupResponse(messageId) { Success = true, Zipcodes = rows };
    }

    public async Task<TenantCourierLookupResponse> GetCouriersLookupAsync(Guid messageId)
    {
        var rows = await Context.TucCouriers.AsNoTracking()
            .Where(c => c.Active)
            .OrderBy(c => c.UccrSurname)
            .ThenBy(c => c.UccrName)
            .Select(c => new TenantCourierLookupDto
            {
                Id = c.UccrId,
                Name = ((c.UccrName ?? string.Empty) + " " + (c.UccrSurname ?? string.Empty)).Trim(),
                Code = c.Code ?? string.Empty,
            })
            .ToListAsync();

        return new TenantCourierLookupResponse(messageId) { Success = true, Couriers = rows };
    }

    // Three lists (couriers / agents / NPs) for the route-default Assign
    // picker, each normalised to {Id, Name, Hint}. NP = agent with
    // IsNetworkPartner = 1; regular agents are the complement.
    public async Task<TenantAssignableTargetsResponse> GetAssignableTargetsAsync(Guid messageId)
    {
        var couriers = await Context.TucCouriers.AsNoTracking()
            .Where(c => c.Active)
            .OrderBy(c => c.UccrSurname).ThenBy(c => c.UccrName)
            .Select(c => new TenantAssignTargetDto
            {
                Id = c.UccrId,
                Name = ((c.UccrName ?? string.Empty) + " " + (c.UccrSurname ?? string.Empty)).Trim(),
                Hint = c.Code ?? string.Empty,
            })
            .ToListAsync();

        var agents = await Context.TucAgents.AsNoTracking()
            .Where(a => !a.IsNetworkPartner)
            .OrderBy(a => a.UcagName)
            .Select(a => new TenantAssignTargetDto
            {
                Id = a.UcagId,
                Name = a.UcagName ?? string.Empty,
                Hint = a.Association ?? string.Empty,
            })
            .ToListAsync();

        var nps = await Context.TucAgents.AsNoTracking()
            .Where(a => a.IsNetworkPartner)
            .OrderBy(a => a.UcagName)
            .Select(a => new TenantAssignTargetDto
            {
                Id = a.UcagId,
                Name = a.UcagName ?? string.Empty,
                Hint = a.Association ?? string.Empty,
            })
            .ToListAsync();

        return new TenantAssignableTargetsResponse(messageId)
        {
            Success = true,
            Couriers = couriers,
            Agents = agents,
            Nps = nps,
        };
    }

    // ─── HELPERS ──────────────────────────────────────────────────────

    // Maps the picker's (type, id) onto the Route target columns. Agent + NP
    // both land in DefaultAgentId (NP = agent w/ IsNetworkPartner=1);
    // DefaultTargetType records which the operator chose. Unknown/empty type
    // clears the default.
    private static (byte? Type, int? CourierId, int? AgentId) MapTarget(string? type, int? id) => type switch
    {
        "Courier"        => ((byte?)1, id, null),
        "Agent"          => ((byte?)2, null, id),
        "NetworkPartner" => ((byte?)3, null, id),
        _                => (null, null, null),
    };

    // Inverse of MapTarget: the stored target-type byte back to the picker's
    // string. Null for untyped/unknown rows.
    private static string? TargetTypeName(byte? type) => type switch
    {
        1 => "Courier",
        2 => "Agent",
        3 => "NetworkPartner",
        _ => null,
    };

    private string ResolveActor() =>
        httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
        ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
        ?? "system";

    private static TenantRouteResponse FailRoute(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
    };

    private static TenantRouteRosterEntryResponse FailRosterEntry(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
    };
}
