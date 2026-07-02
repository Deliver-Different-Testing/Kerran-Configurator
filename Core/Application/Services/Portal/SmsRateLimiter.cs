using System;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Distributed;

namespace DfrntDriveConfigurator.Core.Application.Services.Portal;

/// <summary>
/// Redis-backed rate limiting + lockout for the courier SMS auth flow
/// (PHASE1-SMS-AUTH §2.4). Uses IDistributedCache (already wired for Redis).
/// Counters are best-effort get/increment/set — adequate for a low-volume auth
/// flow; not a strict atomic limiter.
///
/// Limits:
///   • code requests: 1 / 60s and 5 / hour per mobile
///   • failed verifies: 5 / hour per mobile → 15-minute lockout
///   • code requests: 20 / 10 min per source IP
/// </summary>
public class SmsRateLimiter(IDistributedCache cache)
{
    public record Result(bool Allowed, int RetryAfterSeconds);

    private static readonly Result Ok = new(true, 0);

    // ---- request-code limits -------------------------------------------------
    public async Task<Result> CheckRequestAsync(string canonicalMobile, string? ip, CancellationToken ct = default)
    {
        // Hard block during a failed-verify lockout.
        if (await IsLockedOutAsync(canonicalMobile, ct))
            return new Result(false, 900);

        // 1 per 60s per mobile.
        var perMinuteKey = $"sms:req:min:{canonicalMobile}";
        if (await cache.GetStringAsync(perMinuteKey, ct) is not null)
            return new Result(false, 60);

        // 5 per hour per mobile.
        var perHourKey = $"sms:req:hr:{canonicalMobile}";
        var hourCount = await ReadIntAsync(perHourKey, ct);
        if (hourCount >= 5)
            return new Result(false, 3600);

        // 20 per 10 min per IP.
        if (!string.IsNullOrWhiteSpace(ip))
        {
            var perIpKey = $"sms:req:ip:{ip}";
            var ipCount = await ReadIntAsync(perIpKey, ct);
            if (ipCount >= 20)
                return new Result(false, 600);
        }

        return Ok;
    }

    /// <summary>Records a successful send against the request limits.</summary>
    public async Task RegisterSentAsync(string canonicalMobile, string? ip, CancellationToken ct = default)
    {
        await cache.SetStringAsync($"sms:req:min:{canonicalMobile}", "1",
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(60) }, ct);

        await IncrementAsync($"sms:req:hr:{canonicalMobile}", TimeSpan.FromHours(1), ct);

        if (!string.IsNullOrWhiteSpace(ip))
            await IncrementAsync($"sms:req:ip:{ip}", TimeSpan.FromMinutes(10), ct);
    }

    // ---- verify limits / lockout ---------------------------------------------
    public Task<bool> IsLockedOutAsync(string canonicalMobile, CancellationToken ct = default) =>
        HasKeyAsync($"sms:lock:{canonicalMobile}", ct);

    /// <summary>
    /// Records a failed verify. At the 5th failure within the hour, sets a
    /// 15-minute lockout. Returns true if now locked out.
    /// </summary>
    public async Task<bool> RegisterFailedVerifyAsync(string canonicalMobile, CancellationToken ct = default)
    {
        var count = await IncrementAsync($"sms:fail:{canonicalMobile}", TimeSpan.FromHours(1), ct);
        if (count >= 5)
        {
            await cache.SetStringAsync($"sms:lock:{canonicalMobile}", "1",
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(15) }, ct);
            return true;
        }
        return false;
    }

    public async Task ResetFailuresAsync(string canonicalMobile, CancellationToken ct = default)
    {
        await cache.RemoveAsync($"sms:fail:{canonicalMobile}", ct);
        await cache.RemoveAsync($"sms:lock:{canonicalMobile}", ct);
    }

    // ---- helpers -------------------------------------------------------------
    private async Task<int> ReadIntAsync(string key, CancellationToken ct)
    {
        var raw = await cache.GetStringAsync(key, ct);
        return int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : 0;
    }

    private async Task<int> IncrementAsync(string key, TimeSpan ttl, CancellationToken ct)
    {
        // Best-effort increment; the window TTL is only set on first write so the
        // whole window expires together (fixed-window limiter).
        var current = await ReadIntAsync(key, ct);
        var next = current + 1;
        var opts = current == 0
            ? new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl }
            : new DistributedCacheEntryOptions();
        await cache.SetStringAsync(key, next.ToString(CultureInfo.InvariantCulture), opts, ct);
        return next;
    }

    private async Task<bool> HasKeyAsync(string key, CancellationToken ct) =>
        await cache.GetStringAsync(key, ct) is not null;
}
