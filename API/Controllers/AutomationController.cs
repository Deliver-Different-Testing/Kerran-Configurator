using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Automation;
using DfrntDriveConfigurator.Core.Application.Interfaces;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers;

[ApiController]
[Route("api/automations")]
[Authorize(Policy = "AdminOnly")]
public class AutomationController(
    IAutomationRepository repository,
    IAutomationEngineService engineService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<AutomationRuleDto>>> GetAll(
        [FromQuery] int? customerId, [FromQuery] int? speedId,
        [FromQuery] string? search, [FromQuery] bool? isActive, CancellationToken ct)
    {
        Log.Information("GetAll automations: customerId={CustomerId}, speedId={SpeedId}, search={Search}, isActive={IsActive}",
            customerId, speedId, search, isActive);
        var rules = await repository.GetAllAsync(customerId, speedId, search, isActive, ct);
        return Ok(rules.Select(MapToDto));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AutomationRuleDto>> GetById(int id, CancellationToken ct)
    {
        var rule = await repository.GetByIdAsync(id, ct);
        if (rule is null) return NotFound();
        return Ok(MapToDto(rule));
    }

    [HttpPost]
    public async Task<ActionResult<AutomationRuleDto>> Create([FromBody] CreateAutomationRequest request, CancellationToken ct)
    {
        Log.Information("Create automation: {Request}", JsonConvert.SerializeObject(request));

        var rule = new AutomationRule
        {
            Name = request.Name,
            Description = request.Description,
            ConditionMatchMode = request.ConditionMatchMode,
            AllCustomers = request.Scope.AllCustomers,
            CustomerIds = request.Scope.CustomerIds.Any() ? string.Join(",", request.Scope.CustomerIds) : null,
            AllSpeeds = request.Scope.AllSpeeds,
            SpeedIds = request.Scope.SpeedIds.Any() ? string.Join(",", request.Scope.SpeedIds) : null,
            AllJobStatuses = request.Scope.AllJobStatuses,
            JobStatusIds = request.Scope.JobStatusIds.Any() ? string.Join(",", request.Scope.JobStatusIds) : null,
            AllPriorities = request.Scope.AllPriorities,
            PriorityIds = request.Scope.PriorityIds.Any() ? string.Join(",", request.Scope.PriorityIds) : null,
            AllFromSites = request.Scope.AllFromSites,
            FromSiteIds = request.Scope.FromSiteIds.Any() ? string.Join(",", request.Scope.FromSiteIds) : null,
            AllToSites = request.Scope.AllToSites,
            ToSiteIds = request.Scope.ToSiteIds.Any() ? string.Join(",", request.Scope.ToSiteIds) : null,
            AllFromRegions = request.Scope.AllFromRegions,
            FromRegionIds = request.Scope.FromRegionIds.Any() ? string.Join(",", request.Scope.FromRegionIds) : null,
            AllToRegions = request.Scope.AllToRegions,
            ToRegionIds = request.Scope.ToRegionIds.Any() ? string.Join(",", request.Scope.ToRegionIds) : null,
            TimeThreshold = request.Scope.TimeThreshold,
        };

        foreach (var (c, i) in request.Conditions.Select((c, i) => (c, i)))
        {
            rule.AutomationConditions.Add(new AutomationCondition
            {
                ConditionType = c.ConditionType,
                SortOrder = c.SortOrder > 0 ? c.SortOrder : i + 1,
                StatusConditionMode = c.StatusConditionMode,
                StatusId = c.StatusId,
                ScheduledTimeField = c.ScheduledTimeField,
                OffsetValue = c.OffsetValue,
                OffsetUnit = c.OffsetUnit,
                ScanTypes = c.ScanTypes is not null ? string.Join(",", c.ScanTypes) : null
            });
        }

        foreach (var (a, i) in request.Actions.Select((a, i) => (a, i)))
        {
            rule.AutomationActions.Add(new AutomationAction
            {
                ActionType = a.ActionType,
                SortOrder = a.SortOrder > 0 ? a.SortOrder : i + 1,
                ToStatusId = a.ToStatusId,
                FromStatusId = a.FromStatusId,
                TaskTemplateId = a.TaskTemplateId,
                TaskAssigneeId = a.TaskAssigneeId,
                TaskAssigneeGroupId = a.TaskAssigneeGroupId,
                TaskDueOffsetMinutes = a.TaskDueOffsetMinutes,
                NotificationTemplateId = a.NotificationTemplateId,
                SmsRecipientType = a.SmsRecipientType,
                SmsFixedNumber = a.SmsFixedNumber,
                SmsMessageContent = a.SmsMessageContent
            });
        }

        var created = await repository.CreateAsync(rule, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, MapToDto(created));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AutomationRuleDto>> Update(int id, [FromBody] UpdateAutomationRequest request, CancellationToken ct)
    {
        Log.Information("Update automation {Id}: {Request}", id, JsonConvert.SerializeObject(request));

        var rule = await repository.GetByIdAsync(id, ct);
        if (rule is null) return NotFound();

        rule.Name = request.Name;
        rule.Description = request.Description;
        rule.IsActive = request.IsActive;
        rule.ConditionMatchMode = request.ConditionMatchMode;
        rule.AllCustomers = request.Scope.AllCustomers;
        rule.CustomerIds = request.Scope.CustomerIds.Any() ? string.Join(",", request.Scope.CustomerIds) : null;
        rule.AllSpeeds = request.Scope.AllSpeeds;
        rule.SpeedIds = request.Scope.SpeedIds.Any() ? string.Join(",", request.Scope.SpeedIds) : null;
        rule.AllJobStatuses = request.Scope.AllJobStatuses;
        rule.JobStatusIds = request.Scope.JobStatusIds.Any() ? string.Join(",", request.Scope.JobStatusIds) : null;
        rule.AllPriorities = request.Scope.AllPriorities;
        rule.PriorityIds = request.Scope.PriorityIds.Any() ? string.Join(",", request.Scope.PriorityIds) : null;
        rule.AllFromSites = request.Scope.AllFromSites;
        rule.FromSiteIds = request.Scope.FromSiteIds.Any() ? string.Join(",", request.Scope.FromSiteIds) : null;
        rule.AllToSites = request.Scope.AllToSites;
        rule.ToSiteIds = request.Scope.ToSiteIds.Any() ? string.Join(",", request.Scope.ToSiteIds) : null;
        rule.AllFromRegions = request.Scope.AllFromRegions;
        rule.FromRegionIds = request.Scope.FromRegionIds.Any() ? string.Join(",", request.Scope.FromRegionIds) : null;
        rule.AllToRegions = request.Scope.AllToRegions;
        rule.ToRegionIds = request.Scope.ToRegionIds.Any() ? string.Join(",", request.Scope.ToRegionIds) : null;
        rule.TimeThreshold = request.Scope.TimeThreshold;

        rule.AutomationConditions.Clear();
        foreach (var (c, i) in request.Conditions.Select((c, i) => (c, i)))
        {
            rule.AutomationConditions.Add(new AutomationCondition
            {
                RuleId = id,
                ConditionType = c.ConditionType,
                SortOrder = c.SortOrder > 0 ? c.SortOrder : i + 1,
                StatusConditionMode = c.StatusConditionMode,
                StatusId = c.StatusId,
                ScheduledTimeField = c.ScheduledTimeField,
                OffsetValue = c.OffsetValue,
                OffsetUnit = c.OffsetUnit,
                ScanTypes = c.ScanTypes is not null ? string.Join(",", c.ScanTypes) : null
            });
        }

        rule.AutomationActions.Clear();
        foreach (var (a, i) in request.Actions.Select((a, i) => (a, i)))
        {
            rule.AutomationActions.Add(new AutomationAction
            {
                RuleId = id,
                ActionType = a.ActionType,
                SortOrder = a.SortOrder > 0 ? a.SortOrder : i + 1,
                ToStatusId = a.ToStatusId,
                FromStatusId = a.FromStatusId,
                TaskTemplateId = a.TaskTemplateId,
                TaskAssigneeId = a.TaskAssigneeId,
                TaskAssigneeGroupId = a.TaskAssigneeGroupId,
                TaskDueOffsetMinutes = a.TaskDueOffsetMinutes,
                NotificationTemplateId = a.NotificationTemplateId,
                SmsRecipientType = a.SmsRecipientType,
                SmsFixedNumber = a.SmsFixedNumber,
                SmsMessageContent = a.SmsMessageContent
            });
        }

        await repository.UpdateAsync(rule, ct);
        return Ok(MapToDto(rule));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await repository.SoftDeleteAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:int}/toggle")]
    public async Task<IActionResult> Toggle(int id, CancellationToken ct)
    {
        await repository.ToggleActiveAsync(id, ct);
        return Ok();
    }

    [HttpPost("{id:int}/test")]
    public async Task<ActionResult<AutomationExecutionLogDto>> Test(int id, [FromQuery] int jobId, CancellationToken ct)
    {
        var result = await engineService.TestRuleAsync(id, jobId, ct);
        return Ok(result);
    }

    [HttpPost("evaluate")]
    public async Task<IActionResult> Evaluate([FromBody] AutomationEvent automationEvent, CancellationToken ct)
    {
        await engineService.EvaluateEventAsync(automationEvent, ct);
        return Accepted();
    }

    private static AutomationRuleDto MapToDto(AutomationRule rule) => new()
    {
        Id = rule.Id,
        Name = rule.Name,
        Description = rule.Description,
        IsActive = rule.IsActive,
        ConditionMatchMode = rule.ConditionMatchMode?.ToLower() ?? "all",
        Scope = new AutomationScopeDto
        {
            AllCustomers = rule.AllCustomers,
            CustomerIds = ParseIntList(rule.CustomerIds),
            AllSpeeds = rule.AllSpeeds,
            SpeedIds = ParseIntList(rule.SpeedIds),
            AllJobStatuses = rule.AllJobStatuses,
            JobStatusIds = ParseIntList(rule.JobStatusIds),
            AllPriorities = rule.AllPriorities,
            PriorityIds = ParseIntList(rule.PriorityIds),
            AllFromSites = rule.AllFromSites,
            FromSiteIds = ParseIntList(rule.FromSiteIds),
            AllToSites = rule.AllToSites,
            ToSiteIds = ParseIntList(rule.ToSiteIds),
            AllFromRegions = rule.AllFromRegions,
            FromRegionIds = ParseIntList(rule.FromRegionIds),
            AllToRegions = rule.AllToRegions,
            ToRegionIds = ParseIntList(rule.ToRegionIds),
            TimeThreshold = rule.TimeThreshold
        },
        Conditions = rule.AutomationConditions.Select(c => new AutomationConditionDto
        {
            Id = c.Id,
            ConditionType = c.ConditionType,
            SortOrder = c.SortOrder ?? 0,
            StatusConditionMode = c.StatusConditionMode,
            StatusId = c.StatusId,
            ScheduledTimeField = c.ScheduledTimeField,
            OffsetValue = c.OffsetValue,
            OffsetUnit = c.OffsetUnit,
            ScanTypes = c.ScanTypes?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList()
        }).ToList(),
        Actions = rule.AutomationActions.Select(a => new AutomationActionDto
        {
            Id = a.Id,
            ActionType = a.ActionType,
            SortOrder = a.SortOrder ?? 0,
            ToStatusId = a.ToStatusId,
            FromStatusId = a.FromStatusId,
            TaskTemplateId = a.TaskTemplateId,
            TaskAssigneeId = a.TaskAssigneeId,
            TaskAssigneeGroupId = a.TaskAssigneeGroupId,
            TaskDueOffsetMinutes = a.TaskDueOffsetMinutes,
            NotificationTemplateId = a.NotificationTemplateId,
            SmsRecipientType = a.SmsRecipientType,
            SmsFixedNumber = a.SmsFixedNumber,
            SmsMessageContent = a.SmsMessageContent
        }).ToList(),
        CreatedDate = rule.CreatedDate,
        ModifiedDate = rule.ModifiedDate
    };

    private static List<int> ParseIntList(string? csv) =>
        string.IsNullOrWhiteSpace(csv)
            ? new List<int>()
            : csv.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Where(s => int.TryParse(s, out _))
                .Select(int.Parse)
                .ToList();
}
