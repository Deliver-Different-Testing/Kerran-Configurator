using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Thrown for courier-communication validation failures; the controller maps to 400.
public class CourierCommunicationException(string message) : Exception(message);

// Courier modal §13 — staff-logged courier communications. Reads/writes the
// legacy dbo.tucEvent log (Admin Manager's Communications surface), scoped to
// the courier (ucevCourierID) and the 'CE' (Courier Event) event-type group.
// AdminManager already has SELECT/INSERT/UPDATE on tucEvent (database/019) and
// tucEventType (database/008). Tenant staff / DF admin only.
//
// Write shape (no existing CE rows to mirror — verified empty across tenants
// 2026-06-22, so this is the sensible default; confirm against AM if it ever
// starts logging CE): body -> ucevNotes, actor -> ucevDespatcher (<=15), the
// date/time/due = now, and the four NOT NULL bits = 0. Read body falls back to
// ucevDescription so automation/legacy rows still display.
public class CourierCommunicationService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    private const string CourierEventGroup = "CE";

    public async Task<CourierCommunicationsDto> GetForCourierAsync(int courierId, CancellationToken ct = default)
    {
        var types = await Context.TucEventTypes.AsNoTracking()
            .Where(t => t.UcetGroup == CourierEventGroup)
            .OrderBy(t => t.UcetName)
            .Select(t => new CourierEventTypeOptionDto { Id = t.UcetId, Name = t.UcetName ?? string.Empty })
            .ToListAsync(ct);

        var typeIds = types.Select(t => t.Id).ToList();
        var nameById = types.ToDictionary(t => t.Id, t => t.Name);

        var rows = await Context.TucEvents.AsNoTracking()
            .Where(e => e.UcevCourierId == courierId && e.UcevType != null && typeIds.Contains(e.UcevType.Value))
            .OrderByDescending(e => e.UcevId)
            .Select(e => new
            {
                e.UcevId,
                e.UcevType,
                Body = e.UcevNotes ?? e.UcevDescription,
                e.UcevDate,
                e.UcevDespatcher,
            })
            .ToListAsync(ct);

        var entries = rows.Select(r => new CourierCommunicationDto
        {
            Id = r.UcevId,
            TypeId = r.UcevType ?? 0,
            TypeName = r.UcevType != null && nameById.TryGetValue(r.UcevType.Value, out var n) ? n : string.Empty,
            Body = r.Body ?? string.Empty,
            Date = r.UcevDate,
            Staff = r.UcevDespatcher ?? string.Empty,
        }).ToList();

        return new CourierCommunicationsDto { Types = types, Entries = entries };
    }

    public async Task<CourierCommunicationsDto> LogAsync(int courierId, int typeId, string body, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(body))
            throw new CourierCommunicationException("Please enter the communication.");

        var isCeType = await Context.TucEventTypes.AsNoTracking()
            .AnyAsync(t => t.UcetId == typeId && t.UcetGroup == CourierEventGroup, ct);
        if (!isCeType)
            throw new CourierCommunicationException("Please choose a valid communication type.");

        var now = DateTime.UtcNow;
        Context.TucEvents.Add(new TucEvent
        {
            UcevCourierId = courierId,
            UcevType = typeId,
            UcevNotes = body.Trim(),
            UcevDate = now,
            UcevTime = now,
            UcevDueTime = now,
            UcevDespatcher = Actor(),
            UcevPageCourier = false,
            UcevClosed = false,
            UcevIsScheduled = false,
            UcevNotificationSent = false,
        });
        await Context.SaveChangesAsync(ct);

        return await GetForCourierAsync(courierId, ct);
    }

    // ucevDespatcher is varchar(15) — store a short actor identifier (the legacy
    // automation path uses 'Automation' here). No reliable numeric staff id is
    // available from the session, so ucevOriginator is left null.
    private string Actor()
    {
        var name = httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
                   ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
                   ?? "staff";
        return name.Length > 15 ? name.Substring(0, 15) : name;
    }
}
