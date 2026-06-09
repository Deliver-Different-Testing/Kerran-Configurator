using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Reporting;

// Ported from the standalone clientcustomreportbuilder app (Reports.Api) into
// the Client Reporting lane. The local suburb x job-type matrix (Items) is the
// functional part — driven by the tenant's tucSuburb/tucClient/tucJobType data
// plus the legacy UTL_fncJob_* rating functions. RegionalItems and
// InternationalItems are PLACEHOLDER sections in the source (hardcoded city
// grids that always return $0 / Unavailable / QuoteRequired) — kept for UI
// parity until a real regional/international rate source is identified.

public enum ServiceGroup
{
    /// <summary>1hr, 2hr, 4hr, Same Day, Direct — suburb-to-suburb via UTL_fncJob_Rate.</summary>
    OnDemand,

    /// <summary>Overnight, Economy, Economy Run — same SP calls as on-demand.</summary>
    Scheduled,

    /// <summary>Regional Same Day, Regional Overnight, National Economy — city-to-city pricing.</summary>
    Regional,

    /// <summary>International Express, Standard, Economy — destination-country pricing.</summary>
    International
}

public class RateScheduleRequest
{
    public int ClientId { get; set; }
    public int? FromSuburbId { get; set; }
    public string? PreparedFor { get; set; }
    public bool IncludeGst { get; set; }
    public bool IncludeFuelSurcharge { get; set; }
    public double Markup { get; set; }
    public bool IncludePpd { get; set; }
    public List<int> SuburbIds { get; set; } = new();
    public List<int> JobTypeIds { get; set; } = new();
}

public class RateScheduleResponse
{
    public string ClientName { get; set; } = "";
    public string FromSuburbName { get; set; } = "";
    public string PreparedFor { get; set; } = "";
    public decimal StandardRate { get; set; }
    public decimal VanRate { get; set; }
    public int StartingExcessWeight { get; set; }

    public List<RateScheduleItem> Items { get; set; } = new();
    public List<RegionalRateItem> RegionalItems { get; set; } = new();
    public List<InternationalRateItem> InternationalItems { get; set; } = new();

    public bool IsProspect { get; set; }
    public string? ProspectCompanyName { get; set; }
}

public class RateScheduleItem
{
    public int ToSuburbId { get; set; }
    public string ToSuburbName { get; set; } = "";
    public int JobTypeId { get; set; }
    public string SpeedName { get; set; } = "";
    public int? Minutes { get; set; }
    public decimal Rate { get; set; }
    public string Availability { get; set; } = "";
    public bool AreaOneCarJob { get; set; }
    public bool Pedal { get; set; }
    public int GroupingId { get; set; }
}

public class ProspectRateRequest
{
    public string? CompanyName { get; set; }
    public string? ContactName { get; set; }
    public string LocationMode { get; set; } = "suburbs";
    public List<ProspectLocation> Locations { get; set; } = new();
    public int? BaseRateCodeId { get; set; }
    public bool IncludeGst { get; set; } = true;
    public bool IncludeFuelSurcharge { get; set; } = true;
    public double Markup { get; set; }
    public List<string>? ServiceGroups { get; set; }
}

public class ProspectLocation
{
    public string? Name { get; set; }
    public string? Code { get; set; }
    public string? Zone { get; set; }
    public string? Region { get; set; }
}

public class RegionalRateItem
{
    public string FromCityCode { get; set; } = "";
    public string FromCityName { get; set; } = "";
    public string ToCityCode { get; set; } = "";
    public string ToCityName { get; set; } = "";
    public string SpeedName { get; set; } = "";
    public string WeightTier { get; set; } = "";
    public decimal WeightMinKg { get; set; }
    public decimal WeightMaxKg { get; set; }
    public decimal Rate { get; set; }
    public string Availability { get; set; } = "";
    public ServiceGroup ServiceGroup => ServiceGroup.Regional;
}

public class InternationalRateItem
{
    public string DestinationCode { get; set; } = "";
    public string City { get; set; } = "";
    public string Country { get; set; } = "";
    public string Region { get; set; } = "";
    public string SpeedName { get; set; } = "";
    public string WeightTier { get; set; } = "";
    public decimal WeightMinKg { get; set; }
    public decimal WeightMaxKg { get; set; }
    public decimal Rate { get; set; }
    public string Availability { get; set; } = "";
    public bool RequiresQuote { get; set; }
    public ServiceGroup ServiceGroup => ServiceGroup.International;
}

// Internal projection of the per-client rate config (read via raw SQL in
// RateScheduleService.GetClientInfoAsync). Not exposed over the wire.
internal class ClientRateInfo
{
    public int ClientId { get; set; }
    public int SiteId { get; set; }
    public string ClientName { get; set; } = "";
    public int SuburbId { get; set; }
    public string SuburbName { get; set; } = "";
    public int? StandardRateCodeId { get; set; }
    public decimal StandardRateAmount { get; set; }
    public int? VanRateCodeId { get; set; }
    public decimal VanRateAmount { get; set; }
    public int StartingWeightExcess { get; set; }
    public decimal? PpdRate { get; set; }
    public bool EconomyActive { get; set; }
    public bool EconomyRuns { get; set; }
}
