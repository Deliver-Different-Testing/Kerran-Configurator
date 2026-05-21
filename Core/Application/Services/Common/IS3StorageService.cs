using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace DfrntDriveConfigurator.Core.Application.Services.Common;

/// <summary>
/// Thin wrapper over <see cref="Amazon.S3.IAmazonS3"/> scoped to the compliance-
/// uploads bucket (configured via AppSettings.S3BucketComplianceUploads).
/// Used by CourierDocumentService for the put/get/delete of compliance document
/// bytes. Same pattern can be applied to template uploads later by parameterising
/// the bucket.
/// </summary>
public interface IS3StorageService
{
    /// <summary>
    /// Uploads <paramref name="content"/> to S3 under the supplied <paramref name="key"/>.
    /// Caller owns disposal of the source stream. ContentType is stored on the
    /// object so the proxy-download path can serve it back with the correct
    /// MIME header.
    /// </summary>
    Task PutAsync(Stream content, string key, string contentType, CancellationToken ct = default);

    /// <summary>
    /// Fetches an object from S3. Returns null if the object does not exist.
    /// The caller (typically a controller using <c>File(stream, ...)</c>) takes
    /// ownership of the returned stream; ASP.NET Core disposes it after streaming.
    /// </summary>
    Task<S3GetResult?> GetAsync(string key, CancellationToken ct = default);

    /// <summary>
    /// Deletes the object at <paramref name="key"/>. Idempotent — succeeds even
    /// if the object did not exist (S3 returns 204 either way).
    /// </summary>
    Task DeleteAsync(string key, CancellationToken ct = default);

    /// <summary>
    /// Returns true if an object exists at the given key. Implemented as a
    /// HEAD request — does not download the bytes.
    /// </summary>
    Task<bool> ExistsAsync(string key, CancellationToken ct = default);
}

/// <summary>
/// Result of a successful <see cref="IS3StorageService.GetAsync"/> call. The
/// <see cref="Content"/> stream is the live S3 response stream — read it to
/// completion, then ASP.NET Core (or the caller) disposes it which closes the
/// underlying connection.
/// </summary>
public sealed record S3GetResult(
    Stream Content,
    string ContentType,
    long ContentLength,
    string? ETag);
