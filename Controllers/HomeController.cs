using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using DfrntDriveConfigurator.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Controllers;

public record AppUserBootstrap(
    bool IsAdmin,
    bool IsCourier,
    bool IsNetworkPartner,
    bool Internal,
    int? CurrentTenantId,
    int? StaffId,
    string? FullName,
    string? Email,
    string? TenantCode,
    // Phase 5+28b §B.2 — raw tucClientContact.ContactRoleId (1=NpAdmin,
    // 2=NpDispatcher, 3=NpReadOnly). Null for non-NP users or NP users
    // whose contact row has no role set. Frontend maps the ID to a
    // friendly role name + uses it to gate UI surfaces.
    int? NpRoleId,
    // Per-tenant DespatchWeb base URL (from the DespatchWebBaseUrl env var).
    // Lets the Recurring Routes page deep-link to DespatchWeb's Recurring
    // Jobs view. Empty/null hides the link.
    string? DespatchWebBaseUrl,
    // Per-tenant RunViewer base URL (from the RunViewerBaseUrl env var). Lets
    // the Operations page deep-link to RunViewer (Route Viewer + Print
    // Manager). Empty/null leaves those links disabled.
    string? RunViewerBaseUrl);

[Authorize]
public class HomeController(
    IConnectionStringManager connectionStringManager,
    IDbContextFactory<DespatchContext> contextFactory,
    AppSettings appSettings) : Controller
{
    public async Task<IActionResult> Index()
    {
        try
        {
            // SPA fallback runs HomeController.Index for any unmatched route so React Router
            // can resolve deep links. But /api/* paths reaching this point are unmatched API
            // calls — return 404 so axios consumers see a real failure instead of HTML.
            if (HttpContext.Request.Path.StartsWithSegments("/api"))
            {
                return NotFound();
            }

            // Check if claims already enriched (e.g. page refresh) — skip re-querying
            var existingGroupClaim = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "UserGroupID")?.Value;
            var existingClientTypeClaim = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "ClientTypeId")?.Value;
            // Re-enrich if EITHER claim is missing. The ClientTypeId condition
            // means sessions that predate the DF-admin-by-ClientType change get
            // the new claim on their next page load (rather than being stuck on
            // the old UserGroupID-only cookie).
            if (!string.IsNullOrEmpty(existingGroupClaim) && !string.IsNullOrEmpty(existingClientTypeClaim))
            {
                Log.Debug("UserGroupID + ClientTypeId claims already present ({GroupId}/{ClientType}), skipping enrichment", existingGroupClaim, existingClientTypeClaim);
                // Still need to ensure connection string is cached
                await EnsureConnectionString();
                return View(BuildBootstrap(HttpContext.User, appSettings));
            }

            var connectionString = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
            var tenantId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
            var staffIdClaim = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "StaffID")?.Value;

            Log.Information("HomeController.Index - TenantId: {TenantId}, StaffID: {StaffId}, HasConnection: {HasConnection}",
                tenantId ?? "null", staffIdClaim ?? "null", !string.IsNullOrEmpty(connectionString));

            if (string.IsNullOrEmpty(connectionString) || string.IsNullOrEmpty(tenantId))
            {
                Log.Error("Connection string or tenant ID is missing. Redirecting to login.");
                return Redirect(Environment.GetEnvironmentVariable("PublicPath") ?? "https://deliverdifferent.com/");
            }

            var credentials = Environment.GetEnvironmentVariable("SQLCredentials");
            if (string.IsNullOrEmpty(credentials))
            {
                throw new InvalidOperationException(
                    "Could not find a environment variable string named 'SQLCredentials'.");
            }

            await connectionStringManager.SetConnectionStringAsync(
                $"{tenantId}-ClientManager-Connection",
                connectionString + credentials);

            // Query user details and add extra claims (matching AdminManager pattern)
            ClaimsPrincipal principalForBootstrap = HttpContext.User;
            if (!string.IsNullOrEmpty(staffIdClaim) && int.TryParse(staffIdClaim, out var staffId))
            {
                Log.Debug("Querying tblUser for StaffID {StaffId}", staffId);
                await using var context = await contextFactory.CreateDbContextAsync();
                var user = await context.TblUsers.FirstOrDefaultAsync(u => u.StaffId == staffId);

                if (user is { Active: true, InternetAccess: true })
                {
                    Log.Information("User found: {UserName}, UserGroupID: {GroupId}", user.UserName, user.UserGroupId);

                    var existingClaims = HttpContext.User.Claims.ToList();

                    // UserGroupID is configurator-only enrichment — Hub never
                    // emits it — so we always have to query tblUser for it.
                    var newClaims = new List<Claim>
                    {
                        new("UserGroupID", user.UserGroupId.ToString()),
                        new("name", user.UserName),
                        new("fullName", user.FullName),
                        new("staffID", user.StaffId.ToString() ?? string.Empty),
                        new("active", user.Active.ToString())
                    };

                    // ClientType signal for the DF-admin lane + matrix bypasses.
                    // ClientTypeId == 5 (DFRNTAdmin) is the SOLE DF-admin signal —
                    // a tenant Administrator (UserGroupID=1, ClientTypeId=4) keeps
                    // full AdminManager rights but lands in the Tenant lane here.
                    //
                    // Claim-first: Hub stamps ClientTypeId at login (2026-06-03),
                    // so for fresh cookies we carry it through untouched (it's
                    // already in existingClaims). Only for pre-2026-06-03 cookies
                    // — where the claim is absent — do we fall back to the legacy
                    // tucClient lookup. This lookup is transitional and can be
                    // removed once all Hub sessions have refreshed.
                    var hubClientTypeClaim = existingClaims.FirstOrDefault(c => c.Type == "ClientTypeId")?.Value;
                    if (string.IsNullOrEmpty(hubClientTypeClaim))
                    {
                        var clientIdClaim = existingClaims.FirstOrDefault(c => c.Type == "ClientID")?.Value;
                        int? clientTypeId = null;
                        if (int.TryParse(clientIdClaim, out var clientId) && clientId > 0)
                        {
                            clientTypeId = await context.TucClients.AsNoTracking()
                                .Where(c => c.UcclId == clientId)
                                .Select(c => (int?)c.ClientTypeId)
                                .FirstOrDefaultAsync();
                        }

                        newClaims.Add(new("ClientTypeId", clientTypeId?.ToString() ?? string.Empty));
                    }

                    var allClaims = existingClaims.Concat(newClaims).ToList();
                    var newIdentity = new ClaimsIdentity(allClaims, "Identity.Application");
                    var newPrincipal = new ClaimsPrincipal(newIdentity);

                    await HttpContext.SignInAsync(
                        "Identity.Application",
                        newPrincipal,
                        new AuthenticationProperties { IsPersistent = true });

                    // SignInAsync writes the cookie for the *next* request but doesn't mutate
                    // HttpContext.User for this one — use the freshly-built principal so the
                    // bootstrap blob the SPA reads on first paint reflects the enriched claims.
                    principalForBootstrap = newPrincipal;

                    Log.Information("Claims enriched and cookie updated for StaffID {StaffId}", staffId);
                }
                else
                {
                    Log.Warning("User with StaffID {StaffId} not found, inactive, or lacks internet access. User: {User}",
                        staffId, user != null ? $"{user.UserName} Active={user.Active} InternetAccess={user.InternetAccess}" : "null");
                    return Redirect(Environment.GetEnvironmentVariable("PublicPath") ?? "https://deliverdifferent.com/");
                }
            }
            else
            {
                Log.Warning("StaffID claim missing or not a valid integer: '{StaffIdClaim}'", staffIdClaim ?? "null");
            }

            return View(BuildBootstrap(principalForBootstrap, appSettings));
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error in {Controller}/{Action}", nameof(HomeController), nameof(Index));
            return Redirect(Environment.GetEnvironmentVariable("PublicPath") ?? "https://deliverdifferent.com/");
        }
    }

    private static AppUserBootstrap BuildBootstrap(ClaimsPrincipal principal, AppSettings appSettings)
    {
        var claims = principal.Claims.ToList();
        string? Get(string type) => claims.FirstOrDefault(c => c.Type == type)?.Value;

        bool ParseBool(string? v) =>
            !string.IsNullOrEmpty(v) && bool.TryParse(v, out var b) && b;

        int? ParseInt(string? v) =>
            int.TryParse(v, out var i) ? i : null;

        // DF-admin lane is driven by ClientType == 5 (DFRNTAdmin), not the
        // legacy UserGroupID == 1. A tenant Administrator (UserGroupID=1 on a
        // ClientTypeId=4 client) is a Tenant in the configurator while keeping
        // full AdminManager rights. The ClientTypeId claim is set during
        // enrichment in Index() from the user's ClientID.
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

    private async Task EnsureConnectionString()
    {
        var connectionString = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
        var tenantId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
        var credentials = Environment.GetEnvironmentVariable("SQLCredentials") ?? "";

        if (!string.IsNullOrEmpty(connectionString) && !string.IsNullOrEmpty(tenantId) && !string.IsNullOrEmpty(credentials))
        {
            await connectionStringManager.SetConnectionStringAsync(
                $"{tenantId}-ClientManager-Connection",
                connectionString + credentials);
        }
    }
}
