using System;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Amazon.S3;
using Amazon.S3.Model;
using DfrntDriveConfigurator.Infrastructure;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Common;

/// <inheritdoc cref="IS3StorageService"/>
public class S3StorageService : IS3StorageService
{
    private readonly IAmazonS3 _s3;
    private readonly string _bucket;

    public S3StorageService(IAmazonS3 s3, AppSettings settings)
    {
        _s3 = s3;
        _bucket = settings.S3BucketComplianceUploads;

        if (string.IsNullOrEmpty(_bucket))
        {
            // Don't throw at construction time — the warning in Program.cs has
            // already been emitted. We throw on first use instead so the app
            // still boots in misconfigured environments (e.g. CI build/test
            // where AWS isn't reachable). Each operation guards via EnsureBucket().
            Log.Warning("S3StorageService constructed without a bucket name. Operations will throw until S3BucketComplianceUploads is configured.");
        }
    }

    public async Task PutAsync(Stream content, string key, string contentType, CancellationToken ct = default)
    {
        EnsureBucket();
        var request = new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = content,
            ContentType = contentType,
            AutoCloseStream = false,  // caller owns the source stream
        };
        await _s3.PutObjectAsync(request, ct);
        Log.Debug("S3 PUT {Bucket}/{Key} ({ContentType})", _bucket, key, contentType);
    }

    public async Task<S3GetResult?> GetAsync(string key, CancellationToken ct = default)
    {
        EnsureBucket();
        try
        {
            var response = await _s3.GetObjectAsync(_bucket, key, ct);
            // ResponseStream is owned by the response; when ASP.NET Core
            // disposes the stream after streaming to the client, the underlying
            // connection is released back to the AWS SDK's pool.
            return new S3GetResult(
                response.ResponseStream,
                response.Headers.ContentType ?? "application/octet-stream",
                response.ContentLength,
                response.ETag);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task DeleteAsync(string key, CancellationToken ct = default)
    {
        EnsureBucket();
        await _s3.DeleteObjectAsync(_bucket, key, ct);
        Log.Debug("S3 DELETE {Bucket}/{Key}", _bucket, key);
    }

    public async Task<bool> ExistsAsync(string key, CancellationToken ct = default)
    {
        EnsureBucket();
        try
        {
            await _s3.GetObjectMetadataAsync(_bucket, key, ct);
            return true;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    private void EnsureBucket()
    {
        if (string.IsNullOrEmpty(_bucket))
        {
            throw new InvalidOperationException(
                "S3BucketComplianceUploads env var is not configured. " +
                "Set it to a valid bucket name (e.g. urgent-couriers-compliance-uploads-sandbox).");
        }
    }
}
