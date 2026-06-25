using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
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

        // Per-item table rows (fixed indexed slots pod.item.{i}.{field}) for templates with an item list.
        await AddJobItemBindingsAsync(db, jobId, b, ct);

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

    // Up to this many item rows are stamped (fixed indexed slots pod.item.{i}.{field}); a job with more
    // items overflows and the extras are not rendered (Option A — fixed rows). Mirrors ITEM_ROW_SLOTS in
    // the SPA's dataBindings.ts.
    private const int MaxItemRows = 20;

    /// <summary>
    /// Adds per-item bindings for a fixed-row item table, keyed <c>pod.item.{i}.{field}</c> in job-item
    /// order (i = 0-based row). Read from <c>tucJobItems</c> via raw SQL — that table isn't an EF entity in
    /// configurator. Best-effort: a query failure is logged and skipped (the rest of the render proceeds).
    /// </summary>
    private static async Task AddJobItemBindingsAsync(
        DynamicDespatchDbContext db, int jobId, Dictionary<string, string?> b, CancellationToken ct)
    {
        try
        {
            var conn = db.Database.GetDbConnection();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText =
                "SELECT TOP (@n) Items, Weight, Length, Height, Depth, Cubic, Barcode, Notes " +
                "FROM tucJobItems WHERE JobID = @jobId ORDER BY ItemID";
            AddParam(cmd, "@n", MaxItemRows);
            AddParam(cmd, "@jobId", jobId);

            var opened = conn.State != ConnectionState.Open;
            if (opened)
            {
                await db.Database.OpenConnectionAsync(ct);
            }

            try
            {
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                var i = 0;
                while (await reader.ReadAsync(ct))
                {
                    var row = i;
                    void SetItem(string field, string? value)
                    {
                        if (!string.IsNullOrWhiteSpace(value))
                        {
                            b[$"pod.item.{row}.{field}"] = value;
                        }
                    }

                    SetItem("quantity", ToStr(reader["Items"]));
                    SetItem("weight", ToStr(reader["Weight"]));
                    SetItem("length", ToStr(reader["Length"]));
                    SetItem("height", ToStr(reader["Height"]));
                    SetItem("depth", ToStr(reader["Depth"]));
                    SetItem("cubic", ToStr(reader["Cubic"]));
                    SetItem("barcode", ToStr(reader["Barcode"]));
                    SetItem("notes", ToStr(reader["Notes"]));
                    i++;
                }
            }
            finally
            {
                if (opened)
                {
                    await db.Database.CloseConnectionAsync();
                }
            }
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "PDF Overlay: failed to load item rows for job {JobId}", jobId);
        }
    }

    private static string? ToStr(object? value) =>
        value is null or DBNull ? null : Convert.ToString(value, CultureInfo.InvariantCulture);

    private static void AddParam(DbCommand cmd, string name, object value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = name;
        p.Value = value;
        cmd.Parameters.Add(p);
    }
}
