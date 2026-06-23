using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Amazon.S3;
using Amazon.S3.Model;

namespace DfrntDriveConfigurator.Core.PdfOverlay;

// Vendored from PdfOverlay.Client — the S3-backed template store (system of record) plus the
// listing/metadata contracts and the binding resolver. The standalone tool's FileSystem/InMemory
// stores are dropped; configurator only needs the S3 store.

/// <summary>Listing/metadata view of a template (no PDF bytes or field map).</summary>
public sealed record TemplateSummary(
    string TemplateId,
    string ClientId,
    string DisplayName,
    string DocumentType,
    int CurrentVersion,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

/// <summary>A template's metadata plus its current field map.</summary>
public sealed record TemplateDetail(TemplateSummary Summary, FieldMap Map, int PageCount);

/// <summary>Everything the renderer needs for one render call. Returned by the store.</summary>
public sealed record RenderSource(byte[] Pdf, FieldMap Map, string TemplateId, int Version);

/// <summary>
/// Thrown when a fetch/render targets a specific template version that doesn't exist (a known template,
/// unknown version). Derives from <see cref="KeyNotFoundException"/> so existing catch sites keep working.
/// </summary>
public sealed class TemplateVersionNotFoundException(string templateId, int version)
    : KeyNotFoundException($"Template '{templateId}' has no version {version}.")
{
    public string TemplateId { get; } = templateId;
    public int Version { get; } = version;
}

/// <summary>
/// Validates client/template identifiers before they are interpolated into S3 keys. The strict
/// character set excludes <c>/</c>, <c>\</c> and <c>.</c>, so path traversal (<c>..</c>) and separators
/// are rejected outright — defence against IDOR / path-traversal on caller-supplied ids.
/// </summary>
public static partial class Identifiers
{
    [GeneratedRegex("^[A-Za-z0-9_-]{1,64}$")]
    private static partial Regex Pattern();

    public static bool IsValid(string? id) => id is not null && Pattern().IsMatch(id);

    /// <summary>Returns the id if valid; otherwise throws (caller surfaces a 400).</summary>
    public static string Require(string id, string paramName) =>
        IsValid(id) ? id : throw new ArgumentException($"'{paramName}' must match ^[A-Za-z0-9_-]{{1,64}}$.", paramName);
}

/// <summary>
/// In-bucket metadata for one template (the mutable head: current version pointer + flags).
/// Serialised with <see cref="FieldMapJson.Options"/> (camelCase + string enums) as <c>meta.json</c>.
/// </summary>
internal sealed record StoredMeta(
    string TemplateId,
    string ClientId,
    string DisplayName,
    string DocumentType,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    int PageCount,
    int CurrentVersion)
{
    public TemplateSummary ToSummary() => new(
        TemplateId, ClientId, DisplayName, DocumentType, CurrentVersion, IsActive, CreatedAt, UpdatedAt);
}

/// <summary>
/// Persistence SPI for templates, their immutable versions, and field maps. <see cref="S3TemplateStore"/>
/// is the system-of-record implementation. One instance is scoped to a single tenant.
/// </summary>
public interface ITemplateStore
{
    Task<TemplateSummary> CreateAsync(
        string clientId, string displayName, string documentType,
        byte[] pdf, int pageCount, CancellationToken ct = default);

    Task<IReadOnlyList<TemplateSummary>> ListAsync(
        string? clientId, string? documentType, bool? active, CancellationToken ct = default);

    Task<TemplateDetail?> GetAsync(string templateId, CancellationToken ct = default);

    Task<IReadOnlyList<int>?> GetVersionsAsync(string templateId, CancellationToken ct = default);

    /// <summary>Replaces the field map, creating a new immutable version. Null if not found.</summary>
    Task<TemplateSummary?> SaveMapAsync(string templateId, FieldMap map, CancellationToken ct = default);

    /// <summary>Sets the active flag (true = published, false = inactive). Versions remain. False if not found.</summary>
    Task<bool> SetActiveAsync(string templateId, bool active, CancellationToken ct = default);

    /// <summary>Fetches the PDF + field map for a render. Null if not found; throws if version unknown.</summary>
    Task<RenderSource?> GetRenderSourceAsync(string templateId, int? version, CancellationToken ct = default);

    /// <summary>Returns the original template PDF bytes. Null if not found; throws if version unknown.</summary>
    Task<byte[]?> GetOriginalPdfAsync(string templateId, int? version, CancellationToken ct = default);
}

/// <summary>
/// S3-backed <see cref="ITemplateStore"/> — the system of record. One instance is scoped to a single
/// tenant: every key is rooted at <c>tenants/{tenantId}/</c>, so cross-tenant access is impossible by
/// construction. No DynamoDB — listing is an S3 prefix query.
/// <code>
/// tenants/{tenantId}/templates/{templateId}/
///     meta.json
///     v1/original.pdf  v1/field-map.json
///     v2/original.pdf  v2/field-map.json   # v2 reuses v1's PDF; only the map changes
/// </code>
/// </summary>
public sealed class S3TemplateStore(IAmazonS3 s3, string bucket, string tenantId, TimeProvider clock)
    : ITemplateStore
{
    private const string MetaFile = "meta.json";
    private const string PdfFile = "original.pdf";
    private const string MapFile = "field-map.json";

    private readonly string _prefix = $"tenants/{tenantId}/templates/";

    private string Dir(string templateId) => $"{_prefix}{templateId}/";
    private string MetaKey(string templateId) => $"{Dir(templateId)}{MetaFile}";
    private string PdfKey(string templateId, int v) => $"{Dir(templateId)}v{v}/{PdfFile}";
    private string MapKey(string templateId, int v) => $"{Dir(templateId)}v{v}/{MapFile}";

    public async Task<TemplateSummary> CreateAsync(
        string clientId, string displayName, string documentType,
        byte[] pdf, int pageCount, CancellationToken ct = default)
    {
        Identifiers.Require(clientId, nameof(clientId));
        var now = clock.GetUtcNow();
        var templateId = Guid.NewGuid().ToString("N");

        await PutBytesAsync(PdfKey(templateId, 1), pdf, "application/pdf", ct);
        await PutTextAsync(MapKey(templateId, 1), FieldMapJson.Serialize(new FieldMap()), ct);

        var meta = new StoredMeta(templateId, clientId, displayName, documentType,
            IsActive: true, CreatedAt: now, UpdatedAt: now, PageCount: pageCount, CurrentVersion: 1);
        await WriteMetaAsync(meta, ct);
        return meta.ToSummary();
    }

    public async Task<IReadOnlyList<TemplateSummary>> ListAsync(
        string? clientId, string? documentType, bool? active, CancellationToken ct = default)
    {
        var results = new List<TemplateSummary>();
        var request = new ListObjectsV2Request { BucketName = bucket, Prefix = _prefix, Delimiter = "/" };

        ListObjectsV2Response response;
        do
        {
            response = await s3.ListObjectsV2Async(request, ct);
            foreach (var commonPrefix in response.CommonPrefixes ?? [])
            {
                var templateId = commonPrefix.TrimEnd('/')[_prefix.Length..];
                var meta = await TryReadMetaAsync(templateId, ct);
                if (meta is null)
                {
                    continue;
                }

                if (clientId is not null && meta.ClientId != clientId)
                {
                    continue;
                }

                if (documentType is not null && meta.DocumentType != documentType)
                {
                    continue;
                }

                if (active is not null && meta.IsActive != active)
                {
                    continue;
                }

                results.Add(meta.ToSummary());
            }

            request.ContinuationToken = response.NextContinuationToken;
        } while (response.IsTruncated ?? false);

        return results.OrderBy(r => r.CreatedAt).ToList();
    }

    public async Task<TemplateDetail?> GetAsync(string templateId, CancellationToken ct = default)
    {
        var meta = await TryReadMetaAsync(templateId, ct);
        if (meta is null)
        {
            return null;
        }

        var map = await ReadMapAsync(templateId, meta.CurrentVersion, ct);
        return new TemplateDetail(meta.ToSummary(), map, meta.PageCount);
    }

    public async Task<IReadOnlyList<int>?> GetVersionsAsync(string templateId, CancellationToken ct = default)
    {
        var meta = await TryReadMetaAsync(templateId, ct);
        if (meta is null)
        {
            return null;
        }

        var versions = new List<int>();
        var request = new ListObjectsV2Request { BucketName = bucket, Prefix = Dir(templateId), Delimiter = "/" };
        var response = await s3.ListObjectsV2Async(request, ct);
        foreach (var name in from cp in response.CommonPrefixes ?? [] select cp.TrimEnd('/')[Dir(templateId).Length..])
        {
            if (name.StartsWith('v') && int.TryParse(name[1..], out var n))
            {
                versions.Add(n);
            }
        }

        versions.Sort();
        return versions;
    }

    public async Task<TemplateSummary?> SaveMapAsync(string templateId, FieldMap map, CancellationToken ct = default)
    {
        var meta = await TryReadMetaAsync(templateId, ct);
        if (meta is null)
        {
            return null;
        }

        var next = meta.CurrentVersion + 1;
        // New immutable version: the PDF is copied (server-side), only the map changes.
        await s3.CopyObjectAsync(new CopyObjectRequest
        {
            SourceBucket = bucket,
            SourceKey = PdfKey(templateId, meta.CurrentVersion),
            DestinationBucket = bucket,
            DestinationKey = PdfKey(templateId, next)
        }, ct);
        await PutTextAsync(MapKey(templateId, next), FieldMapJson.Serialize(map), ct);

        meta = meta with { CurrentVersion = next, UpdatedAt = clock.GetUtcNow() };
        await WriteMetaAsync(meta, ct);
        return meta.ToSummary();
    }

    public async Task<bool> SetActiveAsync(string templateId, bool active, CancellationToken ct = default)
    {
        var meta = await TryReadMetaAsync(templateId, ct);
        if (meta is null)
        {
            return false;
        }

        meta = meta with { IsActive = active, UpdatedAt = clock.GetUtcNow() };
        await WriteMetaAsync(meta, ct);
        return true;
    }

    public async Task<RenderSource?> GetRenderSourceAsync(string templateId, int? version, CancellationToken ct = default)
    {
        var meta = await TryReadMetaAsync(templateId, ct);
        if (meta is null)
        {
            return null;
        }

        var target = await ResolveVersionAsync(templateId, meta, version, ct);
        var pdf = await ReadBytesAsync(PdfKey(templateId, target), ct);
        var map = await ReadMapAsync(templateId, target, ct);
        return new RenderSource(pdf, map, templateId, target);
    }

    public async Task<byte[]?> GetOriginalPdfAsync(string templateId, int? version, CancellationToken ct = default)
    {
        var meta = await TryReadMetaAsync(templateId, ct);
        if (meta is null)
        {
            return null;
        }

        var target = await ResolveVersionAsync(templateId, meta, version, ct);
        return await ReadBytesAsync(PdfKey(templateId, target), ct);
    }

    private async Task<int> ResolveVersionAsync(string templateId, StoredMeta meta, int? version, CancellationToken ct)
    {
        if (version is null)
        {
            return meta.CurrentVersion;
        }

        if (!await ExistsAsync(MapKey(templateId, version.Value), ct))
        {
            throw new TemplateVersionNotFoundException(templateId, version.Value);
        }

        return version.Value;
    }

    // --- S3 primitives -------------------------------------------------------

    private Task PutBytesAsync(string key, byte[] bytes, string contentType, CancellationToken ct) =>
        s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName = bucket,
            Key = key,
            InputStream = new MemoryStream(bytes, writable: false),
            ContentType = contentType
        }, ct);

    private Task<PutObjectResponse> PutTextAsync(string key, string text, CancellationToken ct) =>
        s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName = bucket,
            Key = key,
            ContentBody = text,
            ContentType = "application/json"
        }, ct);

    private async Task<byte[]> ReadBytesAsync(string key, CancellationToken ct)
    {
        using var response = await s3.GetObjectAsync(bucket, key, ct);
        using var ms = new MemoryStream();
        await response.ResponseStream.CopyToAsync(ms, ct);
        return ms.ToArray();
    }

    private async Task<string?> TryReadTextAsync(string key, CancellationToken ct)
    {
        try
        {
            using var response = await s3.GetObjectAsync(bucket, key, ct);
            using var reader = new StreamReader(response.ResponseStream);
            return await reader.ReadToEndAsync(ct);
        }
        catch (AmazonS3Exception e) when (e.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    private async Task<bool> ExistsAsync(string key, CancellationToken ct)
    {
        try
        {
            await s3.GetObjectMetadataAsync(bucket, key, ct);
            return true;
        }
        catch (AmazonS3Exception e) when (e.StatusCode == HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    private async Task<StoredMeta?> TryReadMetaAsync(string templateId, CancellationToken ct)
    {
        // Reject traversal/odd characters in the caller-supplied id before it enters an S3 key.
        if (!Identifiers.IsValid(templateId))
        {
            return null;
        }

        var json = await TryReadTextAsync(MetaKey(templateId), ct);
        return json is null
            ? null
            : JsonSerializer.Deserialize<StoredMeta>(json, FieldMapJson.Options)
              ?? throw new JsonException("meta.json deserialised to null.");
    }

    private Task WriteMetaAsync(StoredMeta meta, CancellationToken ct) =>
        PutTextAsync(MetaKey(meta.TemplateId), JsonSerializer.Serialize(meta, FieldMapJson.Options), ct);

    private async Task<FieldMap> ReadMapAsync(string templateId, int version, CancellationToken ct) =>
        FieldMapJson.Deserialize(await ReadBytesToStringAsync(MapKey(templateId, version), ct));

    private async Task<string> ReadBytesToStringAsync(string key, CancellationToken ct) =>
        await TryReadTextAsync(key, ct) ?? throw new KeyNotFoundException($"Missing object '{key}'.");
}

/// <summary>
/// Re-keys a path-keyed source dictionary (e.g. <c>pod.podName</c>) into the id-keyed dictionary the
/// renderer expects, following each field's <see cref="FieldMapping.DataBinding"/>. Pure — no I/O.
/// Image-field values pass through unchanged (resolve URLs to bytes first).
/// </summary>
public static class BindingResolver
{
    public static IReadOnlyDictionary<string, object?> ResolveById(
        FieldMap map, IReadOnlyDictionary<string, object?> sourceByPath)
    {
        ArgumentNullException.ThrowIfNull(map);
        ArgumentNullException.ThrowIfNull(sourceByPath);

        var resolved = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var field in map.Fields)
        {
            if (string.IsNullOrWhiteSpace(field.DataBinding))
            {
                continue; // Field carries no binding — nothing to resolve.
            }

            if (sourceByPath.TryGetValue(field.DataBinding, out var value) && value is not null)
            {
                resolved[field.Id] = value;
            }
        }

        return resolved;
    }
}
