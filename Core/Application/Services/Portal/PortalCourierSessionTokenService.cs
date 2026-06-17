using System;
using System.Globalization;
using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Portal;

// Courier Portal magic-link (Item 8.5) — signed courier SESSION token.
//
// Distinct from two other tokens in this area:
//   • CourierPortalLink (the opaque DB magic-link on tucCourier) — redeemed
//     ONCE at /drive/<token> to bootstrap a session.
//   • PortalSessionTokenService (the APPLICANT session token).
//
// After /drive/<token> validates the DB magic-link, we issue one of these
// signed session tokens (tenantId:courierId) which the courier SPA carries as
// the X-Portal-Token header on /api/v1/courier/* — authenticated by
// PortalCourierAuthenticationHandler. Same ITimeLimitedDataProtector pattern as
// the applicant session (per-tenant SSM keys), but a SEPARATE protector purpose
// so an applicant token can never authenticate as a courier and vice versa.
public class PortalCourierSessionTokenService
{
    // 7 days — a courier can come back to their portal across sessions without
    // re-clicking the magic link; the SPA can refresh before expiry.
    public static readonly TimeSpan TokenLifetime = TimeSpan.FromDays(7);

    private readonly ITimeLimitedDataProtector _protector;

    public PortalCourierSessionTokenService(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("Portal.CourierSession").ToTimeLimitedDataProtector();
    }

    public string Issue(string tenantId, int courierId)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new ArgumentException("Tenant ID is required to issue a courier session token.", nameof(tenantId));
        return _protector.Protect(
            $"{tenantId}:{courierId.ToString(CultureInfo.InvariantCulture)}",
            TokenLifetime);
    }

    // Returns (tenantId, courierId) or null on tamper / expiry / malformed.
    public (string TenantId, int CourierId)? TryRead(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        try
        {
            var raw = _protector.Unprotect(token);
            var colon = raw.IndexOf(':');
            if (colon <= 0) return null;
            var tenantId = raw[..colon];
            if (!int.TryParse(raw[(colon + 1)..], NumberStyles.Integer, CultureInfo.InvariantCulture, out var courierId))
                return null;
            return (tenantId, courierId);
        }
        catch (CryptographicException ex)
        {
            // Covers both tampered AND expired tokens (TimeLimitedDataProtector
            // throws CryptographicException once past expiry).
            Log.Warning(ex, "Courier session token rejected (tamper or expiry)");
            return null;
        }
    }
}
