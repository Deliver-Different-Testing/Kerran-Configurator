using System;
using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Courier modal §13 — courier communications (logged against dbo.tucEvent, the
// legacy events log, scoped to Group 'CE' event types).

public class CourierEventTypeOptionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class CourierCommunicationDto
{
    public int Id { get; set; }
    public int TypeId { get; set; }
    public string TypeName { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public DateTime? Date { get; set; }
    public string Staff { get; set; } = string.Empty;
}

// GET payload — the CE type dropdown + the courier's logged communications.
public class CourierCommunicationsDto
{
    public List<CourierEventTypeOptionDto> Types { get; set; } = new();
    public List<CourierCommunicationDto> Entries { get; set; } = new();
}

// POST body — log a new communication.
public class LogCourierCommunicationDto
{
    public int TypeId { get; set; }
    public string Body { get; set; } = string.Empty;
}
