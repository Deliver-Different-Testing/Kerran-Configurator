using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Tenant;

// Agent/NP Onboarding pipeline persistence (GARRY-AGENT-NP-ONBOARDING-REMOVE-
// DUMMY-DATA). Replaces the demo-only BUSINESS_ONBOARDING_SEED in-memory store.
// Activation promotes a record into a real tucAgents row by reusing
// TenantAgentService's create cascade (TucAgent + NP TucClient/TucClientContact).
public class TenantAgentOnboardingService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IHttpContextAccessor httpContextAccessor,
    TenantAgentService tenantAgentService) : BaseService(contextFactory)
{
    // Stage ladder — matches the frontend BUSINESS_ONBOARDING_STAGES order.
    private static readonly string[] Stages =
    {
        "Prospect Identified", "Contacted", "Qualified", "Documents Requested",
        "Documents Received", "Review In Progress", "Approved", "Activated",
        "Rejected / Archived",
    };

    // The standard compliance requirement template seeded on every new record.
    private static readonly (string Key, string Label)[] ComplianceTemplate =
    {
        ("insurance", "Insurance certificate"),
        ("authority", "Operating authority / registration"),
        ("msa", "Master services agreement"),
        ("tax", "Tax verification"),
    };

    // ─── Reads ────────────────────────────────────────────────────────────
    public async Task<TenantAgentOnboardingListResponse> GetAll(Guid messageId)
    {
        var entities = await Context.TucAgentOnboardings.AsNoTracking()
            .Include(o => o.CoverageAreas)
            .Include(o => o.ComplianceItems)
            .Include(o => o.TimelineEvents)
            .OrderByDescending(o => o.LastModified)
            .ToListAsync();

        return new TenantAgentOnboardingListResponse(messageId)
        {
            Success = true,
            Records = entities.Select(MapDetail).ToList(),
        };
    }

    public async Task<TenantAgentOnboardingResponse> GetById(int id, Guid messageId)
    {
        var entity = await LoadFullAsync(id);
        if (entity is null) return Fail(messageId, "Onboarding record not found.");
        return new TenantAgentOnboardingResponse(messageId) { Success = true, Record = MapDetail(entity) };
    }

    // ─── Create / Update ───────────────────────────────────────────────────
    public async Task<TenantAgentOnboardingResponse> CreateAsync(TenantAgentOnboardingUpsertDto dto, Guid messageId)
    {
        if (string.IsNullOrWhiteSpace(dto.BusinessName)) return Fail(messageId, "Business name is required.");
        if (string.IsNullOrWhiteSpace(dto.PrimaryContact)) return Fail(messageId, "Primary contact is required.");

        var actor = ResolveActor();
        var now = DateTime.UtcNow;

        var entity = new TucAgentOnboarding
        {
            BusinessName = Truncate(dto.BusinessName, 150),
            PrimaryContact = Truncate(dto.PrimaryContact, 150),
            Phone = NullIfBlank(dto.Phone),
            Email = NullIfBlank(dto.Email),
            AddressLine1 = NullIfBlank(dto.Address),
            City = NullIfBlank(dto.City),
            State = NullIfBlank(dto.State),
            Association = NullIfBlank(dto.Association) ?? "None",
            AssociationMemberId = NullIfBlank(dto.MemberId),
            Source = NullIfBlank(dto.Source) ?? "Manual Entry",
            Stage = "Prospect Identified",
            NetworkPartnerStatus = NullIfBlank(dto.NetworkPartnerStatus) ?? "Candidate",
            FleetProfile = NullIfBlank(dto.FleetProfile) ?? "Fleet profile pending qualification",
            EstimatedDrivers = dto.EstimatedDrivers,
            ServiceCapabilities = JoinCsv(dto.ServiceCapabilities),
            Specialties = JoinCsv(dto.Specialties),
            Notes = NullIfBlank(dto.Notes) ?? "Created from business onboarding entry.",
            Reviewer = NullIfBlank(dto.Reviewer) ?? "Unassigned",
            Owner = NullIfBlank(dto.Owner) ?? actor,
            Archived = false,
            Created = now,
            CreatedBy = actor,
            LastModified = now,
            LastModifiedBy = actor,
        };

        // Coverage — fall back to "City, State" when none supplied (mirrors the
        // old createOnboardingRecord default).
        var coverage = dto.Coverage.Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c.Trim()).Distinct().ToList();
        if (coverage.Count == 0 && (!string.IsNullOrWhiteSpace(dto.City) || !string.IsNullOrWhiteSpace(dto.State)))
            coverage.Add($"{dto.City}, {dto.State}".Trim(' ', ','));
        foreach (var area in coverage)
            entity.CoverageAreas.Add(new TucAgentOnboardingCoverageArea { AreaName = Truncate(area, 120) });

        // Seed the standard compliance requirements (all missing).
        foreach (var (key, label) in ComplianceTemplate)
            entity.ComplianceItems.Add(new TucAgentOnboardingCompliance
            {
                RequirementKey = key, Label = label, Status = "missing", UpdatedAt = now,
            });

        entity.TimelineEvents.Add(new TucAgentOnboardingTimeline
        {
            Title = "Onboarding record created",
            Detail = $"{entity.Source} created the business prospect and opened the onboarding workspace.",
            Owner = entity.Owner,
            EventAt = now,
        });

        Context.TucAgentOnboardings.Add(entity);
        await Context.SaveChangesAsync();
        return await GetById(entity.UcaoId, messageId);
    }

    public async Task<TenantAgentOnboardingResponse> UpdateAsync(int id, TenantAgentOnboardingUpsertDto dto, Guid messageId)
    {
        var entity = await LoadFullAsync(id);
        if (entity is null) return Fail(messageId, "Onboarding record not found.");

        var actor = ResolveActor();
        entity.BusinessName = Truncate(dto.BusinessName, 150);
        entity.PrimaryContact = Truncate(dto.PrimaryContact, 150);
        entity.Phone = NullIfBlank(dto.Phone);
        entity.Email = NullIfBlank(dto.Email);
        entity.AddressLine1 = NullIfBlank(dto.Address);
        entity.City = NullIfBlank(dto.City);
        entity.State = NullIfBlank(dto.State);
        entity.Association = NullIfBlank(dto.Association) ?? "None";
        entity.AssociationMemberId = NullIfBlank(dto.MemberId);
        entity.Source = NullIfBlank(dto.Source) ?? entity.Source;
        entity.NetworkPartnerStatus = NullIfBlank(dto.NetworkPartnerStatus) ?? entity.NetworkPartnerStatus;
        entity.FleetProfile = NullIfBlank(dto.FleetProfile);
        entity.EstimatedDrivers = dto.EstimatedDrivers;
        entity.ServiceCapabilities = JoinCsv(dto.ServiceCapabilities);
        entity.Specialties = JoinCsv(dto.Specialties);
        entity.Notes = NullIfBlank(dto.Notes);
        if (!string.IsNullOrWhiteSpace(dto.Reviewer)) entity.Reviewer = dto.Reviewer;
        if (!string.IsNullOrWhiteSpace(dto.Owner)) entity.Owner = dto.Owner;
        entity.LastModified = DateTime.UtcNow;
        entity.LastModifiedBy = actor;

        // Replace coverage rows wholesale (small list).
        Context.TucAgentOnboardingCoverageAreas.RemoveRange(entity.CoverageAreas);
        var coverage = dto.Coverage.Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c.Trim()).Distinct().ToList();
        foreach (var area in coverage)
            entity.CoverageAreas.Add(new TucAgentOnboardingCoverageArea { AreaName = Truncate(area, 120) });

        await Context.SaveChangesAsync();
        return await GetById(entity.UcaoId, messageId);
    }

    // ─── Stage transitions ──────────────────────────────────────────────────
    public async Task<TenantAgentOnboardingResponse> AdvanceStageAsync(int id, Guid messageId)
    {
        var entity = await LoadFullAsync(id);
        if (entity is null) return Fail(messageId, "Onboarding record not found.");

        var idx = Array.IndexOf(Stages, entity.Stage);
        // Stop before the terminal pair (Activated / Rejected) — those are
        // reached via approve-activate / archive, not linear advance.
        if (idx < 0 || idx >= Stages.Length - 2)
            return Fail(messageId, "Record is already at its final pipeline stage.");

        var actor = ResolveActor();
        var now = DateTime.UtcNow;
        var nextStage = Stages[idx + 1];
        var shouldComplete = nextStage is "Approved" or "Activated";

        entity.Stage = nextStage;
        if (shouldComplete && entity.NetworkPartnerStatus != "Agent Only")
            entity.NetworkPartnerStatus = "Approved NP";
        if (shouldComplete)
            foreach (var c in entity.ComplianceItems) { c.Status = "complete"; c.UpdatedAt = now; }
        entity.LastModified = now;
        entity.LastModifiedBy = actor;
        entity.TimelineEvents.Add(new TucAgentOnboardingTimeline
        {
            Title = $"Advanced to {nextStage}",
            Detail = $"Pipeline stage moved to {nextStage}.",
            Owner = actor, EventAt = now,
        });

        await Context.SaveChangesAsync();
        return await GetById(entity.UcaoId, messageId);
    }

    public async Task<TenantAgentOnboardingResponse> ApproveAndActivateAsync(int id, Guid messageId)
    {
        var entity = await LoadFullAsync(id);
        if (entity is null) return Fail(messageId, "Onboarding record not found.");

        var actor = ResolveActor();
        var now = DateTime.UtcNow;
        var warnings = new List<string>();

        entity.Stage = "Activated";
        entity.NetworkPartnerStatus = entity.NetworkPartnerStatus == "Agent Only" ? "Agent Only" : "Approved NP";
        entity.Archived = false;
        foreach (var c in entity.ComplianceItems) { c.Status = "complete"; c.UpdatedAt = now; }

        // Promote into a real tucAgents row (reuse TenantAgentService's cascade)
        // unless already linked. Cross-service call uses its own DbContext +
        // transaction — the agent commits independently of the onboarding row
        // (same non-atomic pattern as the Hub invite cascade).
        if (entity.UcagId is null)
        {
            var agentDto = BuildAgentUpsert(entity);
            var agentResp = await tenantAgentService.CreateAsync(agentDto, messageId);
            if (!agentResp.Success || agentResp.Agent is null)
            {
                var detail = agentResp.Messages.FirstOrDefault()?.Message ?? "agent creation failed";
                return Fail(messageId, $"Could not activate — {detail}");
            }
            entity.UcagId = agentResp.Agent.Id;
            foreach (var m in agentResp.Messages) warnings.Add(m.Message);
        }

        entity.LastModified = now;
        entity.LastModifiedBy = actor;
        entity.TimelineEvents.Add(new TucAgentOnboardingTimeline
        {
            Title = "Approved & activated",
            Detail = "Business was promoted into the directory as a live Agent/NP.",
            Owner = actor, EventAt = now,
        });

        await Context.SaveChangesAsync();
        var resp = await GetById(entity.UcaoId, messageId);
        foreach (var w in warnings) resp.Messages.Add(new MessageDto { Message = w });
        return resp;
    }

    public async Task<TenantAgentOnboardingResponse> ArchiveAsync(int id, Guid messageId)
    {
        var entity = await LoadFullAsync(id);
        if (entity is null) return Fail(messageId, "Onboarding record not found.");

        var actor = ResolveActor();
        var now = DateTime.UtcNow;
        entity.Stage = "Rejected / Archived";
        entity.NetworkPartnerStatus = "Archived";
        entity.Archived = true;
        entity.LastModified = now;
        entity.LastModifiedBy = actor;
        entity.TimelineEvents.Add(new TucAgentOnboardingTimeline
        {
            Title = "Prospect archived",
            Detail = "Business was archived after fit/compliance review.",
            Owner = actor, EventAt = now,
        });

        await Context.SaveChangesAsync();
        return await GetById(entity.UcaoId, messageId);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────
    private async Task<TucAgentOnboarding?> LoadFullAsync(int id) =>
        await Context.TucAgentOnboardings
            .Include(o => o.CoverageAreas)
            .Include(o => o.ComplianceItems)
            .Include(o => o.TimelineEvents)
            .FirstOrDefaultAsync(o => o.UcaoId == id);

    private static TenantAgentOnboardingDetailDto MapDetail(TucAgentOnboarding o) => new()
    {
        Id = o.UcaoId,
        LinkedAgentId = o.UcagId,
        BusinessName = o.BusinessName,
        PrimaryContact = o.PrimaryContact,
        Phone = o.Phone ?? string.Empty,
        Email = o.Email ?? string.Empty,
        Address = o.AddressLine1 ?? string.Empty,
        City = o.City ?? string.Empty,
        State = o.State ?? string.Empty,
        Coverage = o.CoverageAreas.OrderBy(c => c.AreaName).Select(c => c.AreaName).ToList(),
        Association = o.Association ?? string.Empty,
        MemberId = o.AssociationMemberId ?? string.Empty,
        Source = o.Source,
        Stage = o.Stage,
        NetworkPartnerStatus = o.NetworkPartnerStatus,
        FleetProfile = o.FleetProfile ?? string.Empty,
        EstimatedDrivers = o.EstimatedDrivers ?? 0,
        ServiceCapabilities = SplitCsv(o.ServiceCapabilities),
        Specialties = SplitCsv(o.Specialties),
        Notes = o.Notes ?? string.Empty,
        ComplianceItems = o.ComplianceItems.Select(c => new TenantAgentOnboardingComplianceDto
        {
            RequirementKey = c.RequirementKey, Label = c.Label, Status = c.Status,
            UpdatedAt = c.UpdatedAt, Notes = c.Notes ?? string.Empty,
        }).ToList(),
        ComplianceComplete = o.ComplianceItems.Any() && o.ComplianceItems.All(c => c.Status == "complete"),
        Timeline = o.TimelineEvents.OrderBy(t => t.EventAt).ThenBy(t => t.UcaotId).Select(t => new TenantAgentOnboardingTimelineDto
        {
            Id = t.UcaotId, Title = t.Title, Detail = t.Detail ?? string.Empty,
            Owner = t.Owner ?? string.Empty, EventAt = t.EventAt,
        }).ToList(),
        Reviewer = o.Reviewer ?? string.Empty,
        Owner = o.Owner ?? string.Empty,
        Archived = o.Archived,
        LastUpdated = o.LastModified,
        CreatedAt = o.Created,
    };

    // Map an onboarding record onto the agent create payload. NP flag/tier mirror
    // the old deriveAgentStatus/Tier rules.
    private static TenantAgentUpsertDto BuildAgentUpsert(TucAgentOnboarding o) => new()
    {
        Name = o.BusinessName,
        Phone = o.Phone ?? string.Empty,
        AddressLine1 = o.AddressLine1 ?? string.Empty,
        PostCode = string.Empty,
        IsNetworkPartner = o.NetworkPartnerStatus == "Approved NP",
        NpPortalEnabled = false,
        NpTier = (byte)((o.EstimatedDrivers ?? 0) >= 40 ? 2 : 1),
        Notes = o.Notes ?? string.Empty,
        Association = (o.Association is null or "None") ? string.Empty : o.Association,
        AssociationMemberId = o.AssociationMemberId ?? string.Empty,
        ContactName = o.PrimaryContact,
        ContactEmail = o.Email ?? string.Empty,
        CoverageAreas = o.CoverageAreas.Select(c => c.AreaName).ToList(),
        ClientTypeId = null,
    };

    private string ResolveActor() =>
        httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
        ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
        ?? "system";

    private static TenantAgentOnboardingResponse Fail(Guid messageId, string message)
    {
        var r = new TenantAgentOnboardingResponse(messageId) { Success = false };
        r.Messages.Add(new MessageDto { Message = message });
        Log.Warning("Onboarding service failure ({MessageId}): {Message}", messageId, message);
        return r;
    }

    private static string JoinCsv(IEnumerable<string> values) =>
        string.Join(", ", values.Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => v.Trim()));
    private static List<string> SplitCsv(string csv) =>
        string.IsNullOrWhiteSpace(csv) ? new List<string>()
            : csv.Split(',').Select(s => s.Trim()).Where(s => s.Length > 0).Distinct().ToList();
    private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
    private static string Truncate(string s, int max) => string.IsNullOrEmpty(s) ? string.Empty : (s.Length <= max ? s : s[..max]);
}
