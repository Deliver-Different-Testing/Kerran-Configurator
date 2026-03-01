using System;
using System.Linq;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Serilog;

namespace DfrntDriveConfigurator.Infrastructure;

public class DynamicDespatchDbContextFactory(
    IOptions<DbContextOptions<DespatchContext>> options,
    IConnectionStringManager connectionStringManager,
    IHttpContextAccessor contextAccessor)
    : IDbContextFactory<DespatchContext>
{
    private readonly DbContextOptions<DespatchContext> _options = options.Value;

    public DespatchContext CreateDbContext()
    {
        var httpContext = contextAccessor.HttpContext;
        var isAuthenticated = httpContext?.User.Identity?.IsAuthenticated ?? false;
        var tenantId = httpContext?.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
        var cacheKey = $"{tenantId}-ClientManager-Connection";

        // Diagnostic logging for troubleshooting authentication issues
        if (httpContext == null)
        {
            Log.Warning("CreateDbContext called without HttpContext - no authentication context available");
        }
        else if (!isAuthenticated)
        {
            Log.Warning("CreateDbContext called with unauthenticated request. Path: {Path}",
                httpContext.Request.Path);
        }
        else if (string.IsNullOrEmpty(tenantId))
        {
            Log.Warning("CreateDbContext called with authenticated user but missing CurrentTenantID claim. Path: {Path}, User: {User}",
                httpContext.Request.Path,
                httpContext.User.Identity?.Name ?? "unknown");
        }

        var connectionString = connectionStringManager.GetConnectionStringAsync(cacheKey).GetAwaiter().GetResult();

        if (string.IsNullOrEmpty(connectionString))
        {
            Log.Error("Connection string is not set. CacheKey: {CacheKey}, IsAuthenticated: {IsAuthenticated}, TenantId: {TenantId}",
                cacheKey, isAuthenticated, tenantId ?? "null");
            throw new InvalidOperationException($"Connection string is not set. TenantId: {tenantId ?? "null"}, IsAuthenticated: {isAuthenticated}");
        }

        var optionsBuilder = new DbContextOptionsBuilder<DespatchContext>(_options);
        optionsBuilder.UseSqlServer(connectionString);

        return new DynamicDespatchDbContext(optionsBuilder.Options);
    }
}

/// <summary>
/// Adapter that wraps IDbContextFactory&lt;DespatchContext&gt; to provide IDbContextFactory&lt;DynamicDespatchDbContext&gt;
/// needed by the BaseService pattern.
/// </summary>
public class DynamicDespatchDbContextFactoryAdapter(IDbContextFactory<DespatchContext> inner)
    : IDbContextFactory<DynamicDespatchDbContext>
{
    public DynamicDespatchDbContext CreateDbContext()
    {
        var context = inner.CreateDbContext();
        if (context is DynamicDespatchDbContext dynamic)
            return dynamic;

        // This shouldn't happen since DynamicDespatchDbContextFactory creates DynamicDespatchDbContext instances
        throw new InvalidOperationException("Expected DynamicDespatchDbContext but got DespatchContext");
    }
}
