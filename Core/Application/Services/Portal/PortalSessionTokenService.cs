using System;
using System.Globalization;
using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Portal;

// Courier Portal Phase 1 — signed applicant-session token.
//
// The applicant portal deliberately does NOT use JWT (the configurator is
// cookie-only and has no JWT infrastructure). Instead we reuse the same
// ITimeLimitedDataProtector pattern proven by the Quotes public-link flow
// (see Tenant/QuoteInviteTokenService) so a token issued by tenant A cannot
// be validated on tenant B (per-tenant DataProtection keys in SSM), and any
// tamper/expiry surfaces as a CryptographicException on Unprotect.
//
// The token encodes the tenantId + applicantId. tenantId is non-secret; the
// signature guarantees it can't be tampered with. Anonymous /api/portal/*
// requests carry this as the X-Portal-Token header.
public class PortalSessionTokenService
{
    // 7 days — long enough that an applicant can leave and resume their
    // application across a few sessions; /api/portal/auth/refresh re-issues
    // a fresh one before expiry.
    public static readonly TimeSpan TokenLifetime = TimeSpan.FromDays(7);

    private readonly ITimeLimitedDataProtector _protector;

    public PortalSessionTokenService(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("Portal.ApplicantSession").ToTimeLimitedDataProtector();
    }

    public string Issue(string tenantId, int applicantId)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new ArgumentException("Tenant ID is required to issue a portal session token.", nameof(tenantId));
        return _protector.Protect(
            $"{tenantId}:{applicantId.ToString(CultureInfo.InvariantCulture)}",
            TokenLifetime);
    }

    // Returns (tenantId, applicantId) or null on tamper / expiry / malformed.
    public (string TenantId, int ApplicantId)? TryRead(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        try
        {
            var raw = _protector.Unprotect(token);
            var colon = raw.IndexOf(':');
            if (colon <= 0) return null;
            var tenantId = raw[..colon];
            if (!int.TryParse(raw[(colon + 1)..], NumberStyles.Integer, CultureInfo.InvariantCulture, out var applicantId))
                return null;
            return (tenantId, applicantId);
        }
        catch (CryptographicException ex)
        {
            // Covers BOTH tampered AND expired tokens (TimeLimitedDataProtector
            // throws CryptographicException once past expiry).
            Log.Warning(ex, "Portal session token rejected (tamper or expiry)");
            return null;
        }
    }
}
