using System;
using System.Security.Cryptography;

namespace DfrntDriveConfigurator.Core.Application.Services.Portal;

// Courier Portal magic-link (Item 8.5) — token generation + URL helpers.
//
// The magic-link token is an opaque high-entropy string stored on
// tucCourier.PortalAccessToken (migration 049). Unlike the applicant session
// token (PortalSessionTokenService, a self-contained signed token), this one is
// DB-backed so an operator can Revoke (null the column) and Regenerate (replace
// the value, invalidating the old link). Slice 2 will validate it on
// /drive/<token> and mint a courier portal session.
public static class CourierPortalLink
{
    // 90 days — long enough that an operator-issued link stays usable across a
    // courier's onboarding, short enough to bound exposure of a leaked link.
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(90);

    // ~22-char base64url (16 random bytes). URL-safe, no padding — drops into
    // /drive/<slug>/<token> cleanly.
    public static string GenerateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(16);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    public static bool IsExpired(DateTime? issuedAtUtc) =>
        issuedAtUtc is null || DateTime.UtcNow - issuedAtUtc.Value > Lifetime;

    // Relative path the courier opens; the UI prepends the portal origin.
    // slug is cosmetic (AppSettings.PortalTenantSlug) — the token is what
    // actually resolves the courier.
    public static string BuildPath(string slug, string? token) =>
        string.IsNullOrEmpty(token)
            ? string.Empty
            : $"/drive/{(string.IsNullOrWhiteSpace(slug) ? "portal" : slug)}/{token}";
}
