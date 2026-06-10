namespace DfrntDriveConfigurator.Core.Application.Dtos.Reporting;

// Lookup result shapes for the Rate Schedule picker UI (client search, sites,
// speeds, suburbs). Ported from clientcustomreportbuilder's Clients/Sites/
// Speeds/Suburbs features and folded into one ReportingLookupService.

public class ClientSearchResult
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public int SiteId { get; set; }
    public int? HomeSuburbId { get; set; }
    public string? HomeSuburbName { get; set; }
    public bool EconomyActive { get; set; }
    public bool EconomyRuns { get; set; }
    public decimal? PpdRate { get; set; }
}

public class SiteResult
{
    public int SiteId { get; set; }
    public string Name { get; set; } = "";
}

public class SpeedResult
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string ShortName { get; set; } = "";
    public string SystemName { get; set; } = "";
    public int? Minutes { get; set; }
    public int GroupingId { get; set; }
    public string? GroupingName { get; set; }
}

public class SuburbResult
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int SiteId { get; set; }
    public int Zone { get; set; }
}

public class CourierSearchResult
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
}
