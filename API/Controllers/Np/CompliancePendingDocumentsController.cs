using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

/// <summary>
/// Tenant-wide list of business documents whose VerifyStatus = 'Pending', used
/// by the redesigned Compliance Monitoring action queue. Mirrors the per-agent
/// endpoint at <see cref="AgentDocumentsController.List"/> but flattens across
/// every agent in scope and includes the subject's name/city/state so the
/// front-end can render each row without a join.
///
/// Spec: dfrntdrive_configurator/docs/STEVE-COMPLIANCE-MONITORING-REDESIGN-2026-06-13.md §6.
///
/// Tenant staff / DF-admin only — NPs are excluded because the redesigned
/// monitoring page is a tenant-staff surface; NPs continue to use the per-row
/// `My Documents` view.
/// </summary>
[Route("api/v1/np/compliance/pending-documents")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdminNoNp")]
public class CompliancePendingDocumentsController(AgentDocumentService service) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await service.ListPendingAsync(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Items);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to list pending documents");
            throw;
        }
    }
}
