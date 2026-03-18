using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace DfrntDriveConfigurator.Core.Application.Interfaces;

public interface IAutomationAppConfigService
{
    Task<string?> GetValueAsync(string key, CancellationToken ct = default);
    Task<bool> GetBoolAsync(string key, bool defaultValue = false, CancellationToken ct = default);
    Task<int> GetIntAsync(string key, int defaultValue = 0, CancellationToken ct = default);
}

public interface ISmsService
{
    Task SendSmsAsync(string phoneNumber, string message, CancellationToken ct = default);
}

public interface ITaskService
{
    Task CreateTaskAsync(int jobId, int taskTemplateId, int? assigneeId, int? assigneeGroupId, int? dueOffsetMinutes, CancellationToken ct = default);
    Task CompleteTaskAsync(int jobId, int taskTemplateId, CancellationToken ct = default);
}

public interface IEventService
{
    Task CreateEventAsync(int jobId, int eventTemplateId, string? detail = null, CancellationToken ct = default);
}

public interface IPlaceholderResolver
{
    Task<string> ResolveAsync(string template, int jobId, CancellationToken ct = default);
    Task<Dictionary<string, string>> GetPlaceholderValuesAsync(int jobId, CancellationToken ct = default);
}
