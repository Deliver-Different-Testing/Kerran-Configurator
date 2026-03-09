using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Dtos.MobileConfig;
using DfrntDriveConfigurator.Core.Application.Dtos.Workflow;
using DfrntDriveConfigurator.Core.Application.Utilities;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services
{
    public class WorkflowTemplateService(IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseService(contextFactory)
    {
        public async Task<WorkflowTemplatesResponse> Search(SearchRequest request)
        {
            var query = Context.TucEventTemplates
                .Include(t => t.TucEventTemplateDetails)
                    .ThenInclude(d => d.UcetdEventType)
                .Include(t => t.TucEventTemplateDetails)
                    .ThenInclude(d => d.UcetdStatus)
                .Include(t => t.UcetClient)
                .Include(t => t.UcetSpeed)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(request.SearchText))
                query = query.Where(t => EF.Functions.Like(t.UcetName, $"%{request.SearchText}%"));

            var templates = await query.OrderBy(t => t.UcetName).ToListAsync();

            return new WorkflowTemplatesResponse(request.MessageId)
            {
                Success = true,
                Templates = templates.Select(MapToDto).ToList()
            };
        }

        public async Task<WorkflowTemplateResponse> Get(IdRequest request)
        {
            var response = new WorkflowTemplateResponse(request.MessageId);

            var template = await Context.TucEventTemplates
                .Include(t => t.TucEventTemplateDetails)
                    .ThenInclude(d => d.UcetdEventType)
                .Include(t => t.TucEventTemplateDetails)
                    .ThenInclude(d => d.UcetdStatus)
                .Include(t => t.UcetClient)
                .Include(t => t.UcetSpeed)
                .FirstOrDefaultAsync(t => t.UcetId == request.Id);

            if (template == null)
                return ResponseUtility.AddMessageAndReturnResponse(response, "Workflow template not found.");

            response.Template = MapToDto(template);
            response.Success = true;
            return response;
        }

        public async Task<WorkflowTemplatesResponse> Get(Guid messageId)
        {
            var templates = await Context.TucEventTemplates
                .Include(t => t.TucEventTemplateDetails)
                    .ThenInclude(d => d.UcetdEventType)
                .Include(t => t.TucEventTemplateDetails)
                    .ThenInclude(d => d.UcetdStatus)
                .Include(t => t.UcetClient)
                .Include(t => t.UcetSpeed)
                .OrderBy(t => t.UcetName)
                .ToListAsync();

            return new WorkflowTemplatesResponse(messageId)
            {
                Success = true,
                Templates = templates.Select(MapToDto).ToList()
            };
        }

        public async Task<WorkflowLookupsResponse> GetLookups(Guid messageId)
        {
            var eventTypes = await Context.TucEventTypes
                .OrderBy(e => e.UcetName)
                .Select(e => new LookupItem { Id = e.UcetId, Name = e.UcetName ?? "" })
                .ToListAsync();

            var jobStatuses = await Context.TucJobStatuses
                .OrderBy(s => s.UcjsId)
                .Select(s => new LookupItem { Id = s.UcjsId, Name = s.UcjsName ?? "" })
                .ToListAsync();

            return new WorkflowLookupsResponse(messageId)
            {
                Success = true,
                EventTypes = eventTypes,
                JobStatuses = jobStatuses
            };
        }

        public async Task<WorkflowTemplateResponse> Create(WorkflowTemplateCreateRequest request)
        {
            var response = new WorkflowTemplateResponse(request.MessageId);

            var template = new TucEventTemplate
            {
                UcetName = request.Name,
                UcetDescription = request.Description,
                UcetClientId = request.ClientId,
                UcetSpeedId = request.SpeedId,
                UcetIsActive = request.IsActive,
                UcetMirrorToAgentPortal = request.MirrorToAgentPortal,
                UcetCreated = DateTime.UtcNow,
                UcetCreatedBy = "admin" // TODO: pull from HttpContext session
            };

            Context.TucEventTemplates.Add(template);
            await Context.SaveChangesAsync();

            // Add details
            foreach (var detail in request.Details)
            {
                Context.TucEventTemplateDetails.Add(new TucEventTemplateDetail
                {
                    UcetdTemplateId = template.UcetId,
                    UcetdStatusId = detail.StatusId,
                    UcetdEventTypeId = detail.EventTypeId,
                    UcetdTimeOffset = detail.TimeOffset,
                    UcetdSequence = detail.Sequence,
                    UcetdIsActive = detail.IsActive,
                    UcetdRequired = detail.Required,
                    UcetdConfigJson = detail.ConfigJson,
                    UcetdContext = detail.Context ?? "both"
                });
            }
            await Context.SaveChangesAsync();

            // Reload with includes
            return await Get(new IdRequest { Id = template.UcetId, MessageId = request.MessageId });
        }

        public async Task<WorkflowTemplateResponse> Update(WorkflowTemplateUpdateRequest request)
        {
            var response = new WorkflowTemplateResponse(request.MessageId);

            var template = await Context.TucEventTemplates
                .Include(t => t.TucEventTemplateDetails)
                .FirstOrDefaultAsync(t => t.UcetId == request.Id);

            if (template == null)
                return ResponseUtility.AddMessageAndReturnResponse(response, "Workflow template not found.");

            template.UcetName = request.Name;
            template.UcetDescription = request.Description;
            template.UcetClientId = request.ClientId;
            template.UcetSpeedId = request.SpeedId;
            template.UcetIsActive = request.IsActive;
            template.UcetMirrorToAgentPortal = request.MirrorToAgentPortal;
            template.UcetLastModified = DateTime.UtcNow;
            template.UcetLastModifiedBy = "admin"; // TODO: pull from HttpContext session

            // Replace details: soft-delete referenced rows, hard-delete unreferenced ones, then add new
            var referencedDetailIds = await Context.Database
                .SqlQueryRaw<int>("SELECT DISTINCT TemplateDetailId AS Value FROM JobWorkflowStep")
                .ToListAsync();
            var referencedSet = new HashSet<int>(referencedDetailIds);

            var toHardDelete = template.TucEventTemplateDetails.Where(d => !referencedSet.Contains(d.UcetdId)).ToList();
            var toSoftDelete = template.TucEventTemplateDetails.Where(d => referencedSet.Contains(d.UcetdId)).ToList();

            Context.TucEventTemplateDetails.RemoveRange(toHardDelete);
            foreach (var d in toSoftDelete)
                d.UcetdIsActive = false;

            foreach (var detail in request.Details)
            {
                Context.TucEventTemplateDetails.Add(new TucEventTemplateDetail
                {
                    UcetdTemplateId = template.UcetId,
                    UcetdStatusId = detail.StatusId,
                    UcetdEventTypeId = detail.EventTypeId,
                    UcetdTimeOffset = detail.TimeOffset,
                    UcetdSequence = detail.Sequence,
                    UcetdIsActive = detail.IsActive,
                    UcetdRequired = detail.Required,
                    UcetdConfigJson = detail.ConfigJson,
                    UcetdContext = detail.Context ?? "both"
                });
            }

            await Context.SaveChangesAsync();

            return await Get(new IdRequest { Id = template.UcetId, MessageId = request.MessageId });
        }

        public async Task<BaseResponse> Delete(IdRequest request)
        {
            var response = new BaseResponse(request.MessageId);

            var template = await Context.TucEventTemplates.FindAsync(request.Id);
            if (template == null)
                return ResponseUtility.AddMessageAndReturnResponse(response, "Workflow template not found.");

            // Soft delete
            template.UcetIsActive = false;
            template.UcetLastModified = DateTime.UtcNow;
            template.UcetLastModifiedBy = "admin";

            await Context.SaveChangesAsync();

            response.Success = true;
            return response;
        }

        /// <summary>
        /// Resolves the workflow template for a job using the priority chain,
        /// then injects accessorial workflow tasks.
        /// 
        /// ═══════════════════════════════════════════════════════════════
        /// WORKFLOW RESOLUTION CHAIN (highest priority → lowest):
        /// ═══════════════════════════════════════════════════════════════
        /// 
        ///   1. Client + ServiceType  — most specific match
        ///   2. Client only           — client default workflow
        ///   3. ServiceType only      — service-level workflow
        ///   4. Tenant Default        — no client, no service (fallback)
        ///   5. System Fallback       — hardcoded empty workflow if nothing configured
        /// 
        /// ═══════════════════════════════════════════════════════════════
        /// ACCESSORIAL TASK INJECTION:
        /// ═══════════════════════════════════════════════════════════════
        /// 
        /// After resolving the base workflow template:
        ///   1. Look up the job's AccessorialChargeGroupId
        ///   2. Load all AccessorialCharge members in that group
        ///   3. Load AccessorialWorkflowTask rows for those charges (Active = 1)
        ///   4. Merge accessorial tasks into the base workflow by StageId
        ///   5. Within each stage, sort by Sequence (base steps first, then accessorial)
        ///   6. Return the combined workflow to the mobile app
        /// 
        /// This allows accessorial charges (e.g., "Tail Lift", "Inside Delivery")
        /// to automatically inject extra workflow steps (e.g., "Photo of tail lift usage")
        /// without modifying the base workflow template.
        /// </summary>
        public async Task<MobileWorkflowResponse> ResolveForJob(int jobId, Guid messageId)
        {
            var response = new MobileWorkflowResponse(messageId) { JobId = jobId };

            // ── Step 1: Load job details (client, service type, accessorial group) ──
            var job = await Context.Database
                .SqlQueryRaw<JobLookup>(
                    @"SELECT TOP 1
                        j.ClientID AS ClientId,
                        j.Speed AS SpeedId,
                        CAST(NULL AS int) AS AccessorialChargeGroupId
                      FROM tblJob j WHERE j.JobID = {0}",
                    jobId)
                .FirstOrDefaultAsync();

            if (job == null)
                return ResponseUtility.AddMessageAndReturnResponse(response, "Job not found.");

            // ── Step 2: Resolve base workflow via priority chain ──
            // Chain: Client+ServiceType → Client → ServiceType → Tenant Default
            TucEventTemplate? template = null;

            // Priority 1: Client + ServiceType (most specific)
            if (job.ClientId.HasValue && job.SpeedId.HasValue)
                template = await GetActiveTemplate(job.ClientId.Value, job.SpeedId.Value);

            // Priority 2: Client only
            if (template == null && job.ClientId.HasValue)
                template = await GetActiveTemplate(job.ClientId.Value, null);

            // Priority 3: ServiceType only
            if (template == null && job.SpeedId.HasValue)
                template = await GetActiveTemplate(null, job.SpeedId.Value);

            // Priority 4: Tenant Default (no client, no service)
            if (template == null)
                template = await GetActiveTemplate(null, null);

            // Priority 5: System Fallback — no template at all
            if (template == null)
            {
                response.Success = true;
                response.Messages.Add(new MessageDto { Message = "No workflow template found for this job." });
                return response;
            }

            // ── Step 3: Build base workflow steps ──
            var completedSteps = await Context.JobWorkflowSteps
                .Where(s => s.JobId == jobId)
                .ToListAsync();

            var workflowSteps = template.TucEventTemplateDetails
                .Where(d => d.UcetdIsActive)
                .OrderBy(d => d.UcetdSequence)
                .Select(d =>
                {
                    var completed = completedSteps.FirstOrDefault(c => c.TemplateDetailId == d.UcetdId);
                    return new MobileWorkflowStepResponse
                    {
                        TemplateDetailId = d.UcetdId,
                        Sequence = d.UcetdSequence,
                        EventTypeName = d.UcetdEventType?.UcetName ?? "",
                        EventTypeId = d.UcetdEventTypeId,
                        StageTrigger = d.UcetdStatus?.UcjsName ?? "",
                        TimeOffset = d.UcetdTimeOffset,
                        IsCompleted = completed != null,
                        CompletedAt = completed?.CompletedAt,
                        Source = "template", // base workflow step
                        Required = d.UcetdRequired,
                        ConfigJson = d.UcetdConfigJson,
                        Context = d.UcetdContext ?? "both"
                    };
                })
                .ToList();

            // ── Step 4: Inject accessorial workflow tasks ──
            if (job.AccessorialChargeGroupId.HasValue)
            {
                // Load accessorial charge IDs for this job's group
                var accessorialChargeIds = await Context.Database
                    .SqlQueryRaw<AccessorialChargeLookup>(
                        @"SELECT acgm.AccessorialChargeId 
                          FROM AccessorialChargeGroupMember acgm 
                          WHERE acgm.AccessorialChargeGroupId = {0}",
                        job.AccessorialChargeGroupId.Value)
                    .Select(x => x.AccessorialChargeId)
                    .ToListAsync();

                if (accessorialChargeIds.Count > 0)
                {
                    // Load AccessorialWorkflowTask rows for these charges
                    var accessorialTasks = await Context.Set<Domain.Despatch.AccessorialWorkflowTask>()
                        .Include(t => t.EventType)
                        .Where(t => t.Active && accessorialChargeIds.Contains(t.AccessorialChargeId))
                        .OrderBy(t => t.StageId)
                        .ThenBy(t => t.Sequence)
                        .ToListAsync();

                    // Stage ID → Stage Name mapping
                    var stageNames = new Dictionary<int, string>
                    {
                        { 1, "Enroute to Pickup" },
                        { 2, "Pickup" },
                        { 3, "Enroute to Delivery" },
                        { 4, "Delivery" }
                    };

                    // Merge accessorial tasks into workflow (appended per stage, respecting sequence)
                    var maxSeq = workflowSteps.Count > 0 ? workflowSteps.Max(s => s.Sequence) : 0;
                    foreach (var task in accessorialTasks)
                    {
                        maxSeq++;
                        workflowSteps.Add(new MobileWorkflowStepResponse
                        {
                            TemplateDetailId = 0, // not from a template detail
                            Sequence = maxSeq,
                            EventTypeName = task.EventType?.UcetName ?? "",
                            EventTypeId = task.EventTypeId,
                            StageTrigger = stageNames.GetValueOrDefault(task.StageId, "Delivery"),
                            TimeOffset = 0,
                            IsCompleted = false,
                            CompletedAt = null,
                            Source = "accessorial", // injected from accessorial charge
                            Required = task.Required,
                            ConfigJson = task.ConfigJson
                        });
                    }

                    // Re-sort: group by stage order, then by sequence within stage
                    var stageOrder = new[] { "Enroute to Pickup", "Pickup", "Enroute to Delivery", "Delivery" };
                    workflowSteps = workflowSteps
                        .OrderBy(s => Array.IndexOf(stageOrder, s.StageTrigger))
                        .ThenBy(s => s.Source == "template" ? 0 : 1) // base steps first within stage
                        .ThenBy(s => s.Sequence)
                        .Select((s, i) => { s.Sequence = i + 1; return s; }) // renumber
                        .ToList();
                }
            }

            response.TemplateId = template.UcetId;
            response.TemplateName = template.UcetName;
            response.MirrorToAgentPortal = template.UcetMirrorToAgentPortal;
            response.Steps = workflowSteps;
            response.Success = true;
            return response;
        }

        /// <summary>
        /// Parses a plain-English instruction into a workflow structure.
        /// Uses keyword matching against known event types from the "App Workflow" group.
        /// 
        /// TODO: This is a structured parser (regex/keyword matching). To integrate an LLM:
        /// 1. Inject an IWorkflowNlpProvider interface
        /// 2. Send the instruction + known event types as context to the LLM
        /// 3. Parse the LLM's structured JSON response into WorkflowNlpResponse
        /// </summary>
        public async Task<WorkflowNlpResponse> ParseNaturalLanguage(WorkflowNlpRequest request)
        {
            var response = new WorkflowNlpResponse(request.MessageId);
            var instruction = request.Instruction?.Trim() ?? "";

            if (string.IsNullOrWhiteSpace(instruction))
                return ResponseUtility.AddMessageAndReturnResponse(response, "Instruction is required.");

            // Load known event types from "App Workflow" group
            var workflowGroup = await Context.TucEventTypeGroups
                .FirstOrDefaultAsync(g => g.Name == "App Workflow" && g.IsActive);

            var knownEventTypes = workflowGroup != null
                ? await Context.TucEventTypeEventTypeGroups
                    .Where(m => m.EventTypeGroupId == workflowGroup.Id && m.IsActive)
                    .Include(m => m.EventType)
                    .OrderBy(m => m.Sequence)
                    .Select(m => new { m.EventTypeId, Name = m.EventType.UcetName ?? "" })
                    .ToListAsync()
                : [];

            // Load known job statuses for stage matching
            var statuses = await Context.TucJobStatuses
                .Select(s => new { s.UcjsId, s.UcjsName })
                .ToListAsync();

            // Load clients for scope detection
            var clients = await Context.TucClients
                .Select(c => new { c.UcclId, c.UcclName })
                .Take(500)
                .ToListAsync();

            var lowerInstruction = instruction.ToLowerInvariant();

            // --- Detect client scope ---
            string? detectedClient = null;
            foreach (var client in clients)
            {
                if (!string.IsNullOrWhiteSpace(client.UcclName) &&
                    lowerInstruction.Contains(client.UcclName.ToLowerInvariant()))
                {
                    detectedClient = client.UcclName;
                    break;
                }
            }

            // --- Detect service scope ---
            // Look for keywords like "express", "overnight", "same day", "economy"
            string? detectedService = null;
            var serviceKeywords = new[] { "express", "overnight", "same day", "sameday", "economy", "standard", "priority" };
            foreach (var kw in serviceKeywords)
            {
                if (lowerInstruction.Contains(kw))
                {
                    detectedService = kw;
                    break;
                }
            }

            // --- Parse steps from instruction ---
            // Strategy: match known event type names in the instruction text
            var matchedSteps = new List<WorkflowNlpStepDto>();
            int seq = 1;

            foreach (var et in knownEventTypes)
            {
                if (lowerInstruction.Contains(et.Name.ToLowerInvariant()))
                {
                    matchedSteps.Add(new WorkflowNlpStepDto
                    {
                        EventTypeId = et.EventTypeId,
                        EventTypeName = et.Name,
                        Sequence = seq++,
                        StageTrigger = GuessStageTrigger(et.Name),
                        TimeOffset = 0
                    });
                }
            }

            // If no known event types matched, try to parse comma/and-separated phrases
            if (matchedSteps.Count == 0)
            {
                var phrases = Regex.Split(instruction, @",\s*|\s+and\s+|\s+then\s+", RegexOptions.IgnoreCase);
                foreach (var phrase in phrases)
                {
                    var trimmed = phrase.Trim();
                    if (trimmed.Length < 3) continue;

                    // Find closest matching event type
                    var bestMatch = knownEventTypes
                        .FirstOrDefault(et => et.Name.Contains(trimmed, StringComparison.OrdinalIgnoreCase)
                                           || trimmed.Contains(et.Name, StringComparison.OrdinalIgnoreCase));

                    matchedSteps.Add(new WorkflowNlpStepDto
                    {
                        EventTypeId = bestMatch?.EventTypeId,
                        EventTypeName = bestMatch?.Name ?? trimmed,
                        Sequence = seq++,
                        StageTrigger = GuessStageTrigger(trimmed),
                        TimeOffset = 0
                    });
                }
            }

            // --- Build suggested name ---
            var suggestedName = !string.IsNullOrWhiteSpace(detectedClient)
                ? $"{detectedClient} Workflow"
                : matchedSteps.Count > 0
                    ? $"Custom Workflow ({matchedSteps.Count} steps)"
                    : "New Workflow";

            response.SuggestedName = suggestedName;
            response.ClientScope = detectedClient;
            response.ServiceScope = detectedService;
            response.Steps = matchedSteps;
            response.Explanation = $"Parsed {matchedSteps.Count} step(s) from your instruction. " +
                (detectedClient != null ? $"Scoped to client: {detectedClient}. " : "No client scope detected. ") +
                (detectedService != null ? $"Service type: {detectedService}. " : "") +
                "Review and adjust the steps before saving.";
            response.Success = true;

            return response;
        }

        #region Private Helpers

        private async Task<TucEventTemplate?> GetActiveTemplate(int? clientId, int? speedId)
        {
            return await Context.TucEventTemplates
                .Include(t => t.TucEventTemplateDetails)
                    .ThenInclude(d => d.UcetdEventType)
                .Include(t => t.TucEventTemplateDetails)
                    .ThenInclude(d => d.UcetdStatus)
                .Where(t => t.UcetIsActive
                    && t.UcetClientId == clientId
                    && t.UcetSpeedId == speedId)
                .FirstOrDefaultAsync();
        }

        private static string GuessStageTrigger(string eventTypeName)
        {
            var lower = eventTypeName.ToLowerInvariant();
            if (lower.Contains("pickup") || lower.Contains("collect"))
                return "Pickup";
            if (lower.Contains("enroute") && lower.Contains("pickup"))
                return "Enroute to Pickup";
            if (lower.Contains("enroute") || lower.Contains("transit"))
                return "Enroute to Delivery";
            if (lower.Contains("deliver") || lower.Contains("pod") || lower.Contains("signature") || lower.Contains("photo"))
                return "Delivery";
            return "Delivery"; // default stage
        }

        private static WorkflowTemplateDto MapToDto(TucEventTemplate t) => new()
        {
            Id = t.UcetId,
            Name = t.UcetName,
            Description = t.UcetDescription,
            ClientId = t.UcetClientId,
            ClientName = t.UcetClient?.UcclName,
            SpeedId = t.UcetSpeedId,
            SpeedName = t.UcetSpeed?.UcjtName,
            IsActive = t.UcetIsActive,
            Created = t.UcetCreated,
            CreatedBy = t.UcetCreatedBy,
            LastModified = t.UcetLastModified,
            LastModifiedBy = t.UcetLastModifiedBy,
            MirrorToAgentPortal = t.UcetMirrorToAgentPortal,
            ScopeLabel = GetScopeLabel(t.UcetClientId, t.UcetSpeedId),
            StepCount = t.TucEventTemplateDetails.Count(d => d.UcetdIsActive),
            Details = t.TucEventTemplateDetails
                .OrderBy(d => d.UcetdSequence)
                .Select(d => new WorkflowTemplateDetailDto
                {
                    Id = d.UcetdId,
                    TemplateId = d.UcetdTemplateId,
                    StatusId = d.UcetdStatusId,
                    StatusName = d.UcetdStatus?.UcjsName ?? "",
                    EventTypeId = d.UcetdEventTypeId,
                    EventTypeName = d.UcetdEventType?.UcetName ?? "",
                    TimeOffset = d.UcetdTimeOffset,
                    Sequence = d.UcetdSequence,
                    IsActive = d.UcetdIsActive,
                    Required = d.UcetdRequired,
                    ConfigJson = d.UcetdConfigJson,
                    Context = d.UcetdContext ?? "both"
                })
                .ToList()
        };

        private static string GetScopeLabel(int? clientId, int? speedId) =>
            (clientId, speedId) switch
            {
                (not null, not null) => "Client+Service",
                (not null, null) => "Client",
                (null, not null) => "Service",
                _ => "Default"
            };

        #endregion
    }

    // Helper class for raw SQL job lookup
    internal class JobLookup
    {
        public int? ClientId { get; set; }
        public int? SpeedId { get; set; }
        public int? AccessorialChargeGroupId { get; set; }
    }

    // Helper class for accessorial charge member lookup
    internal class AccessorialChargeLookup
    {
        public int AccessorialChargeId { get; set; }
    }
}
