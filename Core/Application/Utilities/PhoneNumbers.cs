using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;

namespace DfrntDriveConfigurator.Core.Application.Utilities;

/// <summary>
/// Best-effort E.164 canonicalisation for courier mobiles, driven by the tenant
/// <c>TblSetting.CountryCode</c>. Deliberately dependency-free — adequate for the
/// stack's NZ / US / AU / GB / CA footprint. A number that can't be confidently
/// canonicalised returns null so the caller can flag it (MobileNeedsReview) and
/// skip SMS rather than text a wrong number.
///
/// Hardening path (deferred): swap this for libphonenumber-csharp for full
/// international parsing/validation, per the PHASE1-SMS-AUTH spec §2.3.
/// </summary>
public static class PhoneNumbers
{
    // ISO alpha-2 → country calling code (+ national trunk prefix to strip).
    private static readonly (string Iso, string Dial, string Trunk)[] KnownCountries =
    {
        ("NZ", "64", "0"),
        ("AU", "61", "0"),
        ("GB", "44", "0"),
        ("US", "1",  "1"),
        ("CA", "1",  "1"),
    };

    private static readonly Regex E164 = new(@"^\+[1-9]\d{6,14}$", RegexOptions.Compiled);

    /// <summary>
    /// Returns the E.164 form (e.g. +6421234567) or null if it can't be
    /// confidently canonicalised. <paramref name="countryCode"/> is the tenant's
    /// TblSetting.CountryCode — an ISO alpha-2 ("NZ"), a dial code ("64"/"+64"),
    /// or empty.
    /// </summary>
    public static string? ToE164(string? raw, string? countryCode)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        // Strip everything except digits and a leading +.
        var trimmed = raw.Trim();
        var hasPlus = trimmed.StartsWith('+') || trimmed.StartsWith("00");
        var digits = new string(trimmed.Where(char.IsDigit).ToArray());
        if (digits.Length == 0) return null;

        // International prefix already present (+64..., 0064...).
        if (hasPlus)
        {
            if (trimmed.StartsWith("00")) digits = digits.Length > 2 ? digits[2..] : digits;
            var intl = "+" + digits;
            return E164.IsMatch(intl) ? intl : null;
        }

        var (dial, trunk) = ResolveDial(countryCode);
        if (dial == null) return null; // unknown country + no prefix → can't be sure

        // Already starts with the country dial code (national number entered with it).
        if (digits.StartsWith(dial))
        {
            var candidate = "+" + digits;
            if (E164.IsMatch(candidate)) return candidate;
        }

        // Strip the national trunk prefix (e.g. NZ/AU leading 0) then prepend dial.
        var national = digits;
        if (!string.IsNullOrEmpty(trunk) && national.StartsWith(trunk))
            national = national[trunk.Length..];

        var result = "+" + dial + national;
        return E164.IsMatch(result) ? result : null;
    }

    private static (string? Dial, string Trunk) ResolveDial(string? countryCode)
    {
        if (string.IsNullOrWhiteSpace(countryCode)) return (null, string.Empty);
        var cc = countryCode.Trim().ToUpperInvariant();

        var byIso = KnownCountries.FirstOrDefault(c => c.Iso == cc);
        if (byIso.Iso != null) return (byIso.Dial, byIso.Trunk);

        // Dial-code form ("64", "+64").
        var digits = new string(cc.Where(char.IsDigit).ToArray());
        if (digits.Length > 0)
        {
            var byDial = KnownCountries.FirstOrDefault(c => c.Dial == digits);
            // Prefer a known trunk; otherwise default to national leading-0.
            return (digits, byDial.Iso != null ? byDial.Trunk : "0");
        }

        return (null, string.Empty);
    }

    /// <summary>Masks all but the last 4 digits for logging.</summary>
    public static string Tail(string? mobile) =>
        string.IsNullOrEmpty(mobile) || mobile.Length < 4
            ? "****"
            : $"***{mobile[^4..]}";
}
