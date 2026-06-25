using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Automation;
using DfrntDriveConfigurator.Core.Application.Interfaces;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using DfrntDriveConfigurator.Core.PdfOverlay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers;

[ApiController]
[Route("api/automations")]
[Authorize(Policy = "AdminOnly")]
public class AutomationController(
    IAutomationRepository repository,
    IPdfOverlayTemplates pdfOverlayTemplates) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<AutomationRuleDto>>> GetAll(
        [FromQuery] int? customerId, [FromQuery] int? speedId,
        [FromQuery] string? search, [FromQuery] bool? isActive, CancellationToken ct)
    {
        Log.Information("GetAll automations: customerId={CustomerId}, speedId={SpeedId}, search={Search}, isActive={IsActive}",
            customerId, speedId, search, isActive);
        var rules = await repository.GetAllAsync(customerId, speedId, search, isActive, ct);
        return Ok(rules.Select(MapToDto));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AutomationRuleDto>> GetById(int id, CancellationToken ct)
    {
        var rule = await repository.GetByIdAsync(id, ct);
        if (rule is null) return NotFound();
        return Ok(MapToDto(rule));
    }

    [HttpPost]
    public async Task<ActionResult<AutomationRuleDto>> Create([FromBody] CreateAutomationRequest request, CancellationToken ct)
    {
        Log.Information("Create automation: {Request}", JsonConvert.SerializeObject(request));

        var rule = new AutomationRule
        {
            Name = request.Name,
            Description = request.Description,
            ConditionMatchMode = request.ConditionMatchMode,
            AllCustomers = request.Scope.AllCustomers,
            CustomerIds = request.Scope.CustomerIds.Any() ? string.Join(",", request.Scope.CustomerIds) : null,
            AllSpeeds = request.Scope.AllSpeeds,
            SpeedIds = request.Scope.SpeedIds.Any() ? string.Join(",", request.Scope.SpeedIds) : null,
            JobRelationship = request.Scope.JobRelationship,
            AllJobStatuses = request.Scope.AllJobStatuses,
            JobStatusIds = request.Scope.JobStatusIds.Any() ? string.Join(",", request.Scope.JobStatusIds) : null,
            AllPriorities = request.Scope.AllPriorities,
            PriorityIds = request.Scope.PriorityIds.Any() ? string.Join(",", request.Scope.PriorityIds) : null,
            AllFromSites = request.Scope.AllFromSites,
            FromSiteIds = request.Scope.FromSiteIds.Any() ? string.Join(",", request.Scope.FromSiteIds) : null,
            AllToSites = request.Scope.AllToSites,
            ToSiteIds = request.Scope.ToSiteIds.Any() ? string.Join(",", request.Scope.ToSiteIds) : null,
            AllFromRegions = request.Scope.AllFromRegions,
            FromRegionIds = request.Scope.FromRegionIds.Any() ? string.Join(",", request.Scope.FromRegionIds) : null,
            AllToRegions = request.Scope.AllToRegions,
            ToRegionIds = request.Scope.ToRegionIds.Any() ? string.Join(",", request.Scope.ToRegionIds) : null,
            TimeThreshold = request.Scope.TimeThreshold,
        };

        foreach (var (c, i) in request.Conditions.Select((c, i) => (c, i)))
        {
            rule.AutomationConditions.Add(new AutomationCondition
            {
                ConditionType = c.ConditionType,
                SortOrder = c.SortOrder > 0 ? c.SortOrder : i + 1,
                StatusConditionMode = c.StatusConditionMode,
                StatusId = c.StatusId,
                ScheduledTimeField = c.ScheduledTimeField,
                OffsetValue = c.OffsetValue,
                OffsetUnit = c.OffsetUnit,
                ScanTypes = c.ScanTypes is not null ? string.Join(",", c.ScanTypes) : null
            });
        }

        foreach (var (a, i) in request.Actions.Select((a, i) => (a, i)))
        {
            rule.AutomationActions.Add(new AutomationAction
            {
                ActionType = a.ActionType,
                SortOrder = a.SortOrder > 0 ? a.SortOrder : i + 1,
                ToStatusId = a.ToStatusId,
                FromStatusId = a.FromStatusId,
                TaskTemplateId = a.TaskTemplateId,
                TaskAssigneeId = a.TaskAssigneeId,
                TaskAssigneeGroupId = a.TaskAssigneeGroupId,
                TaskDueOffsetMinutes = a.TaskDueOffsetMinutes,
                NotificationTemplateId = a.NotificationTemplateId,
                SmsRecipientType = a.SmsRecipientType,
                SmsFixedNumber = a.SmsFixedNumber,
                SmsMessageContent = a.SmsMessageContent,
                EmailSubject = a.EmailSubject,
                EmailTemplate = a.EmailTemplate,
                ReplyToEmail = a.ReplyToEmail,
                EmailRecipient = a.EmailRecipient,
                CustomEmailAddresses = a.CustomEmailAddresses,
                AttachReportKey = a.AttachReportKey,
                WaitConditionType = a.WaitConditionType,
                WaitStatusMode = a.WaitStatusMode,
                WaitStatusId = a.WaitStatusId,
                WaitScheduledTimeField = a.WaitScheduledTimeField,
                WaitOffsetValue = a.WaitOffsetValue,
                WaitOffsetUnit = a.WaitOffsetUnit,
                WaitScanTypes = a.WaitScanTypes is not null ? string.Join(",", a.WaitScanTypes) : null,
            });
        }

        var created = await repository.CreateAsync(rule, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, MapToDto(created));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AutomationRuleDto>> Update(int id, [FromBody] UpdateAutomationRequest request, CancellationToken ct)
    {
        Log.Information("Update automation {Id}: {Request}", id, JsonConvert.SerializeObject(request));

        var rule = await repository.GetByIdAsync(id, ct);
        if (rule is null) return NotFound();

        rule.Name = request.Name;
        rule.Description = request.Description;
        rule.IsActive = request.IsActive;
        rule.ConditionMatchMode = request.ConditionMatchMode;
        rule.AllCustomers = request.Scope.AllCustomers;
        rule.CustomerIds = request.Scope.CustomerIds.Any() ? string.Join(",", request.Scope.CustomerIds) : null;
        rule.AllSpeeds = request.Scope.AllSpeeds;
        rule.SpeedIds = request.Scope.SpeedIds.Any() ? string.Join(",", request.Scope.SpeedIds) : null;
        rule.AllJobStatuses = request.Scope.AllJobStatuses;
        rule.JobStatusIds = request.Scope.JobStatusIds.Any() ? string.Join(",", request.Scope.JobStatusIds) : null;
        rule.AllPriorities = request.Scope.AllPriorities;
        rule.PriorityIds = request.Scope.PriorityIds.Any() ? string.Join(",", request.Scope.PriorityIds) : null;
        rule.AllFromSites = request.Scope.AllFromSites;
        rule.FromSiteIds = request.Scope.FromSiteIds.Any() ? string.Join(",", request.Scope.FromSiteIds) : null;
        rule.AllToSites = request.Scope.AllToSites;
        rule.ToSiteIds = request.Scope.ToSiteIds.Any() ? string.Join(",", request.Scope.ToSiteIds) : null;
        rule.AllFromRegions = request.Scope.AllFromRegions;
        rule.FromRegionIds = request.Scope.FromRegionIds.Any() ? string.Join(",", request.Scope.FromRegionIds) : null;
        rule.AllToRegions = request.Scope.AllToRegions;
        rule.ToRegionIds = request.Scope.ToRegionIds.Any() ? string.Join(",", request.Scope.ToRegionIds) : null;
        rule.TimeThreshold = request.Scope.TimeThreshold;

        rule.AutomationConditions.Clear();
        foreach (var (c, i) in request.Conditions.Select((c, i) => (c, i)))
        {
            rule.AutomationConditions.Add(new AutomationCondition
            {
                RuleId = id,
                ConditionType = c.ConditionType,
                SortOrder = c.SortOrder > 0 ? c.SortOrder : i + 1,
                StatusConditionMode = c.StatusConditionMode,
                StatusId = c.StatusId,
                ScheduledTimeField = c.ScheduledTimeField,
                OffsetValue = c.OffsetValue,
                OffsetUnit = c.OffsetUnit,
                ScanTypes = c.ScanTypes is not null ? string.Join(",", c.ScanTypes) : null
            });
        }

        rule.AutomationActions.Clear();
        foreach (var (a, i) in request.Actions.Select((a, i) => (a, i)))
        {
            rule.AutomationActions.Add(new AutomationAction
            {
                RuleId = id,
                ActionType = a.ActionType,
                SortOrder = a.SortOrder > 0 ? a.SortOrder : i + 1,
                ToStatusId = a.ToStatusId,
                FromStatusId = a.FromStatusId,
                TaskTemplateId = a.TaskTemplateId,
                TaskAssigneeId = a.TaskAssigneeId,
                TaskAssigneeGroupId = a.TaskAssigneeGroupId,
                TaskDueOffsetMinutes = a.TaskDueOffsetMinutes,
                NotificationTemplateId = a.NotificationTemplateId,
                SmsRecipientType = a.SmsRecipientType,
                SmsFixedNumber = a.SmsFixedNumber,
                SmsMessageContent = a.SmsMessageContent,
                EmailSubject = a.EmailSubject,
                EmailTemplate = a.EmailTemplate,
                ReplyToEmail = a.ReplyToEmail,
                EmailRecipient = a.EmailRecipient,
                CustomEmailAddresses = a.CustomEmailAddresses,
                AttachReportKey = a.AttachReportKey,
                WaitConditionType = a.WaitConditionType,
                WaitStatusMode = a.WaitStatusMode,
                WaitStatusId = a.WaitStatusId,
                WaitScheduledTimeField = a.WaitScheduledTimeField,
                WaitOffsetValue = a.WaitOffsetValue,
                WaitOffsetUnit = a.WaitOffsetUnit,
                WaitScanTypes = a.WaitScanTypes is not null ? string.Join(",", a.WaitScanTypes) : null,
            });
        }

        await repository.UpdateAsync(rule, ct);
        return Ok(MapToDto(rule));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await repository.SoftDeleteAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:int}/toggle")]
    public async Task<IActionResult> Toggle(int id, CancellationToken ct)
    {
        await repository.ToggleActiveAsync(id, ct);
        return Ok();
    }

    [HttpGet("merge-fields")]
    public ActionResult<Dictionary<string, string[]>> GetMergeFields()
    {
        // Matches AdminManager's 63+ template fields, grouped by category
        var fields = new Dictionary<string, string[]>
        {
            ["Job"] = [
                "JobNumber", "ClientName", "Contact", "ClientRefA", "ClientRefB", "ClientRefC",
                "Date", "Time", "Quantity", "Weight", "JobSpeed", "ConNote",
                "EncryptedID", "EncryptedParentID", "CompletedDate", "CompletedTime"
            ],
            ["Pickup"] = [
                "FromAddress", "FromSuburbCity", "FromCityState",
                "PickupCompany", "PickupSuite", "PickupStreetNumber", "PickupStreetName",
                "PickupCity", "PickupState", "PickupZip",
                "PickupContactName", "PickupContactPhone", "PickupNotes"
            ],
            ["Delivery"] = [
                "ToAddress", "ToSuburbCity", "ToCityState",
                "DeliveryCompany", "DeliverySuite", "DeliveryStreetNumber", "DeliveryStreetName",
                "DeliveryCity", "DeliveryState", "DeliveryZip",
                "DeliveryContactName", "DeliveryContactPhone", "DeliveryNotes", "DeliverByTime"
            ],
            ["Parent Job"] = [
                "ParentJobNumber",
                "ParentPickupCompany", "ParentPickupSuite", "ParentPickupStreetNumber",
                "ParentPickupStreetName", "ParentPickupCity", "ParentPickupState", "ParentPickupZip",
                "ParentDeliveryCompany", "ParentDeliverySuite", "ParentDeliveryStreetNumber",
                "ParentDeliveryStreetName", "ParentDeliveryCity", "ParentDeliveryState", "ParentDeliveryZip"
            ],
            ["Flight"] = [
                "Airline", "FlightNumber", "FlightETD", "FlightETA", "ToAirport"
            ],
            ["Users"] = [
                "CourierName", "AgentName"
            ],
            ["Other"] = [
                "InboundUrl", "PODName"
            ],
        };
        return Ok(fields);
    }

    [HttpGet("available-reports")]
    public async Task<ActionResult<List<object>>> GetAvailableReports(CancellationToken ct)
    {
        var reports = new List<object>
        {
            new { key = "pod", name = "POD Report", description = "Proof of delivery report" }
        };

        // Offer each distinct active PDF Overlay document type as an attachable report. At run time the
        // AutomationEngine renders the matching client template for the job via the render-job endpoint
        // (key format "pdfoverlay:<documentType>").
        try
        {
            var overlays = await pdfOverlayTemplates.ListAsync(active: true, ct: ct);
            foreach (var docType in overlays
                         .Select(t => t.DocumentType)
                         .Where(d => !string.IsNullOrWhiteSpace(d))
                         .Distinct(StringComparer.OrdinalIgnoreCase)
                         .OrderBy(d => d, StringComparer.OrdinalIgnoreCase))
            {
                reports.Add(new
                {
                    key = $"pdfoverlay:{docType}",
                    name = $"PDF Overlay — {docType}",
                    description = $"Customer-branded '{docType}' document from the PDF Overlay tool"
                });
            }
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Could not enumerate PDF Overlay document types for the automation report catalog");
        }

        return Ok(reports);
    }

    private static AutomationRuleDto MapToDto(AutomationRule rule) => new()
    {
        Id = rule.Id,
        Name = rule.Name,
        Description = rule.Description,
        IsActive = rule.IsActive,
        ConditionMatchMode = rule.ConditionMatchMode?.ToLower() ?? "all",
        Scope = new AutomationScopeDto
        {
            AllCustomers = rule.AllCustomers,
            CustomerIds = ParseIntList(rule.CustomerIds),
            AllSpeeds = rule.AllSpeeds,
            SpeedIds = ParseIntList(rule.SpeedIds),
            JobRelationship = rule.JobRelationship,
            AllJobStatuses = rule.AllJobStatuses,
            JobStatusIds = ParseIntList(rule.JobStatusIds),
            AllPriorities = rule.AllPriorities,
            PriorityIds = ParseIntList(rule.PriorityIds),
            AllFromSites = rule.AllFromSites,
            FromSiteIds = ParseIntList(rule.FromSiteIds),
            AllToSites = rule.AllToSites,
            ToSiteIds = ParseIntList(rule.ToSiteIds),
            AllFromRegions = rule.AllFromRegions,
            FromRegionIds = ParseIntList(rule.FromRegionIds),
            AllToRegions = rule.AllToRegions,
            ToRegionIds = ParseIntList(rule.ToRegionIds),
            TimeThreshold = rule.TimeThreshold
        },
        Conditions = rule.AutomationConditions.Select(c => new AutomationConditionDto
        {
            Id = c.Id,
            ConditionType = c.ConditionType,
            SortOrder = c.SortOrder ?? 0,
            StatusConditionMode = c.StatusConditionMode,
            StatusId = c.StatusId,
            ScheduledTimeField = c.ScheduledTimeField,
            OffsetValue = c.OffsetValue,
            OffsetUnit = c.OffsetUnit,
            ScanTypes = c.ScanTypes?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList()
        }).ToList(),
        Actions = rule.AutomationActions.Select(a => new AutomationActionDto
        {
            Id = a.Id,
            ActionType = a.ActionType,
            SortOrder = a.SortOrder ?? 0,
            ToStatusId = a.ToStatusId,
            FromStatusId = a.FromStatusId,
            TaskTemplateId = a.TaskTemplateId,
            TaskAssigneeId = a.TaskAssigneeId,
            TaskAssigneeGroupId = a.TaskAssigneeGroupId,
            TaskDueOffsetMinutes = a.TaskDueOffsetMinutes,
            NotificationTemplateId = a.NotificationTemplateId,
            SmsRecipientType = a.SmsRecipientType,
            SmsFixedNumber = a.SmsFixedNumber,
            SmsMessageContent = a.SmsMessageContent,
            EmailSubject = a.EmailSubject,
            EmailTemplate = a.EmailTemplate,
            ReplyToEmail = a.ReplyToEmail,
            EmailRecipient = a.EmailRecipient,
            CustomEmailAddresses = a.CustomEmailAddresses,
            AttachReportKey = a.AttachReportKey,
            WaitConditionType = a.WaitConditionType,
            WaitStatusMode = a.WaitStatusMode,
            WaitStatusId = a.WaitStatusId,
            WaitScheduledTimeField = a.WaitScheduledTimeField,
            WaitOffsetValue = a.WaitOffsetValue,
            WaitOffsetUnit = a.WaitOffsetUnit,
            WaitScanTypes = a.WaitScanTypes?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
        }).ToList(),
        CreatedDate = rule.CreatedDate,
        ModifiedDate = rule.ModifiedDate
    };

    private static List<int> ParseIntList(string? csv) =>
        string.IsNullOrWhiteSpace(csv)
            ? new List<int>()
            : csv.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Where(s => int.TryParse(s, out _))
                .Select(int.Parse)
                .ToList();
}
