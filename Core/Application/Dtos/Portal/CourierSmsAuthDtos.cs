namespace DfrntDriveConfigurator.Core.Application.Dtos.Portal;

// Courier SMS 2FA / passwordless sign-in (modal §17b + PHASE1-SMS-AUTH).

/// <summary>Request an SMS code for a mobile. No tenant slug — the deployment
/// knows its tenant.</summary>
public class CourierSmsRequestCodeDto
{
    public string Mobile { get; set; } = string.Empty;
}

/// <summary>Verify a code and (on success) receive a courier session token.</summary>
public class CourierSmsVerifyCodeDto
{
    public string Mobile { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}

/// <summary>Deliberately generic — the same shape whether or not a courier
/// matched, so callers can't enumerate which numbers exist.</summary>
public class CourierSmsRequestResultDto
{
    public bool Accepted { get; set; } = true;
    public string Message { get; set; } = "If that mobile is registered, a code has been sent.";
}

/// <summary>Returned on a successful verify. Token = signed
/// PortalCourierSessionToken carried as X-Portal-Token by the SPA.</summary>
public class CourierSmsVerifyResultDto
{
    public string Token { get; set; } = string.Empty;
    public int CourierId { get; set; }
    public string FirstName { get; set; } = string.Empty;
}

/// <summary>Operator-facing 2FA enrolment status for the courier modal.</summary>
public class CourierTwoFactorStatusDto
{
    public bool MobileVerified { get; set; }
    public string? MobileVerifiedDate { get; set; }
    public bool MobileNeedsReview { get; set; }
    public bool HasMobile { get; set; }
    public bool SmsConfigured { get; set; }
}
