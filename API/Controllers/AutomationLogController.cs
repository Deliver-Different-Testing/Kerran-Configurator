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

namespace DfrntDriveConfigurator.Api.Controllers;

[ApiController]
[Route("api/automations")]
[Authorize(Policy = "AdminOnly")]
public class AutomationLogController(IAutomationRepository repository) : ControllerBase
{
    [HttpGet("logs")]
    public async Task<ActionResult<List<AutomationExecutionLogDto>>> GetLogs(
        [FromQuery] int? ruleId, [FromQuery] int? jobId,
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] string? triggerType, [FromQuery] bool? conditionsMet,
        [FromQuery] int skip = 0, [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var logs = await repository.GetLogsAsync(ruleId, jobId, from, to, triggerType, conditionsMet, skip, take, ct);
        return Ok(logs.Select(MapToDto));
    }

    [HttpGet("logs/{id:int}")]
    public async Task<ActionResult<AutomationExecutionLogDto>> GetLogById(int id, CancellationToken ct)
    {
        var log = await repository.GetLogByIdAsync(id, ct);
        if (log is null) return NotFound();
        return Ok(MapToDto(log));
    }

    [HttpGet("{ruleId:int}/logs")]
    public async Task<ActionResult<List<AutomationExecutionLogDto>>> GetLogsByRule(
        int ruleId, [FromQuery] int skip = 0, [FromQuery] int take = 50, CancellationToken ct = default)
    {
        var logs = await repository.GetLogsAsync(ruleId, null, null, null, null, null, skip, take, ct);
        return Ok(logs.Select(MapToDto));
    }

    private static AutomationExecutionLogDto MapToDto(AutomationExecutionLog log) => new()
    {
        Id = log.Id,
        RuleId = log.RuleId,
        RuleName = log.RuleName,
        JobId = log.JobId,
        EvaluatedAt = log.ExecutedDate,
        ConditionsMet = log.ConditionsMet,
        TriggerType = log.TriggerType,
        TriggerDetail = log.TriggerDetail,
        ActionsExecuted = log.ActionsExecuted,
        ActionsSummary = log.ActionsSummary,
        ErrorMessage = log.ErrorMessage,
        DurationMs = log.DurationMs,
        ActionDetails = log.ActionExecutionDetails.Select(d => new ActionExecutionDetailDto
        {
            Id = d.Id,
            ActionType = d.ActionType,
            Success = d.Success,
            Detail = d.Detail,
            ErrorMessage = d.ErrorMessage,
            DurationMs = d.DurationMs
        }).ToList()
    };
}
