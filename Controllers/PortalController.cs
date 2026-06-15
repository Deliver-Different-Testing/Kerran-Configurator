using DfrntDriveConfigurator.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DfrntDriveConfigurator.Controllers;

// Courier Portal Phase 1 — anonymous SPA entry points (mirrors PublicController).
//
// HomeController is [Authorize]'d, so it redirects logged-out visitors to Hub
// login — wrong for the applicant flow (applicants have no Hub account) and for
// the courier login screen. This controller serves the same Index view with the
// right bootstrap, never redirecting:
//
//   /apply/*    -> null bootstrap (applicants are always anonymous in Phase 1)
//   /drive/*    -> authenticated courier gets the real bootstrap (App.tsx shows
//                  CourierPortalShell); anonymous gets null (shows CourierLogin)
//
// NOTE: the courier portal lives at /drive/* (matching the "DFRNT Drive" brand),
// NOT /courier/* — the latter is a long-standing STAFF route (/courier/:id ->
// CourierSetup) in the DF Admin / NP / Tenant trees, so reusing it shadowed
// those pages with the courier login.
//
// Both 404 when the portal is not configured for this deployment, so the shared
// multi-tenant configurator is unaffected.
[AllowAnonymous]
public class PortalController(AppSettings appSettings) : Controller
{
    [Route("apply/{*path}")]
    public IActionResult Apply()
    {
        if (!appSettings.PortalEnabled) return NotFound();
        // Absolute view path — Razor's default lookup would search /Views/Portal/.
        return View("~/Views/Home/Index.cshtml", (AppUserBootstrap?)null);
    }

    [Route("drive/{*path}")]
    public IActionResult Drive()
    {
        if (!appSettings.PortalEnabled) return NotFound();

        var bootstrap = User.Identity?.IsAuthenticated == true
            ? BootstrapBuilder.Build(User, appSettings)
            : null;

        return View("~/Views/Home/Index.cshtml", bootstrap);
    }
}
