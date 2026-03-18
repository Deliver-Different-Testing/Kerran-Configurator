using System;
using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Automation;

public class AutomationRuleDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public string ConditionMatchMode { get; set; } = "all";
    public AutomationScopeDto Scope { get; set; } = new();
    public List<AutomationConditionDto> Conditions { get; set; } = new();
    public List<AutomationActionDto> Actions { get; set; } = new();
    public DateTime CreatedDate { get; set; }
    public DateTime? ModifiedDate { get; set; }
}

public class AutomationScopeDto
{
    public bool AllCustomers { get; set; } = true;
    public List<int> CustomerIds { get; set; } = new();
    public bool AllSpeeds { get; set; } = true;
    public List<int> SpeedIds { get; set; } = new();

    // Advanced scope filters — moved from condition level
    public bool AllJobStatuses { get; set; }
    public List<int> JobStatusIds { get; set; } = new();
    public bool AllPriorities { get; set; }
    public List<int> PriorityIds { get; set; } = new();
    public bool AllFromSites { get; set; }
    public List<int> FromSiteIds { get; set; } = new();
    public bool AllToSites { get; set; }
    public List<int> ToSiteIds { get; set; } = new();
    public bool AllFromRegions { get; set; }
    public List<int> FromRegionIds { get; set; } = new();
    public bool AllToRegions { get; set; }
    public List<int> ToRegionIds { get; set; } = new();
    public int? TimeThreshold { get; set; }
}

public class AutomationConditionDto
{
    public int? Id { get; set; }
    public string ConditionType { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string JobTypeFilter { get; set; } = "all";
    public string? StatusConditionMode { get; set; }
    public int? StatusId { get; set; }
    public string? ScheduledTimeField { get; set; }
    public int? OffsetValue { get; set; }
    public string? OffsetUnit { get; set; }
    public List<string>? ScanTypes { get; set; }
}

public class AutomationActionDto
{
    public int? Id { get; set; }
    public string ActionType { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public int? ToStatusId { get; set; }
    public int? FromStatusId { get; set; }
    public int? TaskTemplateId { get; set; }
    public int? TaskAssigneeId { get; set; }
    public int? TaskAssigneeGroupId { get; set; }
    public int? TaskDueOffsetMinutes { get; set; }
    public int? NotificationTemplateId { get; set; }
    public string? SmsRecipientType { get; set; }
    public string? SmsFixedNumber { get; set; }
    public string? SmsMessageContent { get; set; }
}

public class AutomationExecutionLogDto
{
    public int Id { get; set; }
    public int RuleId { get; set; }
    public string RuleName { get; set; } = string.Empty;
    public int? JobId { get; set; }
    public DateTime EvaluatedAt { get; set; }
    public bool ConditionsMet { get; set; }
    public string TriggerType { get; set; } = string.Empty;
    public string? TriggerDetail { get; set; }
    public int ActionsExecuted { get; set; }
    public string? ActionsSummary { get; set; }
    public string? ErrorMessage { get; set; }
    public int DurationMs { get; set; }
    public List<ActionExecutionDetailDto> ActionDetails { get; set; } = new();
}

public class ActionExecutionDetailDto
{
    public long Id { get; set; }
    public string ActionType { get; set; } = string.Empty;
    public bool Success { get; set; }
    public string? Detail { get; set; }
    public string? ErrorMessage { get; set; }
    public int DurationMs { get; set; }
}

public class AutomationEvent
{
    public string TriggerType { get; set; } = string.Empty;
    public int? JobId { get; set; }
    public int? CustomerId { get; set; }
    public int? SpeedId { get; set; }
    public int? NewStatusId { get; set; }
    public int? OldStatusId { get; set; }
    public string? ScanType { get; set; }
    public string? TriggerDetail { get; set; }
}

public class CreateAutomationRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ConditionMatchMode { get; set; } = "all";
    public AutomationScopeDto Scope { get; set; } = new();
    public List<AutomationConditionDto> Conditions { get; set; } = new();
    public List<AutomationActionDto> Actions { get; set; } = new();
}

public class UpdateAutomationRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public string ConditionMatchMode { get; set; } = "all";
    public AutomationScopeDto Scope { get; set; } = new();
    public List<AutomationConditionDto> Conditions { get; set; } = new();
    public List<AutomationActionDto> Actions { get; set; } = new();
}
