#nullable disable
using System;
using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Domain.Despatch;

// US zip-code areas with polygon geofence (WKT). Read-only from this app —
// the table is seeded centrally. Used by RouteZipcodes for route corridor
// definition.
public partial class ZipPolygon
{
    public int ZipPolygonId { get; set; }

    public string Zip { get; set; }

    public decimal? Latitude { get; set; }

    public decimal? Longitude { get; set; }

    public long? LandAreaSqM { get; set; }

    public long? WaterAreaSqM { get; set; }

    public string Wkt { get; set; }

    public virtual ICollection<RouteZipcode> RouteZipcodes { get; set; } = new List<RouteZipcode>();
}
