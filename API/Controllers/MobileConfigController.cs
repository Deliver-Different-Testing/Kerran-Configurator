using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers
{
    [Route("api/mobile")]
    [ApiController]
    [Authorize(Policy = "AdminOnly")]
    public class MobileConfigController : BaseController
    {
        private readonly AppConfigService _appConfigService;
        private readonly WorkflowTemplateService _workflowTemplateService;

        public MobileConfigController(AppConfigService appConfigService, WorkflowTemplateService workflowTemplateService)
        {
            _appConfigService = appConfigService;
            _workflowTemplateService = workflowTemplateService;
        }

        /// <summary>
        /// GET /api/mobile/config
        /// Returns feature flags, branding, and support tasks for the DF Drive app.
        /// Called at login by the mobile app.
        /// </summary>
        [HttpGet("config")]
        public async Task<IActionResult> GetConfig()
        {
            try
            {
                Guid messageId = Guid.NewGuid();
                Log.Information($"({Request.Method} {Request.Path}): {messageId}");

                return HandleResponseNoLogging(await _appConfigService.GetMobileConfig(messageId));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }

        /// <summary>
        /// GET /api/mobile/workflow?jobId=X
        /// Returns the resolved workflow for a specific job.
        /// 
        /// WORKFLOW RESOLUTION CHAIN:
        /// ==========================
        /// The workflow is resolved using a priority chain (most specific → least specific):
        /// 
        ///   1. Client + ServiceType  → e.g., "Acme Corp" + "Express" = custom workflow
        ///   2. Client only           → e.g., "Acme Corp" default workflow  
        ///   3. ServiceType only      → e.g., all "Express" jobs use this workflow
        ///   4. Tenant Default        → fallback for the tenant (no client/service filter)
        ///   5. System Fallback       → empty workflow if nothing is configured at all
        /// 
        /// ACCESSORIAL TASK INJECTION:
        /// ============================
        /// After resolving the base workflow, accessorial tasks are injected:
        /// 
        ///   1. Resolve base workflow from chain above
        ///   2. Get job's AccessorialChargeGroupId → load group members
        ///   3. Load AccessorialWorkflowTask rows for those charges
        ///   4. Merge accessorial tasks into base workflow (by stage, respecting sequence)
        ///   5. Return combined workflow with source="template" or source="accessorial" per step
        /// 
        /// AGENT PORTAL MIRRORING:
        /// ========================
        /// If the resolved template has MirrorToAgentPortal = true, the response includes
        /// mirrorToAgentPortal = true so the Agent Portal (InboundAgent) knows to display
        /// the same workflow steps to Network Partners.
        /// </summary>
        [HttpGet("workflow")]
        public async Task<IActionResult> GetWorkflow([FromQuery] int jobId)
        {
            try
            {
                Guid messageId = Guid.NewGuid();
                Log.Information($"({Request.Method} {Request.Path}): jobId={jobId}");

                return HandleResponseNoLogging(await _workflowTemplateService.ResolveForJob(jobId, messageId));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }

        /// <summary>
        /// POST /api/jobs/{jobId}/workflow/{stepId}
        /// Submit workflow step completion from the mobile app.
        /// PLACEHOLDER — actual implementation depends on file upload infrastructure (S3/blob storage).
        /// </summary>
        [HttpPost("/api/jobs/{jobId}/workflow/{stepId}")]
        public async Task<IActionResult> SubmitStepCompletion([FromRoute] int jobId, [FromRoute] int stepId)
        {
            try
            {
                Log.Information($"({Request.Method} {Request.Path}): jobId={jobId}, stepId={stepId}");

                // TODO: Implement step completion with file upload support
                // 1. Accept multipart form data (text, image, signature, barcode)
                // 2. Upload blobs to S3/Azure Blob Storage
                // 3. Create JobWorkflowStep record
                // 4. Return updated workflow status

                var response = new BaseResponse(Guid.NewGuid())
                {
                    Success = false
                };
                response.Messages.Add(new MessageDto
                {
                    Message = "Step completion endpoint is a placeholder. Implement with file upload infrastructure."
                });

                return HandleResponse(response);
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }
    }
}
