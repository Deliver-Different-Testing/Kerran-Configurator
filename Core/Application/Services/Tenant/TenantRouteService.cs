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
                Active = r.Active,
                CreatedAt = r.CreatedAt,
                UpdatedAt = r.UpdatedAt,
                Zipcodes = r.RouteZipcodes.Select(rz => new TenantRouteZipcodeDto
                {
                    ZipPolygonId = rz.ZipPolygonId,
                    Zip = rz.ZipPolygon.Zip ?? string.Empty,
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

        return new TenantRoutesResponse(messageId) { Success = true, Routes = rows };
    }

    public async Task<TenantRouteResponse> CreateAsync(TenantRouteUpsertDto dto, Guid messageId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return FailRoute(messageId, "Name is required.");
        if (dto.ZipPolygonIds == null || dto.ZipPolygonIds.Count == 0)
            return FailRoute(messageId, "At least one zip code is required.");

        var actor = ResolveActor();
        var route = new Route
        {
            Name = dto.Name.Trim(),
            Area = dto.Area?.Trim() ?? string.Empty,
            DefaultCourierId = dto.DefaultCourierId,
            Active = dto.Active,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = actor,
        };
        foreach (var zid in dto.ZipPolygonIds.Distinct())
            route.RouteZipcodes.Add(new RouteZipcode { ZipPolygonId = zid });

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
            .Include(r => r.RouteZipcodes)
            .FirstOrDefaultAsync(r => r.RouteId == id);
        if (route == null) return FailRoute(messageId, "Route not found.");

        var actor = ResolveActor();
        route.Name = dto.Name.Trim();
        route.Area = dto.Area?.Trim() ?? string.Empty;
        route.DefaultCourierId = dto.DefaultCourierId;
        route.Active = dto.Active;
        route.UpdatedAt = DateTime.UtcNow;
        route.UpdatedBy = actor;

        // Replace zipcode set wholesale — small N, simpler than reconciling diffs.
        Context.RouteZipcodes.RemoveRange(route.RouteZipcodes);
        foreach (var zid in dto.ZipPolygonIds.Distinct())
            route.RouteZipcodes.Add(new RouteZipcode { RouteId = id, ZipPolygonId = zid });

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

        var courierIds = entries.Select(e => e.CourierId).Distinct().ToList();
        var couriers = await Context.TucCouriers.AsNoTracking()
            .Where(c => courierIds.Contains(c.UccrId))
            .Select(c => new { c.UccrId, c.UccrName, c.UccrSurname, c.Code })
            .ToListAsync();

        var dtos = entries.Select(e =>
        {
            var c = couriers.FirstOrDefault(x => x.UccrId == e.CourierId);
            return new TenantRouteRosterEntryDto
            {
                Id = e.RouteRosterId,
                RouteId = e.RouteId,
                CourierId = e.CourierId,
                CourierName = c == null ? string.Empty : $"{c.UccrName} {c.UccrSurname}".Trim(),
                CourierCode = c?.Code ?? string.Empty,
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
        if (dto.CourierId <= 0) return FailRosterEntry(messageId, "CourierId is required.");
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
            CourierId = dto.CourierId,
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

    // ─── HELPERS ──────────────────────────────────────────────────────

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
