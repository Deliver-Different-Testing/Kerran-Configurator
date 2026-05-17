using System;
using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Tenant;

// Phase 5+14 / slice 2b — signed token for the public-link external-carrier
// flow. Wraps ASP.NET Core's ITimeLimitedDataProtector (purpose
// "Quotes.PublicInvite") so a token issued by tenant A cannot be validated
// on tenant B (per-tenant DataProtection keys in SSM). Tokens encode
// nothing but the quoteId + an expiry; tampering throws
// CryptographicException on Unprotect.
public class QuoteInviteTokenService
{
    // 30 days lines up roughly with how long a posting could plausibly stay
    // open before the Expired sweep would kick in. Tunable later if needed.
    public static readonly TimeSpan TokenLifetime = TimeSpan.FromDays(30);

    private readonly ITimeLimitedDataProtector _protector;

    public QuoteInviteTokenService(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("Quotes.PublicInvite").ToTimeLimitedDataProtector();
    }

    // Token payload encodes both tenantId and quoteId because anonymous
    // public-link requests don't have a CurrentTenantID claim to resolve
    // the per-tenant DB connection. The tenantId is non-secret; the
    // signature on the protected blob ensures it can't be tampered with.
    public string Issue(string tenantId, int quoteId)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new ArgumentException("Tenant ID is required to issue a public invite token.", nameof(tenantId));
        return _protector.Protect($"{tenantId}:{quoteId.ToString(System.Globalization.CultureInfo.InvariantCulture)}", TokenLifetime);
    }

    // Returns (tenantId, quoteId) or null on tamper / expiry / malformed input.
    // Caller logs nothing extra — we log here so we have a single audit point.
    public (string TenantId, int QuoteId)? TryRead(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        try
        {
            var raw = _protector.Unprotect(token);
            var colon = raw.IndexOf(':');
            if (colon <= 0) return null;
            var tenantId = raw[..colon];
            if (!int.TryParse(raw[(colon + 1)..], System.Globalization.NumberStyles.Integer,
                              System.Globalization.CultureInfo.InvariantCulture, out var quoteId)) return null;
            return (tenantId, quoteId);
        }
        catch (CryptographicException ex)
        {
            // CryptographicException covers BOTH tampered tokens AND expired
            // tokens (TimeLimitedDataProtector throws here when past expiry).
            Log.Warning(ex, "Public quote-invite token rejected (tamper or expiry)");
            return null;
        }
    }
}
