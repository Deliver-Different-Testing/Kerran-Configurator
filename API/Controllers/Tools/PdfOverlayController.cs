using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.PdfOverlay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Tools
{
    /// <summary>
    /// Admin surface for the PDF Overlay tool (folded in from the standalone pdf-overlay-tool):
    /// upload a customer PDF template, define a visual field map, version it, and render a preview.
    /// DF-Admin only. Request/response bodies use the field-map.json contract (camelCase + string
    /// enums) via <see cref="FieldMapJson.Options"/>, bypassing the app's Newtonsoft MVC pipeline so
    /// the wire format stays identical to what S3 stores and the renderer consumes.
    /// </summary>
    [Route("api/pdf-overlay")]
    [ApiController]
    [Authorize(Policy = "AdminOnly")]
    public class PdfOverlayController(IPdfOverlayTemplates templates) : BaseController
    {
        // ---- Templates --------------------------------------------------------

        /// <summary>Upload a new template. Multipart: file + clientId + displayName + documentType.</summary>
        [HttpPost("templates")]
        public async Task<IActionResult> Upload(CancellationToken ct)
        {
            if (!Request.HasFormContentType)
            {
                return BadRequest("Expected multipart/form-data with a 'file' part.");
            }

            var form = await Request.ReadFormAsync(ct);
            var file = form.Files["file"];
            var clientId = form["clientId"].ToString();
            var displayName = form["displayName"].ToString();
            var documentType = form["documentType"].ToString();

            if (file is null || file.Length == 0
                || string.IsNullOrWhiteSpace(clientId)
                || string.IsNullOrWhiteSpace(displayName)
                || string.IsNullOrWhiteSpace(documentType))
            {
                return BadRequest("file, clientId, displayName and documentType are all required.");
            }

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms, ct);

            try
            {
                var summary = await templates.CreateAsync(clientId, displayName, documentType, ms.ToArray(), ct);
                Response.Headers.Location = $"/api/pdf-overlay/templates/{summary.TemplateId}";
                return Json(summary, 201);
            }
            catch (ArgumentException ex)
            {
                // Not a readable/unencrypted PDF, or an invalid clientId.
                return BadRequest(ex.Message);
            }
        }

        /// <summary>List templates for the current tenant; optional clientId / documentType / active filters.</summary>
        [HttpGet("templates")]
        public async Task<IActionResult> List(
            [FromQuery] string? clientId, [FromQuery] string? documentType, [FromQuery] bool? active, CancellationToken ct) =>
            Json(await templates.ListAsync(clientId, documentType, active, ct));

        /// <summary>Template metadata + current field map.</summary>
        [HttpGet("templates/{id}")]
        public async Task<IActionResult> Get(string id, CancellationToken ct) =>
            await templates.GetAsync(id, ct) is { } detail ? Json(detail) : NotFound();

        /// <summary>List the immutable version numbers for a template.</summary>
        [HttpGet("templates/{id}/versions")]
        public async Task<IActionResult> Versions(string id, CancellationToken ct) =>
            await templates.GetVersionsAsync(id, ct) is { } versions ? Json(versions) : NotFound();

        /// <summary>Replace the field map, creating a new immutable version.</summary>
        [HttpPut("templates/{id}/map")]
        public async Task<IActionResult> SaveMap(string id, CancellationToken ct)
        {
            FieldMap map;
            try
            {
                map = FieldMapJson.Deserialize(await ReadBodyAsync(ct));
            }
            catch (JsonException ex)
            {
                return BadRequest($"Invalid field map: {ex.Message}");
            }

            // Reject blank/duplicate field ids before persisting: id is the renderer's data key.
            if (map.Validate() is { Count: > 0 } errors)
            {
                return ValidationProblem(new ValidationProblemDetails(
                    new Dictionary<string, string[]> { ["fields"] = errors.ToArray() }));
            }

            return await templates.SaveMapAsync(id, map, ct) is { } summary ? Json(summary) : NotFound();
        }

        /// <summary>Publish (true) or deactivate (false) a template. Body: { "active": bool }.</summary>
        [HttpPut("templates/{id}/active")]
        public async Task<IActionResult> SetActive(string id, CancellationToken ct)
        {
            bool active;
            try
            {
                using var doc = JsonDocument.Parse(await ReadBodyAsync(ct));
                active = doc.RootElement.GetProperty("active").GetBoolean();
            }
            catch (Exception)
            {
                return BadRequest("Body must be { \"active\": true | false }.");
            }

            return await templates.SetActiveAsync(id, active, ct) ? NoContent() : NotFound();
        }

        /// <summary>
        /// Render the template with the supplied data and return the finished PDF inline. Body:
        /// { "data": { ... }, "bindingMode"?: "id" | "path", "version"?: N }. For the admin preview
        /// the SPA posts placeholder values keyed by field id.
        /// </summary>
        [HttpPost("templates/{id}/render")]
        public async Task<IActionResult> Render(string id, CancellationToken ct)
        {
            RenderRequestDto body;
            try
            {
                body = JsonSerializer.Deserialize<RenderRequestDto>(await ReadBodyAsync(ct), FieldMapJson.Options)
                       ?? new RenderRequestDto();
            }
            catch (JsonException ex)
            {
                return BadRequest($"Invalid render request: {ex.Message}");
            }

            var data = body.Data.ToDictionary(kv => kv.Key, kv => ToValue(kv.Value));
            var byPath = string.Equals(body.BindingMode, "path", StringComparison.OrdinalIgnoreCase);

            try
            {
                var pdf = byPath
                    ? await templates.RenderBoundAsync(id, data, body.Version, ct)
                    : await templates.RenderAsync(id, data, body.Version, ct);
                return File(pdf, "application/pdf", $"{id}.pdf");
            }
            catch (TemplateNotFoundException)
            {
                return NotFound();
            }
            catch (TemplateVersionNotFoundException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (ImageResolutionException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Download the original (unstamped) template PDF — drives the admin canvas.</summary>
        [HttpGet("templates/{id}/original")]
        public async Task<IActionResult> Original(string id, [FromQuery] int? version, CancellationToken ct) =>
            await templates.GetOriginalAsync(id, version, ct) is { } bytes
                ? File(bytes, "application/pdf")
                : NotFound();

        // ---- Helpers ----------------------------------------------------------

        private async Task<string> ReadBodyAsync(CancellationToken ct)
        {
            using var reader = new StreamReader(Request.Body);
            return await reader.ReadToEndAsync(ct);
        }

        /// <summary>Serialize with the field-map.json contract so enums/casing match the SPA + S3.</summary>
        private ContentResult Json(object value, int statusCode = 200) => new()
        {
            Content = JsonSerializer.Serialize(value, FieldMapJson.Options),
            ContentType = "application/json",
            StatusCode = statusCode
        };

        /// <summary>JSON value → the renderer's expected value: strings pass through; numbers/bools stringify.</summary>
        private static string? ToValue(JsonElement e) => e.ValueKind switch
        {
            JsonValueKind.String => e.GetString(),
            JsonValueKind.Number => e.ToString(),
            JsonValueKind.True => bool.TrueString,
            JsonValueKind.False => bool.FalseString,
            JsonValueKind.Null or JsonValueKind.Undefined => null,
            _ => e.GetRawText()
        };

        private sealed class RenderRequestDto
        {
            public Dictionary<string, JsonElement> Data { get; set; } = new();
            public string BindingMode { get; set; } = "id";
            public int? Version { get; set; }
        }
    }
}
