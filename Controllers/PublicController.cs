using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DfrntDriveConfigurator.Controllers;

// Anonymous SPA entry point for the public-link external-carrier flow
// (slice 2b). HomeController is [Authorize]'d at the class level, so
// unauthenticated requests there get redirected to Hub login — that's
// fine for the rest of the app but breaks the prospect-agent flow where
// the carrier has no Hub account at all.
//
// This controller serves the same Razor Index view with a null bootstrap.
// The SPA's AuthContext.readBootstrap returns ANONYMOUS when
// window.__APP_USER__ is null, and App.tsx detects /p/* paths and
// short-circuits to the public route tree before any role-based
// rendering kicks in.
//
// API calls from this anonymous SPA hit /api/public/quotes/* — those have
// their own [AllowAnonymous] controller (PublicQuotesController). The
// public route tree never lets the carrier reach authenticated routes
// even by navigation.
[AllowAnonymous]
public class PublicController : Controller
{
    [Route("p/{*path}")]
    public IActionResult Index()
    {
        // Absolute path — Razor's default lookup would search /Views/Public/
        // which doesn't exist. We deliberately reuse the same Index view
        // that HomeController serves to authenticated users.
        return View("~/Views/Home/Index.cshtml", (AppUserBootstrap?)null);
    }
}
