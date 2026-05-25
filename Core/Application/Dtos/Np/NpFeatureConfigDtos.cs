using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Per-NP feature toggles. Backed by the NpFeatureConfig table; resolved at
// request-time by INpFeatureResolver. Only the gate booleans surface through
// this DTO — notification settings (NotificationEmail / NotifyOnNewJob /
// NotifyOnJobUpdate / NotifyDigestFreq) and capacity limits (MaxCouriers /
// MaxUsersPerRole / CoverageAreasJson) are managed elsewhere.
public class NpFeatureConfigDto
{
    public int AgentId { get; set; }
    public string AgentName { get; set; } = string.Empty;
    public bool HasConfigRow { get; set; }      // false → values shown are schema defaults
    public bool CanCreateTasks { get; set; }
    public bool CanAddStops { get; set; }
    public bool CanSeeFlightInfo { get; set; }
    public bool CanAccessScheduler { get; set; }
    public bool CanManageApplicants { get; set; }
    public bool MultiClientEnabled { get; set; }
    public bool AutoDispatchEnabled { get; set; }
    public DateTime? UpdatedDate { get; set; }
}

// Only the gate booleans are settable via the admin UI. AgentId is in the URL,
// not the body. A missing row is upserted on first PUT.
public class NpFeatureConfigUpsertDto
{
    public bool CanCreateTasks { get; set; }
    public bool CanAddStops { get; set; }
    public bool CanSeeFlightInfo { get; set; }
    public bool CanAccessScheduler { get; set; }
    public bool CanManageApplicants { get; set; }
    public bool MultiClientEnabled { get; set; }
    public bool AutoDispatchEnabled { get; set; }
}

public class NpFeatureConfigsResponse : BaseResponse
{
    public NpFeatureConfigsResponse(Guid messageId) : base(messageId) { }
    public List<NpFeatureConfigDto> Configs { get; set; } = new();
}

public class NpFeatureConfigResponse : BaseResponse
{
    public NpFeatureConfigResponse(Guid messageId) : base(messageId) { }
    public NpFeatureConfigDto? Config { get; set; }
}
