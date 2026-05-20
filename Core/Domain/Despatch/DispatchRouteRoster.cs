#nullable disable
using System;

namespace DfrntDriveConfigurator.Core.Domain.Despatch;

// Per-route courier assignment. Two modes supported by the same row:
//   - Date-specific override (RosterDate set, DayOfWeek NULL)
//   - Weekly pattern         (DayOfWeek set 0=Sun..6=Sat, RosterDate NULL)
//
// uspPrebookSet looks up today's courier with this precedence:
//   1. Date override matching today wins
//   2. Otherwise DOW pattern matching today's weekday
//   3. Otherwise Route.DefaultCourierId
//
// Unique indexes (per the migration) enforce one active entry per (Route, Date)
// and per (Route, DayOfWeek). Deactivation via IsActive=0 preserves history.
public partial class DispatchRouteRoster
{
    public int RouteRosterId { get; set; }

    public int RouteId { get; set; }

    public int CourierId { get; set; }

    public DateTime? RosterDate { get; set; }

    public byte? DayOfWeek { get; set; }   // 0=Sun..6=Sat (SQL Server DATEPART(weekday,...)-1 convention)

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; }

    public virtual Route Route { get; set; }
}
