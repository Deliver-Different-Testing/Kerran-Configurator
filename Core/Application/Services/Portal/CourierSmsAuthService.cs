using System;
using System.Linq;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Portal;
using DfrntDriveConfigurator.Core.Application.Services.Common;
using DfrntDriveConfigurator.Core.Application.Utilities;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using DfrntDriveConfigurator.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Portal;

/// <summary>Thrown when a rate limit / lockout is hit — mapped to HTTP 429.</summary>
public class SmsRateLimitException(int retryAfterSeconds)
    : Exception("Too many attempts. Please wait and try again.")
{
    public int RetryAfterSeconds { get; } = retryAfterSeconds;
}

/// <summary>
/// Courier SMS 2FA / passwordless sign-in (modal §17b + PHASE1-SMS-AUTH, built
/// natively). Generates/stores 6-digit codes (SHA-256, never plaintext), sends
/// via AWS Pinpoint, verifies, and on success issues the existing signed
/// PortalCourierSessionToken (no JWT). Shared by the anonymous portal endpoints
/// and the staff "send enrolment code" modal affordance.
/// </summary>
public class CourierSmsAuthService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IPortalTenantContext portalTenant,
    ISmsSender sms,
    SmsRateLimiter rateLimiter,
    PortalCourierSessionTokenService sessionTokens,
    AppSettings settings)
{
    private const string Purpose = "CourierLogin";
    private static readonly TimeSpan CodeTtl = TimeSpan.FromMinutes(10);

    // ---- anonymous portal flow ----------------------------------------------

    /// <summary>
    /// Request a code for a raw mobile. Always returns a generic result (never
    /// leaks whether the number is registered). Throws SmsRateLimitException on
    /// throttle.
    /// </summary>
    public async Task<CourierSmsRequestResultDto> RequestCodeAsync(string rawMobile, string? ip, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var countryCode = await ctx.TblSettings.Select(s => s.CountryCode).FirstOrDefaultAsync(ct);
        var canonical = PhoneNumbers.ToE164(rawMobile, countryCode);

        // Unparseable → generic success (don't leak, can't match a courier).
        if (canonical == null) return new CourierSmsRequestResultDto();

        var rl = await rateLimiter.CheckRequestAsync(canonical, ip, ct);
        if (!rl.Allowed) throw new SmsRateLimitException(rl.RetryAfterSeconds);

        var courier = await FindCourierByMobileAsync(ctx, canonical, countryCode, ct);
        // No match → generic success, no send.
        if (courier == null) return new CourierSmsRequestResultDto();

        await IssueAndSendAsync(ctx, canonical, ip, ct);
        return new CourierSmsRequestResultDto();
    }

    /// <summary>
    /// Verify a code. On success: mark verified + issue a courier session token.
    /// Throws PortalException on invalid/expired code, SmsRateLimitException on
    /// lockout.
    /// </summary>
    public async Task<CourierSmsVerifyResultDto> VerifyCodeAsync(string rawMobile, string code, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var countryCode = await ctx.TblSettings.Select(s => s.CountryCode).FirstOrDefaultAsync(ct);
        var canonical = PhoneNumbers.ToE164(rawMobile, countryCode);
        if (canonical == null) throw new PortalException("Enter a valid mobile number.");

        if (await rateLimiter.IsLockedOutAsync(canonical, ct))
            throw new SmsRateLimitException(900);

        var now = DateTime.UtcNow;
        var row = await ctx.TucSmsAuthCodes
            .Where(c => c.CanonicalMobile == canonical && c.ConsumedAt == null && c.ExpiresAt > now)
            .OrderByDescending(c => c.Id)
            .FirstOrDefaultAsync(ct);

        if (row == null || !FixedTimeEquals(row.CodeHash, Hash(code)))
        {
            if (row != null)
            {
                row.FailedAttempts += 1;
                await ctx.SaveChangesAsync(ct);
            }
            var lockedOut = await rateLimiter.RegisterFailedVerifyAsync(canonical, ct);
            if (lockedOut) throw new SmsRateLimitException(900);
            throw new PortalException("That code is invalid or has expired.");
        }

        var courier = await FindCourierByMobileAsync(ctx, canonical, countryCode, ct);
        if (courier == null)
            throw new PortalException("No courier is registered to that mobile.");

        row.ConsumedAt = now;
        courier.MobileVerified = true;
        courier.MobileVerifiedDate = now;
        await ctx.SaveChangesAsync(ct);
        await rateLimiter.ResetFailuresAsync(canonical, ct);

        var token = sessionTokens.Issue(portalTenant.TenantId, courier.UccrId);
        Log.Information("Courier {CourierId} signed in via SMS ({MobileTail})", courier.UccrId, PhoneNumbers.Tail(canonical));
        return new CourierSmsVerifyResultDto
        {
            Token = token,
            CourierId = courier.UccrId,
            FirstName = courier.UccrName ?? string.Empty,
        };
    }

    // ---- staff modal (§17b) --------------------------------------------------

    public async Task<CourierTwoFactorStatusDto> GetStatusAsync(int courierId, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var c = await ctx.TucCouriers
            .Where(x => x.UccrId == courierId)
            .Select(x => new { x.UccrMobile, x.MobileVerified, x.MobileVerifiedDate, x.MobileNeedsReview })
            .FirstOrDefaultAsync(ct);
        if (c == null) throw new PortalException("Courier not found.");

        return new CourierTwoFactorStatusDto
        {
            MobileVerified = c.MobileVerified,
            MobileVerifiedDate = c.MobileVerifiedDate?.ToString("yyyy-MM-dd"),
            MobileNeedsReview = c.MobileNeedsReview,
            HasMobile = !string.IsNullOrWhiteSpace(c.UccrMobile),
            SmsConfigured = sms.IsConfigured,
        };
    }

    /// <summary>
    /// Staff-initiated enrolment code send for a known courier. Unlike the
    /// anonymous flow, errors here ARE specific (the operator is authenticated).
    /// </summary>
    public async Task<CourierSmsRequestResultDto> SendEnrolmentCodeAsync(int courierId, string? ip, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var countryCode = await ctx.TblSettings.Select(s => s.CountryCode).FirstOrDefaultAsync(ct);
        var courier = await ctx.TucCouriers.FirstOrDefaultAsync(x => x.UccrId == courierId, ct);
        if (courier == null) throw new PortalException("Courier not found.");
        if (string.IsNullOrWhiteSpace(courier.UccrMobile))
            throw new PortalException("This courier has no mobile number on file. Add one on the Contact tab first.");

        var canonical = PhoneNumbers.ToE164(courier.UccrMobile, countryCode);
        if (canonical == null)
        {
            courier.MobileNeedsReview = true;
            await ctx.SaveChangesAsync(ct);
            throw new PortalException("This courier's mobile number can't be read as a valid number — please correct it on the Contact tab.");
        }

        if (!sms.IsConfigured)
            throw new PortalException("SMS is not configured on this deployment.");

        var rl = await rateLimiter.CheckRequestAsync(canonical, ip, ct);
        if (!rl.Allowed) throw new SmsRateLimitException(rl.RetryAfterSeconds);

        await IssueAndSendAsync(ctx, canonical, ip, ct);
        return new CourierSmsRequestResultDto { Message = "Enrolment code sent." };
    }

    // ---- internals -----------------------------------------------------------

    private async Task IssueAndSendAsync(DynamicDespatchDbContext ctx, string canonical, string? ip, CancellationToken ct)
    {
        var code = GenerateCode();
        var now = DateTime.UtcNow;
        ctx.TucSmsAuthCodes.Add(new TucSmsAuthCode
        {
            CanonicalMobile = canonical,
            CodeHash = Hash(code),
            Purpose = Purpose,
            SentAt = now,
            ExpiresAt = now.Add(CodeTtl),
        });
        await ctx.SaveChangesAsync(ct);

        var message = $"{settings.PortalDisplayName}: Your sign-in code is {code}. Expires in 10 minutes. Don't share it with anyone.";
        await sms.SendAsync(canonical, message, ct);
        await rateLimiter.RegisterSentAsync(canonical, ip, ct);
    }

    // Match a courier by canonicalising each active courier's stored mobile.
    // Courier counts per tenant are modest; a projected scan is fine.
    private static async Task<TucCourier?> FindCourierByMobileAsync(
        DynamicDespatchDbContext ctx, string canonical, string? countryCode, CancellationToken ct)
    {
        var candidates = await ctx.TucCouriers
            .Where(c => c.Active && c.UccrMobile != null && c.UccrMobile != "")
            .ToListAsync(ct);
        return candidates.FirstOrDefault(c => PhoneNumbers.ToE164(c.UccrMobile, countryCode) == canonical);
    }

    private static string GenerateCode()
    {
        // Cryptographically-random 6-digit code (000000–999999).
        var n = RandomNumberGenerator.GetInt32(0, 1_000_000);
        return n.ToString("D6", System.Globalization.CultureInfo.InvariantCulture);
    }

    private static byte[] Hash(string code) =>
        SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(code));

    private static bool FixedTimeEquals(byte[] a, byte[] b) =>
        a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
}
