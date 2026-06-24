using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Amazon.S3;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.PdfOverlay;

/// <summary>Result of assembling a job's Proof-of-Delivery data for the overlay renderer.</summary>
public sealed record JobPodAssembly(string? ClientCode, IReadOnlyDictionary<string, string?> Bindings);

/// <summary>
/// Assembles the PDF-overlay binding values for a single job, keyed by binding path (e.g. <c>pod.jobNumber</c>),
/// directly from configurator's own Despatch entities — no stored proc, no cross-app call. The delivery
/// signature image is read (best-effort) from the marsapi S3 bucket using the key stored in
/// <c>JobWorkflowSteps.BlobUrl</c>, and base64-encoded so the renderer's image resolver can decode it.
/// </summary>
public sealed class JobPodAssembler(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IAmazonS3 s3,
    AppSettings settings)
{
    public async Task<JobPodAssembly?> AssembleAsync(int jobId, CancellationToken ct = default)
    {
        await using var db = await contextFactory.CreateDbContextAsync(ct);

        var job = await db.TucJobs
            .AsNoTracking()
            .Include(j => j.UcjbClient)
            .Include(j => j.UcjbCourier)
            .FirstOrDefaultAsync(j => j.UcjbId == jobId, ct);

        if (job is null)
        {
            return null;
        }

        var b = new Dictionary<string, string?>(StringComparer.Ordinal);
        void Set(string path, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value)) b[path] = value;
        }

        Set("pod.jobNumber", job.UcjbNumber);
        Set("pod.clientRefA", job.UcjbClientRefa);
        Set("pod.clientRefB", job.UcjbClientRefb);
        Set("pod.account", job.UcjbClient?.UcclName ?? job.UcjbClientCode);
        Set("pod.pickupName", job.PickupFromContact);
        Set("pod.pickupAddress", JoinLines(
            job.PickupAddressLine1, job.PickupAddressLine2, job.PickupAddressLine3, job.PickupAddressLine4,
            job.PickupAddressLine5, job.PickupAddressLine6, job.PickupAddressLine7, job.PickupAddressLine8));
        Set("pod.deliveryName", job.DeliverToContact);
        Set("pod.deliveryAddress", JoinLines(
            job.DeliveryAddressLine1, job.DeliveryAddressLine2, job.DeliveryAddressLine3, job.DeliveryAddressLine4,
            job.DeliveryAddressLine5, job.DeliveryAddressLine6, job.DeliveryAddressLine7, job.DeliveryAddressLine8));
        Set("pod.courierName", JoinSpace(job.UcjbCourier?.UccrName, job.UcjbCourier?.UccrSurname));
        Set("pod.podName", job.UcjbPodname);
        Set("pod.deliveryStatus", job.UcjbJobDone ? "Delivered" : null);
        if (job.UcjbComplTime is { } completed)
        {
            var iso = completed.ToString("o", CultureInfo.InvariantCulture);
            Set("pod.podDate", iso);
            Set("pod.deliveredTime", iso);
        }
        Set("pod.gpsLatitude", job.DeliveryLatitude?.ToString(CultureInfo.InvariantCulture));
        Set("pod.gpsLongitude", job.DeliveryLongitude?.ToString(CultureInfo.InvariantCulture));

        // Delivery signature — best-effort: resolve the marsapi S3 key from the workflow step, fetch the
        // object, base64-encode it. Skipped (text still renders) if the bucket isn't configured, no
        // signature was captured, or the read fails.
        var signatureB64 = await TryGetDeliverySignatureAsync(db, jobId, ct);
        Set("pod.signatureImage", signatureB64);

        var clientCode = job.UcjbClient?.UcclCode ?? job.UcjbClientCode;
        return new JobPodAssembly(clientCode, b);
    }

    private async Task<string?> TryGetDeliverySignatureAsync(DynamicDespatchDbContext db, int jobId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(settings.S3BucketMarsApi))
        {
            return null;
        }

        // The driver app stores the delivery signature under a DeliverySignatures/... key; the key lives
        // in JobWorkflowSteps.BlobUrl (DataType "signature"). Take the most recent.
        var key = await db.JobWorkflowSteps
            .AsNoTracking()
            .Where(w => w.JobId == jobId
                        && w.BlobUrl != null
                        && w.BlobUrl.Contains("DeliverySignatures"))
            .OrderByDescending(w => w.CompletedAt)
            .Select(w => w.BlobUrl)
            .FirstOrDefaultAsync(ct);

        if (string.IsNullOrWhiteSpace(key))
        {
            return null;
        }

        try
        {
            using var response = await s3.GetObjectAsync(settings.S3BucketMarsApi, key, ct);
            using var ms = new MemoryStream();
            await response.ResponseStream.CopyToAsync(ms, ct);
            return Convert.ToBase64String(ms.ToArray());
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            Log.Warning("PDF Overlay: delivery signature object not found for job {JobId} at key {Key}", jobId, key);
            return null;
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "PDF Overlay: failed to read delivery signature for job {JobId} (key {Key})", jobId, key);
            return null;
        }
    }

    private static string? JoinLines(params string?[] parts) =>
        string.Join("\n", parts.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p!.Trim()));

    private static string? JoinSpace(params string?[] parts) =>
        string.Join(" ", parts.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p!.Trim()));
}
