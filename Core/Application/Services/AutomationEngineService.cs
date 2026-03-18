using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Automation;
using DfrntDriveConfigurator.Core.Application.Interfaces;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using DfrntDriveConfigurator.Core.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services;

public class AutomationEngineService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IAutomationRepository repository,
    IPlaceholderResolver placeholderResolver,
    ISmsService smsService,
    IEventService eventService,
    ITaskService taskService,
    IAutomationAppConfigService appConfigService)
    : BaseService(contextFactory), IAutomationEngineService
{
    public async Task EvaluateEventAsync(AutomationEvent automationEvent, CancellationToken ct = default)
    {
        var shadowMode = await appConfigService.GetBoolAsync("Automation.DotNetEngine.ShadowMode", false, ct);
        var rules = await repository.GetActiveRulesAsync(ct);

        Log.Information("Evaluating {Count} active rules for event {TriggerType} on job {JobId}",
            rules.Count, automationEvent.TriggerType, automationEvent.JobId);

        foreach (var rule in rules)
        {
            var sw = Stopwatch.StartNew();
            var log = new AutomationExecutionLog
            {
                RuleId = rule.Id,
                RuleName = rule.Name,
                JobId = automationEvent.JobId,
                TriggerType = automationEvent.TriggerType,
                TriggerDetail = automationEvent.TriggerDetail,
                ExecutedDate = DateTime.UtcNow
            };

            try
            {
                if (!IsInScope(rule, automationEvent.CustomerId, automationEvent.SpeedId))
                {
                    log.ConditionsMet = false;
                    sw.Stop();
                    log.DurationMs = (int)sw.ElapsedMilliseconds;
                    await repository.LogExecutionAsync(log, ct);
                    continue;
                }

                var conditionsMet = EvaluateConditions(rule, automationEvent);
                log.ConditionsMet = conditionsMet;

                if (conditionsMet && !shadowMode)
                {
                    var actionResults = await ExecuteActionsAsync(rule, automationEvent, ct);
                    log.ActionsExecuted = actionResults.Count(r => r.Success);
                    log.ActionsSummary = JsonSerializer.Serialize(actionResults.Select(r => new { r.ActionType, r.Success, r.Detail }));
                    foreach (var detail in actionResults)
                        log.ActionExecutionDetails.Add(detail);
                }
                else if (conditionsMet)
                {
                    log.ActionsSummary = "SHADOW_MODE: Actions would have been executed";
                }
            }
            catch (Exception ex)
            {
                log.ErrorMessage = ex.Message;
                Log.Error(ex, "Error evaluating rule {RuleId} for job {JobId}", rule.Id, automationEvent.JobId);
            }
            finally
            {
                sw.Stop();
                log.DurationMs = (int)sw.ElapsedMilliseconds;
                await repository.LogExecutionAsync(log, ct);
            }
        }
    }

    public async Task EvaluateTimeBasedRulesAsync(CancellationToken ct = default)
    {
        var shadowMode = await appConfigService.GetBoolAsync("Automation.DotNetEngine.ShadowMode", false, ct);
        var windowMinutes = await appConfigService.GetIntAsync("Automation.TimeBased.WindowMinutes", 30, ct);
        var rules = await repository.GetTimeBasedRulesAsync(ct);

        Log.Information("Evaluating {Count} time-based rules", rules.Count);

        foreach (var rule in rules)
        {
            try
            {
                var matchingJobIds = await GetJobsMatchingTimeConditionsAsync(rule, ct);

                foreach (var jobId in matchingJobIds)
                {
                    if (await repository.HasBeenEvaluatedRecentlyAsync(rule.Id, jobId, windowMinutes, ct))
                        continue;

                    var sw = Stopwatch.StartNew();
                    var log = new AutomationExecutionLog
                    {
                        RuleId = rule.Id,
                        RuleName = rule.Name,
                        JobId = jobId,
                        TriggerType = TriggerType.TimeBased.ToString(),
                        TriggerDetail = $"Timer evaluation for rule {rule.Name}",
                        ConditionsMet = true,
                        ExecutedDate = DateTime.UtcNow
                    };

                    try
                    {
                        if (!shadowMode)
                        {
                            var evt = new AutomationEvent
                            {
                                TriggerType = TriggerType.TimeBased.ToString(),
                                JobId = jobId
                            };
                            var actionResults = await ExecuteActionsAsync(rule, evt, ct);
                            log.ActionsExecuted = actionResults.Count(r => r.Success);
                            log.ActionsSummary = JsonSerializer.Serialize(actionResults.Select(r => new { r.ActionType, r.Success }));
                            foreach (var detail in actionResults)
                                log.ActionExecutionDetails.Add(detail);
                        }
                        else
                        {
                            log.ActionsSummary = "SHADOW_MODE: Actions would have been executed";
                        }
                    }
                    catch (Exception ex)
                    {
                        log.ErrorMessage = ex.Message;
                        Log.Error(ex, "Error executing time-based rule {RuleId} for job {JobId}", rule.Id, jobId);
                    }
                    finally
                    {
                        sw.Stop();
                        log.DurationMs = (int)sw.ElapsedMilliseconds;
                        await repository.LogExecutionAsync(log, ct);
                    }
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error processing time-based rule {RuleId}", rule.Id);
            }
        }
    }

    public async Task<AutomationExecutionLogDto> TestRuleAsync(int ruleId, int jobId, CancellationToken ct = default)
    {
        var rule = await repository.GetByIdAsync(ruleId, ct)
            ?? throw new InvalidOperationException($"Rule {ruleId} not found");

        var sw = Stopwatch.StartNew();
        var evt = new AutomationEvent
        {
            TriggerType = "DryRun",
            JobId = jobId,
            TriggerDetail = $"Dry-run test of rule {rule.Name}"
        };

        var conditionsMet = EvaluateConditions(rule, evt);
        sw.Stop();

        return new AutomationExecutionLogDto
        {
            RuleId = ruleId,
            RuleName = rule.Name,
            JobId = jobId,
            EvaluatedAt = DateTime.UtcNow,
            ConditionsMet = conditionsMet,
            TriggerType = "DryRun",
            TriggerDetail = evt.TriggerDetail,
            ActionsExecuted = 0,
            ActionsSummary = conditionsMet
                ? $"Would execute {rule.AutomationActions.Count} action(s): {string.Join(", ", rule.AutomationActions.Select(a => a.ActionType))}"
                : "Conditions not met - no actions would execute",
            DurationMs = (int)sw.ElapsedMilliseconds
        };
    }

    private static bool IsInScope(AutomationRule rule, int? customerId, int? speedId)
    {
        if (!rule.AllCustomers && customerId.HasValue)
        {
            var customerIds = ParseIds(rule.CustomerIds);
            if (!customerIds.Contains(customerId.Value)) return false;
        }
        if (!rule.AllSpeeds && speedId.HasValue)
        {
            var speedIds = ParseIds(rule.SpeedIds);
            if (!speedIds.Contains(speedId.Value)) return false;
        }
        return true;
    }

    private static bool EvaluateConditions(AutomationRule rule, AutomationEvent evt)
    {
        if (!rule.AutomationConditions.Any()) return true;

        var results = rule.AutomationConditions.Select(c => EvaluateCondition(c, evt));
        return rule.ConditionMatchMode?.Equals("All", StringComparison.OrdinalIgnoreCase) != false
            ? results.All(r => r)
            : results.Any(r => r);
    }

    private static bool EvaluateCondition(AutomationCondition condition, AutomationEvent evt)
    {
        return condition.ConditionType switch
        {
            "Status" => EvaluateStatusCondition(condition, evt),
            "Scan" => EvaluateScanCondition(condition, evt),
            "JobUnassigned" or "JobAssigned" or "BeforeScheduledTime" or "AfterScheduledTime" or "AtScheduledTime" => true,
            _ => false
        };
    }

    private static bool EvaluateStatusCondition(AutomationCondition condition, AutomationEvent evt)
    {
        return condition.StatusConditionMode switch
        {
            "AnyChange" => evt.NewStatusId != evt.OldStatusId,
            "ChangesTo" => evt.NewStatusId == condition.StatusId,
            "Leaves" => evt.OldStatusId == condition.StatusId,
            "IsNot" => evt.NewStatusId != condition.StatusId,
            _ => false
        };
    }

    private static bool EvaluateScanCondition(AutomationCondition condition, AutomationEvent evt)
    {
        if (string.IsNullOrEmpty(evt.ScanType) || string.IsNullOrEmpty(condition.ScanTypes))
            return false;

        var allowedScans = condition.ScanTypes.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return allowedScans.Contains(evt.ScanType, StringComparer.OrdinalIgnoreCase);
    }

    private async Task<List<ActionExecutionDetail>> ExecuteActionsAsync(AutomationRule rule, AutomationEvent evt, CancellationToken ct)
    {
        var results = new List<ActionExecutionDetail>();

        foreach (var action in rule.AutomationActions.OrderBy(a => a.SortOrder))
        {
            var sw = Stopwatch.StartNew();
            var detail = new ActionExecutionDetail { ActionType = action.ActionType };

            try
            {
                await ExecuteActionAsync(action, evt, ct);
                detail.Success = true;
                detail.Detail = $"Executed {action.ActionType} successfully";
            }
            catch (Exception ex)
            {
                detail.Success = false;
                detail.ErrorMessage = ex.Message;
                Log.Error(ex, "Action {ActionType} failed for rule {RuleId} job {JobId}",
                    action.ActionType, rule.Id, evt.JobId);
            }
            finally
            {
                sw.Stop();
                detail.DurationMs = (int)sw.ElapsedMilliseconds;
                results.Add(detail);
            }
        }

        return results;
    }

    private async Task ExecuteActionAsync(AutomationAction action, AutomationEvent evt, CancellationToken ct)
    {
        switch (action.ActionType)
        {
            case "UpdateJobStatus":
                if (action.ToStatusId.HasValue && evt.JobId.HasValue)
                    await Context.Database.ExecuteSqlInterpolatedAsync(
                        $"UPDATE tucJob SET ucjbStatus = {action.ToStatusId.Value} WHERE ucjbID = {evt.JobId.Value}", ct);
                break;

            case "ChangeStatus":
                if (action.FromStatusId.HasValue && action.ToStatusId.HasValue && evt.JobId.HasValue)
                    await Context.Database.ExecuteSqlInterpolatedAsync(
                        $"UPDATE tucJob SET ucjbStatus = {action.ToStatusId.Value} WHERE ucjbID = {evt.JobId.Value} AND ucjbStatus = {action.FromStatusId.Value}", ct);
                break;

            case "CreateTask":
                if (action.TaskTemplateId.HasValue && evt.JobId.HasValue)
                    await taskService.CreateTaskAsync(evt.JobId.Value, action.TaskTemplateId.Value,
                        action.TaskAssigneeId, action.TaskAssigneeGroupId, action.TaskDueOffsetMinutes, ct);
                break;

            case "CompleteTask":
                if (action.TaskTemplateId.HasValue && evt.JobId.HasValue)
                    await taskService.CompleteTaskAsync(evt.JobId.Value, action.TaskTemplateId.Value, ct);
                break;

            case "TriggerNotification":
                if (action.NotificationTemplateId.HasValue && evt.JobId.HasValue)
                    await eventService.CreateEventAsync(evt.JobId.Value, action.NotificationTemplateId.Value, "Triggered by Automation Engine", ct);
                break;

            case "SendSms":
                if (evt.JobId.HasValue && !string.IsNullOrEmpty(action.SmsMessageContent))
                {
                    var resolvedMessage = await placeholderResolver.ResolveAsync(action.SmsMessageContent, evt.JobId.Value, ct);
                    var phoneNumber = await ResolvePhoneNumberAsync(action, evt.JobId.Value, ct);
                    if (!string.IsNullOrEmpty(phoneNumber))
                        await smsService.SendSmsAsync(phoneNumber, resolvedMessage, ct);
                }
                break;

            default:
                Log.Warning("Unknown action type: {ActionType}", action.ActionType);
                break;
        }
    }

    private async Task<string?> ResolvePhoneNumberAsync(AutomationAction action, int jobId, CancellationToken ct)
    {
        return action.SmsRecipientType switch
        {
            "FixedNumber" => action.SmsFixedNumber,
            "CustomerContact" => await GetPhoneFromSqlAsync(
                "SELECT TOP 1 c.uccoPhone FROM tucJob j INNER JOIN tucContact c ON j.ucjbContactID = c.uccoID WHERE j.ucjbID = @p0", jobId, ct),
            "Driver" => await GetPhoneFromSqlAsync(
                "SELECT TOP 1 cr.uccrMobile FROM tucJob j INNER JOIN tucCourier cr ON j.ucjbCourierID = cr.uccrID WHERE j.ucjbID = @p0", jobId, ct),
            _ => null
        };
    }

    private async Task<string?> GetPhoneFromSqlAsync(string sql, int jobId, CancellationToken ct)
    {
        await using var command = Context.Database.GetDbConnection().CreateCommand();
        command.CommandText = sql;
        var param = command.CreateParameter();
        param.ParameterName = "@p0";
        param.Value = jobId;
        command.Parameters.Add(param);

        await Context.Database.OpenConnectionAsync(ct);
        try
        {
            var result = await command.ExecuteScalarAsync(ct);
            return result?.ToString();
        }
        finally
        {
            await Context.Database.CloseConnectionAsync();
        }
    }

    private async Task<List<int>> GetJobsMatchingTimeConditionsAsync(AutomationRule rule, CancellationToken ct)
    {
        var jobIds = new List<int>();

        foreach (var condition in rule.AutomationConditions)
        {
            var sql = condition.ConditionType switch
            {
                "JobUnassigned" =>
                    $@"SELECT j.ucjbID FROM tucJob j
                       WHERE j.ucjbCourierID IS NULL AND j.ucjbStatus NOT IN (SELECT ucjsID FROM tucJobStatus WHERE ucjsCode IN ('DEL','CAN','POD'))
                       AND DATEDIFF(MINUTE, j.CreatedDate, GETUTCDATE()) >= {condition.OffsetValue ?? 0}",

                "JobAssigned" =>
                    $@"SELECT j.ucjbID FROM tucJob j
                       WHERE j.ucjbCourierID IS NOT NULL AND j.ucjbPickUpActual IS NULL
                       AND j.ucjbStatus NOT IN (SELECT ucjsID FROM tucJobStatus WHERE ucjsCode IN ('DEL','CAN','POD'))
                       AND DATEDIFF(MINUTE, j.ucjbAssignedDate, GETUTCDATE()) >= {condition.OffsetValue ?? 0}",

                "BeforeScheduledTime" => BuildScheduledTimeSql(condition, "<="),
                "AfterScheduledTime" => BuildScheduledTimeSql(condition, ">="),
                "AtScheduledTime" => BuildScheduledTimeSql(condition, "="),
                _ => null
            };

            if (sql is not null)
            {
                if (!rule.AllCustomers && !string.IsNullOrEmpty(rule.CustomerIds))
                    sql += $" AND j.ucjbClientID IN ({rule.CustomerIds})";
                if (!rule.AllSpeeds && !string.IsNullOrEmpty(rule.SpeedIds))
                    sql += $" AND j.ucjbSpeed IN ({rule.SpeedIds})";

                var ids = await Context.Database.SqlQueryRaw<int>(sql).ToListAsync(ct);
                jobIds.AddRange(ids);
            }
        }

        return jobIds.Distinct().ToList();
    }

    private static string BuildScheduledTimeSql(AutomationCondition condition, string op)
    {
        var field = condition.ScheduledTimeField switch
        {
            "Pickup" => "j.ucjbPickUpTime",
            "Delivery" => "j.ucjbDeliveryTime",
            "Flight" => "j.ucjbFlightTime",
            _ => "j.ucjbPickUpTime"
        };

        var offsetMinutes = condition.OffsetValue ?? 0;
        if (string.Equals(condition.OffsetUnit, "hours", StringComparison.OrdinalIgnoreCase))
            offsetMinutes *= 60;

        return op switch
        {
            "<=" => $@"SELECT j.ucjbID FROM tucJob j
                       WHERE {field} IS NOT NULL
                       AND j.ucjbStatus NOT IN (SELECT ucjsID FROM tucJobStatus WHERE ucjsCode IN ('DEL','CAN','POD'))
                       AND DATEDIFF(MINUTE, GETUTCDATE(), {field}) BETWEEN 0 AND {offsetMinutes}",
            ">=" => $@"SELECT j.ucjbID FROM tucJob j
                       WHERE {field} IS NOT NULL
                       AND j.ucjbStatus NOT IN (SELECT ucjsID FROM tucJobStatus WHERE ucjsCode IN ('DEL','CAN','POD'))
                       AND DATEDIFF(MINUTE, {field}, GETUTCDATE()) BETWEEN 0 AND {offsetMinutes}",
            _ => $@"SELECT j.ucjbID FROM tucJob j
                    WHERE {field} IS NOT NULL
                    AND j.ucjbStatus NOT IN (SELECT ucjsID FROM tucJobStatus WHERE ucjsCode IN ('DEL','CAN','POD'))
                    AND ABS(DATEDIFF(MINUTE, {field}, GETUTCDATE())) <= 2"
        };
    }

    private static HashSet<int> ParseIds(string? csv)
    {
        if (string.IsNullOrWhiteSpace(csv)) return new HashSet<int>();
        return csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(s => int.TryParse(s, out _))
            .Select(int.Parse)
            .ToHashSet();
    }
}
