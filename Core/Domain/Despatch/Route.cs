#nullable disable
using System;
using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Domain.Despatch;

// A named recurring delivery route — a cluster of zip codes (corridor) typically
// run by the same courier on a recurring schedule. The route definition lives
// here; the per-day courier assignment lives in DispatchRouteRoster; the actual
// jobs are materialised from tucJobBooking each night by uspPrebookSet.
//
// See docs/RECURRING-ROUTES-IMPLEMENTATION.md for the cross-repo flow.
public partial class Route
{
    public int RouteId { get; set; }

    public string Name { get; set; }

    public string Area { get; set; }

    // Fallback courier if no DispatchRouteRoster entry exists for today.
    public int? DefaultCourierId { get; set; }

    public bool Active { get; set; }

    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string UpdatedBy { get; set; }

    public virtual ICollection<RouteZipcode> RouteZipcodes { get; set; } = new List<RouteZipcode>();
    public virtual ICollection<DispatchRouteRoster> DispatchRouteRosters { get; set; } = new List<DispatchRouteRoster>();
}
