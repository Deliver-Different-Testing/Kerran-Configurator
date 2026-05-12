using System;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Tenant;

// Shape consumed by the React Tenant Dashboard's metric tiles.
// The frontend renders the formatted strings as-is for the money/percent tiles.
public class TenantDashboardStatsDto
{
    public double OtdRate { get; set; }                // 0-100
    public double ExceptionRate { get; set; }          // 0-100
    public int MonthlyVolume { get; set; }
    public string MonthlyNpBilling { get; set; } = "$0";
    public int MarketCoverage { get; set; }
}

public class TenantDashboardStatsResponse : BaseResponse
{
    public TenantDashboardStatsResponse(Guid messageId) : base(messageId) { }
    public TenantDashboardStatsDto Stats { get; set; } = new();
}
