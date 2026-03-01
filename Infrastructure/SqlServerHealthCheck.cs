using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Serilog;

namespace DfrntDriveConfigurator.Infrastructure;

public class SqlServerHealthCheck() : IHealthCheck
{
    private readonly string _healthCheckConnectionString =
        Environment.GetEnvironmentVariable("SQLHealthCheckConnection")
        ?? throw new InvalidOperationException("SQLHealthCheckConnection environment variable is not set.");

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var connection = new SqlConnection(_healthCheckConnectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT @@version";
            var version = await command.ExecuteScalarAsync(cancellationToken) as string;

            Log.Information("SQL Server health check succeeded");
            return HealthCheckResult.Healthy($"Successfully connected to SQL Server. Version: {version}");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "SQL Server health check failed");
            return HealthCheckResult.Unhealthy(ex.Message);
        }
    }
}
