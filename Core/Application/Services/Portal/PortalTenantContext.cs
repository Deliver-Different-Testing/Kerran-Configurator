using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Infrastructure;

namespace DfrntDriveConfigurator.Core.Application.Services.Portal;

// Courier Portal Phase 1 — resolves the portal deployment's own tenant.
//
// Anonymous /api/portal/* requests have no Hub cookie, so they cannot get the
// tenant DB connection the normal way (HomeController seeds it from the
// Hub-supplied `Connection` claim at login). Instead the portal is deployed
// one-per-tenant and reads its tenant id + connection from AppSettings
// (PortalTenantId / PortalDespatchConnection). This service seeds that
// connection into the same connection-string cache the rest of the app uses,
// keyed identically ("{tenantId}-ClientManager-Connection"), so
// DynamicDespatchDbContextFactory resolves it via the OverrideTenantIdItemsKey
// override the PortalRequestFilter stamps.
public interface IPortalTenantContext
{
    bool IsConfigured { get; }
    string TenantId { get; }

    // Idempotent + cheap on the hot path: only writes to the cache when the
    // entry is missing/expired (the common case is a memory-cache hit).
    Task EnsureConnectionSeededAsync();
}

public class PortalTenantContext(
    AppSettings appSettings,
    IConnectionStringManager connectionStringManager) : IPortalTenantContext
{
    public bool IsConfigured => appSettings.PortalEnabled;
    public string TenantId => appSettings.PortalTenantId;

    public async Task EnsureConnectionSeededAsync()
    {
        if (!IsConfigured) return;

        var cacheKey = $"{appSettings.PortalTenantId}-ClientManager-Connection";

        var existing = await connectionStringManager.GetConnectionStringAsync(cacheKey);
        if (!string.IsNullOrEmpty(existing)) return;

        // Same shape HomeController uses: base connection + shared SQLCredentials.
        var credentials = Environment.GetEnvironmentVariable("SQLCredentials") ?? string.Empty;
        await connectionStringManager.SetConnectionStringAsync(
            cacheKey,
            appSettings.PortalDespatchConnection + credentials);
    }
}
