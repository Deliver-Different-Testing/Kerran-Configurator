using System;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Minimal compliance dashboard payload — populated for real once the
// compliance/document tracking schema lands. Expansion path: add breakdownByType,
// urgentAlerts, fleetCompliancePercent etc. to match Steve's React types.
public class NpComplianceDashboardDto
{
    public int ExpiringCount { get; set; }
}

public class NpComplianceDashboardResponse : BaseResponse
{
    public NpComplianceDashboardResponse(Guid messageId) : base(messageId) { }
    public NpComplianceDashboardDto Dashboard { get; set; } = new();
}
