using System.Linq;
using System.Security.Claims;
using DfrntDriveConfigurator.Infrastructure;

namespace DfrntDriveConfigurator.Controllers;

// Builds the window.__APP_USER__ bootstrap blob the SPA reads on load. Extracted
// from HomeController so the anonymous PortalController (/courier/*) can emit the
// same blob for an authenticated courier without the [Authorize] redirect.
// Reads claims only — no DB access — so it is safe to call from any entry point.
public static class BootstrapBuilder
{
    public static AppUserBootstrap Build(ClaimsPrincipal principal, AppSettings appSettings)
    {
        var claims = principal.Claims.ToList();
        string? Get(string type) => claims.FirstOrDefault(c => c.Type == type)?.Value;

        bool ParseBool(string? v) => !string.IsNullOrEmpty(v) && bool.TryParse(v, out var b) && b;
        int? ParseInt(string? v) => int.TryParse(v, out var i) ? i : null;

        // DF-admin lane is driven by ClientType == 5 (DFRNTAdmin), not the
        // legacy UserGroupID == 1. (Same logic the HomeController used.)
        var isAdmin = Get("ClientTypeId") == "5";

        return new AppUserBootstrap(
            IsAdmin: isAdmin,
            IsCourier: ParseBool(Get("IsCourier")),
            IsNetworkPartner: ParseBool(Get("IsNetworkPartner")),
            Internal: ParseBool(Get("Internal")),
            CurrentTenantId: ParseInt(Get("CurrentTenantID")),
            StaffId: ParseInt(Get("StaffID")),
            FullName: Get("fullName"),
            Email: Get(ClaimTypes.Name),
            TenantCode: Get("TenantCode"),
            NpRoleId: ParseInt(Get("NpRoleId")),
            DespatchWebBaseUrl: string.IsNullOrEmpty(appSettings.DespatchWebBaseUrl) ? null : appSettings.DespatchWebBaseUrl,
            RunViewerBaseUrl: string.IsNullOrEmpty(appSettings.RunViewerBaseUrl) ? null : appSettings.RunViewerBaseUrl);
    }
}
