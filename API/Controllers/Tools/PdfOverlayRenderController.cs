using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.PdfOverlay;
using DfrntDriveConfigurator.Core.PdfOverlay;
using DfrntDriveConfigurator.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Tools
{
    /// <summary>
    /// M2M (machine-to-machine) render endpoint for the PDF Overlay tool — the consumer path from the
    /// ADR. Trusted internal apps (DespatchWeb button, AutomationEngine rule) pass a tenant + jobId and
    /// get a finished PDF. Authenticated by a shared API key (not the cookie), so it is <c>[AllowAnonymous]</c>
    /// and exempt from the browser CSRF check (see Program.cs). The caller passes <c>tenantId</c> because
    /// there is no login claim; it is stamped as the per-request tenant override so both the Despatch DB
    /// and the S3 template store resolve to that tenant.
    /// </summary>
    [Route("api/pdf-overlay/render-job")]
    [ApiController]
    [AllowAnonymous]
    public class PdfOverlayRenderController(JobPodAssembler assembler, AppSettings settings) : ControllerBase
    {
        [HttpPost]
        public async Task<IActionResult> RenderJob(CancellationToken ct)
        {
            // --- Auth: shared API key ------------------------------------------------
            if (string.IsNullOrEmpty(settings.PdfOverlayRenderApiKey))
            {
                return StatusCode(503, "PDF Overlay render endpoint is not configured.");
            }

            var presentedKey = Request.Headers["X-Api-Key"].ToString();
            if (!FixedTimeEquals(presentedKey, settings.PdfOverlayRenderApiKey))
            {
                return Unauthorized();
            }

            // --- Parse body ----------------------------------------------------------
            string tenantId, documentType, templateId;
            int jobId;
            try
            {
                using var doc = JsonDocument.Parse(await new StreamReader(Request.Body).ReadToEndAsync(ct));
                var root = doc.RootElement;
                tenantId = root.TryGetProperty("tenantId", out var t) ? t.GetString() ?? "" : "";
                jobId = root.TryGetProperty("jobId", out var j) ? j.GetInt32() : 0;
                documentType = root.TryGetProperty("documentType", out var d) ? d.GetString() ?? "" : "";
                templateId = root.TryGetProperty("templateId", out var tid) ? tid.GetString() ?? "" : "";
            }
            catch (Exception)
            {
                return BadRequest("Body must be JSON: { tenantId, jobId, documentType | templateId }.");
            }

            if (string.IsNullOrWhiteSpace(tenantId) || jobId <= 0
                || (string.IsNullOrWhiteSpace(documentType) && string.IsNullOrWhiteSpace(templateId)))
            {
                return BadRequest("tenantId, jobId, and one of documentType | templateId are required.");
            }

            // Stamp the tenant for this request — both the Despatch DB factory and the PDF-overlay
            // template store read this before any cookie claim. Must be set BEFORE resolving the
            // template service (its S3 store binds the tenant at construction).
            HttpContext.Items[DynamicDespatchDbContextFactory.OverrideTenantIdItemsKey] = tenantId;

            var messageId = Guid.NewGuid();
            Log.Information("(render-job {MessageId}) tenant {Tenant} job {JobId} docType {DocType}",
                messageId, tenantId, jobId, documentType);

            // --- Assemble the job's POD data ----------------------------------------
            var assembly = await assembler.AssembleAsync(jobId, ct);
            if (assembly is null)
            {
                return NotFound($"Job {jobId} not found.");
            }

            // --- Resolve the template ------------------------------------------------
            var templates = HttpContext.RequestServices.GetRequiredService<IPdfOverlayTemplates>();

            if (string.IsNullOrWhiteSpace(templateId))
            {
                if (string.IsNullOrWhiteSpace(assembly.ClientCode))
                {
                    return NotFound($"Job {jobId} has no client, so no template could be resolved.");
                }

                var active = await templates.ListAsync(assembly.ClientCode, documentType, active: true, ct);
                var chosen = active.OrderByDescending(s => s.UpdatedAt).FirstOrDefault();
                if (chosen is null)
                {
                    return NotFound($"No active '{documentType}' template for client '{assembly.ClientCode}'.");
                }

                templateId = chosen.TemplateId;
            }

            // --- Render --------------------------------------------------------------
            try
            {
                var pdf = await templates.RenderBoundAsync(templateId, assembly.Bindings, version: null, ct);
                return File(pdf, "application/pdf", $"{jobId}.pdf");
            }
            catch (TemplateNotFoundException)
            {
                return NotFound($"Template '{templateId}' not found.");
            }
            catch (ImageResolutionException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Length-aware constant-time-ish compare so the key check doesn't leak via timing.</summary>
        private static bool FixedTimeEquals(string a, string b)
        {
            if (string.IsNullOrEmpty(a) || a.Length != b.Length)
            {
                return false;
            }

            var diff = 0;
            for (var i = 0; i < a.Length; i++)
            {
                diff |= a[i] ^ b[i];
            }

            return diff == 0;
        }
    }
}
