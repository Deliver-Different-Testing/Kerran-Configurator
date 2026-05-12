using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Shapes match the React DashboardStats / ActivityFeedItem types at
// wwwroot/app/react/services/np_dashboardService.ts.
public class NpDashboardStatsDto
{
    public int ActiveCouriers { get; set; }
    public int JobsToday { get; set; }
    public int Completed { get; set; }
    public string RevenueThisWeek { get; set; } = "$0";

    // Agent identity for the welcome card. Null when caller is an unscoped
    // admin (no specific NP context) — frontend hides the welcome card in
    // that case rather than showing a stale "Pacific Express Logistics".
    public string? AgentName { get; set; }
    public string? AgentInitials { get; set; }
    public string? AgentTier { get; set; }
}

public class NpActivityFeedItemDto
{
    public string Time { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class NpDashboardStatsResponse : BaseResponse
{
    public NpDashboardStatsResponse(Guid messageId) : base(messageId) { }
    public NpDashboardStatsDto Stats { get; set; } = new();
}

public class NpActivityFeedResponse : BaseResponse
{
    public NpActivityFeedResponse(Guid messageId) : base(messageId) { }
    public List<NpActivityFeedItemDto> Items { get; set; } = new();
}
