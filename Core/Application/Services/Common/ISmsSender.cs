using System.Threading;
using System.Threading.Tasks;

namespace DfrntDriveConfigurator.Core.Application.Services.Common;

/// <summary>
/// Sends a transactional SMS. The default implementation is AWS Pinpoint SMS
/// (<see cref="PinpointSmsSender"/>) — the same provider smppservice uses. The
/// boundary lets services be unit-tested with a fake and keeps the provider
/// swappable.
/// </summary>
public interface ISmsSender
{
    /// <summary>True when the sender is configured and can actually send.</summary>
    bool IsConfigured { get; }

    /// <summary>
    /// Sends <paramref name="message"/> to <paramref name="canonicalMobile"/>
    /// (E.164). Returns the provider message id, or null on a soft failure
    /// (logged; callers should not surface provider detail to the user).
    /// </summary>
    Task<string?> SendAsync(string canonicalMobile, string message, CancellationToken ct = default);
}
