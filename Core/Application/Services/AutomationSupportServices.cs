using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Interfaces;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services;

/// <summary>
/// Reads automation-specific AppConfig entries (shadow mode, timer intervals, etc.)
/// </summary>
public class AutomationAppConfigService(IDbContextFactory<DynamicDespatchDbContext> contextFactory)
    : BaseService(contextFactory), IAutomationAppConfigService
{
    public async Task<string?> GetValueAsync(string key, CancellationToken ct = default)
    {
        var config = await Context.AppConfigs.FirstOrDefaultAsync(c => c.ConfigKey == key, ct);
        return config?.ConfigValue;
    }

    public async Task<bool> GetBoolAsync(string key, bool defaultValue = false, CancellationToken ct = default)
    {
        var value = await GetValueAsync(key, ct);
        return value is not null ? bool.TryParse(value, out var result) && result : defaultValue;
    }

    public async Task<int> GetIntAsync(string key, int defaultValue = 0, CancellationToken ct = default)
    {
        var value = await GetValueAsync(key, ct);
        return value is not null && int.TryParse(value, out var result) ? result : defaultValue;
    }
}

/// <summary>
/// SMS sending via the existing TMS tucManualMessage queue.
/// </summary>
public class AutomationSmsService(IDbContextFactory<DynamicDespatchDbContext> contextFactory)
    : BaseService(contextFactory), ISmsService
{
    public async Task SendSmsAsync(string phoneNumber, string message, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber))
        {
            Log.Warning("Cannot send SMS: phone number is empty");
            return;
        }

        await Context.Database.ExecuteSqlInterpolatedAsync(
            $@"INSERT INTO tucManualMessage (ucmmMobile, ucmmMessage, ucmmType, ucmmStatus, ucmmDate, ucmmCreatedBy)
               VALUES ({phoneNumber}, {message}, 'SMS', 1, GETUTCDATE(), 0)", ct);

        Log.Information("SMS queued to {Phone} via tucManualMessage", phoneNumber);
    }
}

/// <summary>
/// Creates events/notifications in tucEvent.
/// </summary>
public class AutomationEventService(IDbContextFactory<DynamicDespatchDbContext> contextFactory)
    : BaseService(contextFactory), IEventService
{
    public async Task CreateEventAsync(int jobId, int eventTemplateId, string? detail = null, CancellationToken ct = default)
    {
        await Context.Database.ExecuteSqlInterpolatedAsync(
            $@"INSERT INTO tucEvent (ucevJobID, ucevType, ucevNotes, ucevDate, ucevCreatedBy)
               VALUES ({jobId}, {eventTemplateId}, {detail}, GETUTCDATE(), 0)", ct);

        Log.Information("Event created for job {JobId} eventTypeId {EventTypeId}", jobId, eventTemplateId);
    }
}

/// <summary>
/// Creates and completes tasks via tucEvent rows.
/// </summary>
public class AutomationTaskService(IDbContextFactory<DynamicDespatchDbContext> contextFactory)
    : BaseService(contextFactory), ITaskService
{
    public async Task CreateTaskAsync(int jobId, int taskTemplateId, int? assigneeId, int? assigneeGroupId, int? dueOffsetMinutes, CancellationToken ct = default)
    {
        var dueDate = dueOffsetMinutes.HasValue
            ? $"DATEADD(MINUTE, {dueOffsetMinutes.Value}, GETUTCDATE())"
            : "NULL";

        // Prevent duplicate open tasks
        var sql = $@"
            IF NOT EXISTS (
                SELECT 1 FROM tucEvent
                WHERE ucevJobID = @p0 AND ucevType = @p1 AND ucevCompletedDate IS NULL
            )
            BEGIN
                INSERT INTO tucEvent (ucevJobID, ucevType, ucevAssigneeID, ucevDueDate, ucevNotes, ucevDate, ucevCreatedBy)
                VALUES (
                    @p0, @p1,
                    {(assigneeId.HasValue ? assigneeId.Value.ToString() : "NULL")},
                    {dueDate},
                    'Created by Automation Engine',
                    GETUTCDATE(), 0
                )
            END";

        await Context.Database.ExecuteSqlRawAsync(sql, new object[] { jobId, taskTemplateId }, ct);
        Log.Information("Task event created for job {JobId} eventTypeId {EventTypeId}", jobId, taskTemplateId);
    }

    public async Task CompleteTaskAsync(int jobId, int taskTemplateId, CancellationToken ct = default)
    {
        var rows = await Context.Database.ExecuteSqlRawAsync(
            @"UPDATE tucEvent SET ucevCompletedDate = GETUTCDATE()
              WHERE ucevJobID = @p0 AND ucevType = @p1 AND ucevCompletedDate IS NULL",
            new object[] { jobId, taskTemplateId }, ct);

        Log.Information("Task completed for job {JobId} eventTypeId {EventTypeId} ({Rows} rows)", jobId, taskTemplateId, rows);
    }
}

/// <summary>
/// Resolves placeholders like {JobNumber}, {ClientName} in templates.
/// </summary>
public class AutomationPlaceholderResolver(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IConfiguration config)
    : BaseService(contextFactory), IPlaceholderResolver
{
    public async Task<string> ResolveAsync(string template, int jobId, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(template) || !template.Contains('{'))
            return template;

        var values = await GetPlaceholderValuesAsync(jobId, ct);
        var result = template;

        foreach (var kvp in values)
            result = result.Replace($"{{{kvp.Key}}}", kvp.Value ?? string.Empty, StringComparison.OrdinalIgnoreCase);

        return result;
    }

    public async Task<Dictionary<string, string>> GetPlaceholderValuesAsync(int jobId, CancellationToken ct = default)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var sql = @"
            SELECT
                j.ucjbConsignment AS JobNumber,
                c.ucclName AS ClientName,
                c.ucclCode AS ClientShortName,
                js.ucjsName AS StatusName,
                j.ucjbDate AS CreatedDate,
                j.ucjbRef1 AS Reference1,
                j.ucjbRef2 AS Reference2
            FROM tucJob j
            LEFT JOIN tucClient c ON j.ucjbClientID = c.ucclID
            LEFT JOIN tucJobStatus js ON j.ucjbStatus = js.ucjsID
            WHERE j.ucjbID = @p0";

        try
        {
            await using var command = Context.Database.GetDbConnection().CreateCommand();
            command.CommandText = sql;
            var param = command.CreateParameter();
            param.ParameterName = "@p0";
            param.Value = jobId;
            command.Parameters.Add(param);

            await Context.Database.OpenConnectionAsync(ct);
            await using var reader = await command.ExecuteReaderAsync(ct);

            if (await reader.ReadAsync(ct))
            {
                for (var i = 0; i < reader.FieldCount; i++)
                {
                    var name = reader.GetName(i);
                    var value = reader.IsDBNull(i) ? string.Empty : reader.GetValue(i)?.ToString() ?? string.Empty;
                    values[name] = value;
                }
            }

            var portalBaseUrl = config.GetValue<string>("AgentPortalBaseUrl") ?? "https://portal.dfrnt.com";
            values["PortalLink"] = $"{portalBaseUrl}/jobs/{jobId}";
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Failed to resolve placeholders for job {JobId}", jobId);
        }
        finally
        {
            await Context.Database.CloseConnectionAsync();
        }

        return values;
    }
}
