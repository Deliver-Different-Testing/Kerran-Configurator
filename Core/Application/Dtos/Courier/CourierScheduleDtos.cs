using System;
using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Courier;

// Phase 2 — courier availability (schedule) DTOs. Ported from courierportal's
// ScheduleService shapes. StatusId: 1 = Available, 2 = Unavailable.

public class CourierTimeSlotDto
{
    public long Id { get; set; }
    public DateTime BookDateTime { get; set; }
    public int? Wanted { get; set; }
    public int? Remaining { get; set; }   // Wanted - (available responses on this slot)
}

public class CourierScheduleResponseDto
{
    public int StatusId { get; set; }     // 1 Available / 2 Unavailable
    public long? TimeSlotId { get; set; }
}

public class CourierScheduleDto
{
    public long Id { get; set; }
    public DateTime BookDate { get; set; }
    public string Name { get; set; }
    public string StartTime { get; set; }   // "HH:mm"
    public string EndTime { get; set; }     // "HH:mm"
    public int Wanted { get; set; }
    public bool HasTimeSlots { get; set; }
    public List<CourierTimeSlotDto> TimeSlots { get; set; } = new();
    public CourierScheduleResponseDto Response { get; set; }   // this courier's response, or null
}

// PUT body for "I'm available" (optional time-slot pick).
public class CourierScheduleRespondDto
{
    public long? TimeSlotId { get; set; }
}
