#nullable disable
using System;

namespace DfrntDriveConfigurator.Core.Domain.Despatch;

// Junction: a Route covers a set of zip-code areas (the corridor). Reuses the
// existing ZipPolygon table for its geofence/polygon data — no geometry duplicated.
// For NZ deployments, a parallel junction against a postcode table can be added
// later with the same shape.
public partial class RouteZipcode
{
    public int RouteId { get; set; }

    public int ZipPolygonId { get; set; }

    public virtual Route Route { get; set; }
    public virtual ZipPolygon ZipPolygon { get; set; }
}
