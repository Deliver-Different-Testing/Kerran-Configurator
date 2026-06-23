using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace DfrntDriveConfigurator.Core.PdfOverlay;

// Vendored/adapted from PdfOverlay.Api: the in-process orchestrator (store + image resolution +
// renderer), the tenant context, and the SSRF-guarded image resolver. The standalone tool's Hub-JWT
// auth / DespatchConnectionResolver / EF repositories are dropped — configurator already provides
// shared-cookie auth, the CurrentTenantID claim, and tenant DB access.

/// <summary>Thrown when a render targets a template that doesn't exist.</summary>
public sealed class TemplateNotFoundException(string templateId)
    : Exception($"Template '{templateId}' was not found.");

/// <summary>Thrown when an image field value can't be safely resolved to bytes (blocked host, too large, etc.).</summary>
public sealed class ImageResolutionException(string message) : Exception(message);

/// <summary>Current request's tenant scope. Reads the <c>CurrentTenantID</c> claim Hub stamps at login.</summary>
public interface ITenantContext
{
    string TenantId { get; }
}

/// <summary>Reads the tenant id from the authenticated principal (configurator's <c>CurrentTenantID</c> claim).</summary>
public sealed class HttpTenantContext(IHttpContextAccessor accessor) : ITenantContext
{
    public string TenantId =>
        accessor.HttpContext?.User.Claims.FirstOrDefault(c => c.Type == "CurrentTenantID")?.Value
        ?? throw new InvalidOperationException("No CurrentTenantID claim on the current request.");
}

/// <summary>
/// Resolves an image field's data value to raw bytes <b>before</b> it reaches the pure renderer
/// (which never performs I/O). Supports http(s) URLs, <c>data:</c> URIs, and bare base64.
/// </summary>
public interface IImageResolver
{
    Task<byte[]> ResolveAsync(string reference, CancellationToken ct = default);
}

/// <summary>
/// Default <see cref="IImageResolver"/>. Fetches http(s) URLs via <see cref="HttpClient"/> and
/// decodes <c>data:</c> URIs and bare base64 in-process.
/// </summary>
public sealed class HttpImageResolver(HttpClient http) : IImageResolver
{
    public async Task<byte[]> ResolveAsync(string reference, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reference))
        {
            throw new ArgumentException("Image reference is empty.", nameof(reference));
        }

        if (reference.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            var comma = reference.IndexOf(',');
            return comma < 0
                ? throw new FormatException("Malformed data URI for image field.")
                : Convert.FromBase64String(reference[(comma + 1)..]);
        }

        if (!Uri.TryCreate(reference, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            // Not an http(s) URL — assume bare base64.
            return Convert.FromBase64String(reference);
        }

        // Up-front SSRF check for a clear rejection; the HttpClient's connect callback re-validates
        // the resolved IP at connect time to defeat DNS rebinding (see PdfOverlayServiceRegistration).
        if (await SsrfGuard.IsHostBlockedAsync(uri.Host, ct))
        {
            throw new ImageResolutionException($"Image host '{uri.Host}' is not allowed.");
        }

        return await http.GetByteArrayAsync(uri, ct);
    }
}

/// <summary>
/// Blocks Server-Side Request Forgery: rejects URLs that resolve to loopback, link-local,
/// cloud-metadata, or private/internal address ranges. Used both for an up-front check (clear error)
/// and at TCP connect time (defeats DNS rebinding).
/// </summary>
public static class SsrfGuard
{
    /// <summary>True if the address is loopback, link-local, multicast, or in a private/reserved range.</summary>
    public static bool IsBlocked(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6)
        {
            address = address.MapToIPv4();
        }

        if (IPAddress.IsLoopback(address)
            || address.IsIPv6LinkLocal
            || address.IsIPv6SiteLocal
            || address.IsIPv6Multicast)
        {
            return true;
        }

        var bytes = address.GetAddressBytes();

        if (address.AddressFamily == AddressFamily.InterNetwork)
        {
            return bytes[0] switch
            {
                0 => true,                                         // 0.0.0.0/8 "this network"
                10 => true,                                        // 10.0.0.0/8 private
                127 => true,                                       // loopback (already covered, kept explicit)
                169 when bytes[1] == 254 => true,                  // 169.254.0.0/16 link-local + cloud metadata
                172 when bytes[1] >= 16 && bytes[1] <= 31 => true, // 172.16.0.0/12 private
                192 when bytes[1] == 168 => true,                  // 192.168.0.0/16 private
                100 when bytes[1] >= 64 && bytes[1] <= 127 => true,// 100.64.0.0/10 CGNAT
                >= 224 => true,                                    // multicast/reserved/broadcast
                _ => false
            };
        }

        // IPv6 unique local addresses fc00::/7.
        return address.AddressFamily == AddressFamily.InterNetworkV6 && (bytes[0] & 0xFE) == 0xFC;
    }

    /// <summary>
    /// Resolves a host and returns true if it has no usable address or any resolved address is
    /// blocked (fail closed). Use before issuing a request for a clear rejection.
    /// </summary>
    public static async Task<bool> IsHostBlockedAsync(string host, CancellationToken ct)
    {
        if (IPAddress.TryParse(host, out var literal))
        {
            return IsBlocked(literal);
        }

        IPAddress[] resolved;
        try
        {
            resolved = await Dns.GetHostAddressesAsync(host, ct);
        }
        catch (SocketException)
        {
            return true; // Can't resolve → don't fetch.
        }

        return resolved.Length == 0 || resolved.Any(IsBlocked);
    }
}

/// <summary>
/// The in-process entry point: manage client PDF templates and render data onto them. Authoring
/// (Create/SaveMap/SetActive) is used by the admin; <see cref="RenderAsync"/> stamps data at runtime.
/// </summary>
public interface IPdfOverlayTemplates
{
    /// <summary>Stores a new client PDF template (version 1, empty map). Throws if the bytes aren't a readable PDF.</summary>
    Task<TemplateSummary> CreateAsync(
        string clientId, string displayName, string documentType, byte[] pdf, CancellationToken ct = default);

    Task<IReadOnlyList<TemplateSummary>> ListAsync(
        string? clientId = null, string? documentType = null, bool? active = null, CancellationToken ct = default);

    Task<TemplateDetail?> GetAsync(string templateId, CancellationToken ct = default);

    Task<IReadOnlyList<int>?> GetVersionsAsync(string templateId, CancellationToken ct = default);

    /// <summary>Replaces the field map, creating a new immutable version. Null if not found.</summary>
    Task<TemplateSummary?> SaveMapAsync(string templateId, FieldMap map, CancellationToken ct = default);

    /// <summary>Sets the active flag (true = published, false = inactive). Versions remain. False if not found.</summary>
    Task<bool> SetActiveAsync(string templateId, bool active, CancellationToken ct = default);

    /// <summary>Returns the original (unstamped) template PDF bytes. Null if not found.</summary>
    Task<byte[]?> GetOriginalAsync(string templateId, int? version = null, CancellationToken ct = default);

    /// <summary>
    /// Stamps <paramref name="data"/> (keyed by field id) onto the template and returns the finished PDF.
    /// Image fields take a URL/data-URI/base64 string (resolved + SSRF-guarded) or raw bytes.
    /// </summary>
    Task<byte[]> RenderAsync(
        string templateId, IReadOnlyDictionary<string, string?> data, int? version = null, CancellationToken ct = default);

    /// <summary>
    /// Like <see cref="RenderAsync"/>, but <paramref name="dataByPath"/> is keyed by
    /// <see cref="FieldMapping.DataBinding"/> path (e.g. <c>pod.podName</c>).
    /// </summary>
    Task<byte[]> RenderBoundAsync(
        string templateId, IReadOnlyDictionary<string, string?> dataByPath, int? version = null, CancellationToken ct = default);
}

/// <summary>
/// Default <see cref="IPdfOverlayTemplates"/>: ties the template store, image resolution, and the pure
/// renderer together. Authoring delegates to the store; rendering fetches the source, resolves any image
/// fields to bytes (SSRF-guarded), then calls the renderer — which never sees a URL.
/// </summary>
public sealed class PdfOverlayTemplates(
    ITemplateStore store, IImageResolver images, IPdfOverlayRenderer renderer) : IPdfOverlayTemplates
{
    public Task<TemplateSummary> CreateAsync(
        string clientId, string displayName, string documentType, byte[] pdf, CancellationToken ct = default)
    {
        if (!PdfInspector.TryGetPageCount(pdf, out var pageCount))
        {
            throw new ArgumentException("The supplied bytes are not a readable, unencrypted PDF.", nameof(pdf));
        }

        return store.CreateAsync(clientId, displayName, documentType, pdf, pageCount, ct);
    }

    public Task<IReadOnlyList<TemplateSummary>> ListAsync(
        string? clientId = null, string? documentType = null, bool? active = null, CancellationToken ct = default) =>
        store.ListAsync(clientId, documentType, active, ct);

    public Task<TemplateDetail?> GetAsync(string templateId, CancellationToken ct = default) =>
        store.GetAsync(templateId, ct);

    public Task<IReadOnlyList<int>?> GetVersionsAsync(string templateId, CancellationToken ct = default) =>
        store.GetVersionsAsync(templateId, ct);

    public Task<TemplateSummary?> SaveMapAsync(string templateId, FieldMap map, CancellationToken ct = default) =>
        store.SaveMapAsync(templateId, map, ct);

    public Task<bool> SetActiveAsync(string templateId, bool active, CancellationToken ct = default) =>
        store.SetActiveAsync(templateId, active, ct);

    public Task<byte[]?> GetOriginalAsync(string templateId, int? version = null, CancellationToken ct = default) =>
        store.GetOriginalPdfAsync(templateId, version, ct);

    public Task<byte[]> RenderAsync(
        string templateId, IReadOnlyDictionary<string, string?> data, int? version = null, CancellationToken ct = default) =>
        RenderCoreAsync(templateId, version, data, byPath: false, ct);

    public Task<byte[]> RenderBoundAsync(
        string templateId, IReadOnlyDictionary<string, string?> dataByPath, int? version = null, CancellationToken ct = default) =>
        RenderCoreAsync(templateId, version, dataByPath, byPath: true, ct);

    private async Task<byte[]> RenderCoreAsync(
        string templateId, int? version, IReadOnlyDictionary<string, string?> data, bool byPath, CancellationToken ct)
    {
        var source = await store.GetRenderSourceAsync(templateId, version, ct)
            ?? throw new TemplateNotFoundException(templateId);

        // Path mode hands the values to the shared resolver (keyed by binding path → field id); id mode
        // keys directly. Either way we end with an id-keyed set to feed the renderer.
        var byId = byPath
            ? BindingResolver.ResolveById(source.Map, data.ToDictionary(kv => kv.Key, object? (kv) => kv.Value, StringComparer.Ordinal))
            : source.Map.Fields
                .Where(f => data.TryGetValue(f.Id, out var v) && v is not null)
                .ToDictionary(f => f.Id, object? (f) => data[f.Id], StringComparer.Ordinal);

        var resolved = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var field in source.Map.Fields)
        {
            if (!byId.TryGetValue(field.Id, out var value) || value is null)
            {
                continue;
            }

            // Image fields given as a string (URL/data-URI/base64) are resolved to bytes; raw bytes pass through.
            resolved[field.Id] = field.Type == FieldType.Image && value is string reference
                ? await images.ResolveAsync(reference, ct)
                : value;
        }

        return renderer.Render(source.Pdf, source.Map, resolved);
    }
}
