using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Domain.Despatch;

namespace DfrntDriveConfigurator.Core.Application.Interfaces;

public interface IAutomationRepository
{
    Task<List<AutomationRule>> GetActiveRulesAsync(CancellationToken ct = default);
    Task<List<AutomationRule>> GetTimeBasedRulesAsync(CancellationToken ct = default);
    Task<AutomationRule?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<List<AutomationRule>> GetAllAsync(int? customerId, int? speedId, string? search, bool? isActive, CancellationToken ct = default);
    Task<AutomationRule> CreateAsync(AutomationRule rule, CancellationToken ct = default);
    Task UpdateAsync(AutomationRule rule, CancellationToken ct = default);
    Task SoftDeleteAsync(int id, CancellationToken ct = default);
    Task ToggleActiveAsync(int id, CancellationToken ct = default);
    Task<AutomationExecutionLog> LogExecutionAsync(AutomationExecutionLog log, CancellationToken ct = default);
    Task<bool> HasBeenEvaluatedRecentlyAsync(int ruleId, int jobId, int windowMinutes, CancellationToken ct = default);
    Task<List<AutomationExecutionLog>> GetLogsAsync(int? ruleId, int? jobId, DateTime? from, DateTime? to, string? triggerType, bool? conditionsMet, int skip, int take, CancellationToken ct = default);
    Task<AutomationExecutionLog?> GetLogByIdAsync(int id, CancellationToken ct = default);
}
