using System.Security.Claims;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Phase 5+28b §B.2 — Network Partner role enum + resolver.
//
// Hub emits the raw `tucClientContact.ContactRoleId` as the `NpRoleId`
// cookie claim (commit 034c381 on Hub feat/np-admin-user-create branch,
// merged 2026-05-25). Configurator maps the integer to a friendly enum
// here so policy code + UI gates can talk in role names rather than
// magic numbers.
//
// The seeded IDs come from `20260513123935_NPMarketplaceAndQuotes.sql`
// lines 319/328/337 of dbmigrationsv2 — they're stable across tenants
// because the migration runs everywhere with explicit IDs. If ops
// ever adds custom NP roles via a follow-on slice, the mapping table
// below will need refreshing; for now Unknown is the safe fall-through.
public enum NpRole
{
    Unknown      = 0,   // claim absent or unrecognised
    NpAdmin      = 1,   // full portal access — finance, users, settings
    NpDispatcher = 2,   // operations + fleet, no finance / users / settings
    NpReadOnly   = 3,   // view-only across the portal
}

public static class NpRoleClaim
{
    /// <summary>The cookie-claim name Hub emits (see Hub AccountController GenerateClaims).</summary>
    public const string ClaimType = "NpRoleId";

    public static NpRole Parse(string? rawValue)
    {
        if (!int.TryParse(rawValue, out var id)) return NpRole.Unknown;
        return id switch
        {
            (int)NpRole.NpAdmin      => NpRole.NpAdmin,
            (int)NpRole.NpDispatcher => NpRole.NpDispatcher,
            (int)NpRole.NpReadOnly   => NpRole.NpReadOnly,
            _ => NpRole.Unknown,
        };
    }

    public static NpRole From(ClaimsPrincipal principal) =>
        Parse(principal.FindFirst(ClaimType)?.Value);
}

public interface INpRoleResolver
{
    /// <summary>Resolves the current request's NpRole from the cookie claim.</summary>
    NpRole ResolveCurrent();
}

public class NpRoleResolver(Microsoft.AspNetCore.Http.IHttpContextAccessor httpContextAccessor) : INpRoleResolver
{
    public NpRole ResolveCurrent()
    {
        var user = httpContextAccessor.HttpContext?.User;
        return user is null ? NpRole.Unknown : NpRoleClaim.From(user);
    }
}
