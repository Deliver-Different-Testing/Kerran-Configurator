using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Automation;

namespace DfrntDriveConfigurator.Core.Application.Interfaces;

public interface IAutomationEngineService
{
    Task EvaluateEventAsync(AutomationEvent automationEvent, CancellationToken ct = default);
    Task EvaluateTimeBasedRulesAsync(CancellationToken ct = default);
    Task<AutomationExecutionLogDto> TestRuleAsync(int ruleId, int jobId, CancellationToken ct = default);
}
