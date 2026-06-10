using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Serilog;

namespace DfrntDriveConfigurator.Infrastructure;

// Warms the EF Core model for DynamicDespatchDbContext at app startup.
//
// The Despatch model is large (hundreds of entities), so EF's one-time model
// build can take a second or more — and it's paid lazily on the FIRST query
// against the context after a pod starts, landing on whichever page a user
// hits first ("slow only the first time, then fast"). Building the model here
// moves that cost to startup so no user request pays it.
//
// Accessing context.Model forces model finalisation OFFLINE — it does NOT open
// a database connection (only query execution would), so the dummy connection
// string is never used. The model is cached per context type, so the warmed
// model is reused by every request-time DynamicDespatchDbContext.
public class EfModelWarmupService(IOptions<DbContextOptions<DespatchContext>> baseOptions) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            var options = new DbContextOptionsBuilder<DespatchContext>(baseOptions.Value)
                .UseSqlServer("Server=warmup;Database=warmup;Encrypt=False;TrustServerCertificate=True;")
                .Options;

            using var ctx = new DynamicDespatchDbContext(options);
            _ = ctx.Model; // force the full model build (offline, no connection)

            Log.Information("EF model warmup complete for DynamicDespatchDbContext.");
        }
        catch (Exception ex)
        {
            // Non-fatal: if warmup fails the model simply builds lazily on first
            // use, exactly as before.
            Log.Warning(ex, "EF model warmup failed (non-fatal).");
        }

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
