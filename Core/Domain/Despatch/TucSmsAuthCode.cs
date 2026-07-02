using System;

namespace DfrntDriveConfigurator.Core.Domain.Despatch;

// Courier SMS 2FA code store (database/057). Hand-authored, PascalCase columns
// match property names; wired in DynamicDespatchDbContext (excluded from
// efpt.config.json so it survives EFPT regen). One row per issued 6-digit code;
// CodeHash is the SHA-256 of the code (never store plaintext).
public class TucSmsAuthCode
{
    public long Id { get; set; }
    public string CanonicalMobile { get; set; } = string.Empty;
    public byte[] CodeHash { get; set; } = Array.Empty<byte>();
    public string Purpose { get; set; } = string.Empty;
    public DateTime SentAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? ConsumedAt { get; set; }
    public int FailedAttempts { get; set; }
}
