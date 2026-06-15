using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Courier;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Courier;

// Phase 2 — courier availability flow, ported natively from courierportal's
// ScheduleService. The courier sees upcoming schedules for their region and
// marks themselves Available (optionally on a time slot) or Unavailable.
//
// v1 parity scope: list + available/unavailable + per-slot remaining counts.
// Deferred to a follow-up (logged): legacy conflict auto-mark-unavailable across
// overlapping schedules, and vehicle-type slot filtering
// (CourierScheduleTimeSlotVehicleType). Noted in memory.
public class CourierScheduleService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    ICourierScopeResolver scopeResolver)
{
    private const int Available = 1;
    private const int Unavailable = 2;

    public async Task<List<CourierScheduleDto>> GetMyScheduleAsync(CancellationToken ct)
    {
        var (ctx, courier) = await LoadCourierAsync(ct);
        await using (ctx)
        {
            if (courier.RegionId == null) return new List<CourierScheduleDto>();
            var region = courier.RegionId.Value;
            var today = DateTime.UtcNow.Date;
            var now = DateTime.UtcNow;

            var schedules = await ctx.CourierSchedules
                .Where(s => s.NotificationSent != null && s.LocationId == region && s.BookDate >= today)
                .Include(s => s.CourierScheduleResponses)
                .ToListAsync(ct);

            var slots = await ctx.CourierScheduleTimeSlots
                .Where(t => t.LocationId == region && t.BookDateTime >= today)
                .Include(t => t.CourierScheduleResponses)
                .ToListAsync(ct);

            return schedules
                .Where(s => Ended(s) > now)              // hide already-ended schedules
                .OrderBy(s => s.BookDate).ThenBy(s => s.StartTime)
                .Select(s => MapSchedule(s, slots, courier.UccrId))
                .ToList();
        }
    }

    public async Task<List<CourierScheduleDto>> SetAvailableAsync(long scheduleId, CourierScheduleRespondDto dto, CancellationToken ct) =>
        await RespondAsync(scheduleId, Available, dto?.TimeSlotId, ct);

    public async Task<List<CourierScheduleDto>> SetUnavailableAsync(long scheduleId, CancellationToken ct) =>
        await RespondAsync(scheduleId, Unavailable, null, ct);

    // ---- internals --------------------------------------------------------

    private async Task<List<CourierScheduleDto>> RespondAsync(long scheduleId, int statusId, long? timeSlotId, CancellationToken ct)
    {
        var (ctx, courier) = await LoadCourierAsync(ct);
        await using (ctx)
        {
            var schedule = await ctx.CourierSchedules
                .Include(s => s.CourierScheduleResponses)
                .FirstOrDefaultAsync(s => s.Id == scheduleId && s.NotificationSent != null, ct)
                ?? throw new CourierPortalException("That schedule is no longer available.");

            if (courier.RegionId == null || schedule.LocationId != courier.RegionId)
                throw new CourierPortalException("That schedule isn't in your region.");

            if (Ended(schedule) <= DateTime.UtcNow)
                throw new CourierPortalException("That schedule has already passed.");

            if (statusId == Available && timeSlotId.HasValue)
            {
                var slotOk = await ctx.CourierScheduleTimeSlots
                    .AnyAsync(t => t.Id == timeSlotId.Value && t.LocationId == courier.RegionId, ct);
                if (!slotOk) throw new CourierPortalException("That time slot isn't valid for this schedule.");
            }

            var now = DateTime.UtcNow;
            var existing = schedule.CourierScheduleResponses.FirstOrDefault(r => r.CourierId == courier.UccrId);
            if (existing == null)
            {
                ctx.CourierScheduleResponses.Add(new CourierScheduleResponse
                {
                    ScheduleId = scheduleId,
                    CourierId = courier.UccrId,
                    StatusId = statusId,
                    TimeSlotId = statusId == Available ? timeSlotId : null,
                    Created = now,
                    Updated = now,
                });
            }
            else
            {
                existing.StatusId = statusId;
                existing.TimeSlotId = statusId == Available ? timeSlotId : null;
                existing.Updated = now;
            }

            await ctx.SaveChangesAsync(ct);
        }

        // Re-read for fresh remaining counts / response state.
        return await GetMyScheduleAsync(ct);
    }

    private async Task<(DynamicDespatchDbContext ctx, TucCourier courier)> LoadCourierAsync(CancellationToken ct)
    {
        var scope = await scopeResolver.ResolveAsync(ct);
        if (scope == null) throw new CourierPortalException("No active courier record is linked to your account.");
        var ctx = await contextFactory.CreateDbContextAsync(ct);
        var courier = await ctx.TucCouriers.FirstOrDefaultAsync(c => c.UccrId == scope.CourierId, ct);
        if (courier == null) { await ctx.DisposeAsync(); throw new CourierPortalException("Courier record not found."); }
        return (ctx, courier);
    }

    private static DateTime Ended(CourierSchedule s) => s.BookDate.Date + s.EndTime.ToTimeSpan();

    private static CourierScheduleDto MapSchedule(CourierSchedule s, List<CourierScheduleTimeSlot> allSlots, int courierId)
    {
        // Slots belonging to this schedule = same date, time-of-day within the window.
        var start = s.StartTime.ToTimeSpan();
        var end = s.EndTime.ToTimeSpan();
        var slots = allSlots
            .Where(t => t.BookDateTime.Date == s.BookDate.Date
                        && t.BookDateTime.TimeOfDay >= start && t.BookDateTime.TimeOfDay < end)
            .OrderBy(t => t.BookDateTime)
            .Select(t => new CourierTimeSlotDto
            {
                Id = t.Id,
                BookDateTime = t.BookDateTime,
                Wanted = t.Wanted,
                Remaining = t.Wanted.HasValue
                    ? t.Wanted.Value - t.CourierScheduleResponses.Count(r => r.StatusId == Available)
                    : null,
            })
            .ToList();

        var mine = s.CourierScheduleResponses.FirstOrDefault(r => r.CourierId == courierId);

        return new CourierScheduleDto
        {
            Id = s.Id,
            BookDate = s.BookDate,
            Name = s.Name,
            StartTime = s.StartTime.ToString("HH:mm", CultureInfo.InvariantCulture),
            EndTime = s.EndTime.ToString("HH:mm", CultureInfo.InvariantCulture),
            Wanted = s.Wanted,
            HasTimeSlots = slots.Count > 0,
            TimeSlots = slots,
            Response = mine == null ? null : new CourierScheduleResponseDto { StatusId = mine.StatusId, TimeSlotId = mine.TimeSlotId },
        };
    }
}
