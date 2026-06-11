using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Agent / NP business-document compliance aggregation (Phase 1). Computes the
// per-agent scorecard + roster + dashboard from the NP DocumentTypes
// (AppliesTo IN ('NP','All')) joined to tucAgentDocument, with onboarding
// carry-through so docs accepted during onboarding surface as already-approved
// (no duplicate upload). Mirrors NpComplianceService (the courier equivalent).
//
// Requirement set = the flat "all active NP doc types" matrix. Per-agent
// profile selection + client overlays are layered on in Phase 4.
//
// Scope: admin / tenant-staff see all agents in the tenant; an NP user sees
// only its own agent record (UcagId == scope.NpAgentId).
public class NpAgentComplianceService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    INpScopeResolver scopeResolver,
    NpComplianceService courierCompliance) : BaseService(contextFactory)
{
    private const int ExpiryWarningDaysFallback = 30;
    private const int ExpiryUrgentDaysFallback = 7;

    // NP score weighting (Steve, 2026-06-10): courier roll-up is the real risk.
    private const decimal DocWeight = 0.25m;
    private const decimal CourierWeight = 0.75m;

    // Onboarding RequirementKey → NP DocumentType.Name (carry-through map).
    // Keys come from TenantAgentOnboardingService's default requirement set.
    private static readonly Dictionary<string, string> OnboardingKeyToDocType = new(StringComparer.OrdinalIgnoreCase)
    {
        ["insurance"] = "Proof of Insurance",
        ["authority"] = "Operating Authority",
        ["msa"]       = "Service Agreement",
        ["tax"]       = "W-9 / Tax ID",
    };

    // ─── Public ──────────────────────────────────────────────────────────

    public async Task<AgentComplianceDetailResponse> GetDetail(int agentId, Guid messageId, CancellationToken ct = default)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
            return new AgentComplianceDetailResponse(messageId) { Success = true, Detail = null };
        if (!scope.IsAdmin && scope.NpAgentId != agentId)
            return new AgentComplianceDetailResponse(messageId) { Success = false };

        var exists = await Context.TucAgents.AsNoTracking().AnyAsync(a => a.UcagId == agentId, ct);
        if (!exists)
            return new AgentComplianceDetailResponse(messageId) { Success = false };

        var baseDocTypes = await LoadNpDocTypesAsync(ct);
        var overlay = await LoadOverlayDocTypesAsync(new[] { agentId }, ct);
        var docs = await LoadAgentDocsAsync(new[] { agentId }, ct);
        var onboarding = await LoadOnboardingApprovedAsync(new[] { agentId }, ct);

        var detail = ComposeDetail(agentId,
            CombineDocTypes(baseDocTypes, overlay.TryGetValue(agentId, out var ov) ? ov : new()),
            docs.TryGetValue(agentId, out var ad) ? ad : new(),
            onboarding.TryGetValue(agentId, out var ob) ? ob : new());

        var rollups = await courierCompliance.GetCourierComplianceByAgentAsync(ct);
        ApplyScore(detail, rollups);

        return new AgentComplianceDetailResponse(messageId) { Success = true, Detail = detail };
    }

    public async Task<AgentComplianceRosterResponse> GetRoster(Guid messageId, CancellationToken ct = default)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
            return new AgentComplianceRosterResponse(messageId) { Success = true, Roster = new() };

        var agentIds = await ScopedAgentIdsAsync(scope, ct);
        if (agentIds.Count == 0)
            return new AgentComplianceRosterResponse(messageId) { Success = true, Roster = new() };

        var baseDocTypes = await LoadNpDocTypesAsync(ct);
        var overlay = await LoadOverlayDocTypesAsync(agentIds, ct);
        var docs = await LoadAgentDocsAsync(agentIds, ct);
        var onboarding = await LoadOnboardingApprovedAsync(agentIds, ct);
        var rollups = await courierCompliance.GetCourierComplianceByAgentAsync(ct);

        var roster = agentIds.Select(id =>
        {
            var detail = ComposeDetail(id,
                CombineDocTypes(baseDocTypes, overlay.TryGetValue(id, out var ov) ? ov : new()),
                docs.TryGetValue(id, out var ad) ? ad : new(),
                onboarding.TryGetValue(id, out var ob) ? ob : new());
            ApplyScore(detail, rollups);
            return new AgentComplianceRosterItemDto
            {
                AgentId = id,
                CompliancePercent = detail.CompliancePercent,
                CourierCompliancePercent = detail.CourierCompliancePercent,
                OverallScorePercent = detail.OverallScorePercent,
                RiskLevel = RiskLevel(detail),
                Summary = detail.Summary,
            };
        }).ToList();

        return new AgentComplianceRosterResponse(messageId) { Success = true, Roster = roster };
    }

    public async Task<AgentComplianceDashboardResponse> GetDashboard(Guid messageId, CancellationToken ct = default)
    {
        var roster = await GetRoster(messageId, ct);
        var items = roster.Roster;

        var dto = new AgentComplianceDashboardDto
        {
            TotalAgents = items.Count,
            CompliantAgents = items.Count(i => RiskIsCompliant(i)),
            HighRiskAgents = items.Count(i => i.RiskLevel == "High"),
            AgentsWithExpiring = items.Count(i => i.Summary != null && i.RiskLevel == "Medium"),
            AgentsWithMissingMandatory = items.Count(i => i.Summary.MandatoryDocuments > i.Summary.ApprovedMandatoryDocuments + PendingMandatoryApprox(i)),
            TotalMissingMandatoryDocs = items.Sum(i => Math.Max(0, i.Summary.MandatoryDocuments - i.Summary.ApprovedMandatoryDocuments)),
            TotalExpiringDocs = 0, // populated alongside per-doc expiry in Phase 4 thresholds
            AverageCompliancePercent = items.Count == 0 ? 100m : Math.Round(items.Average(i => i.CompliancePercent), 1),
        };

        return new AgentComplianceDashboardResponse(messageId) { Success = true, Dashboard = dto };
    }

    public async Task<AgentComplianceOnboardingSummaryResponse> GetOnboardingSummary(Guid messageId, CancellationToken ct = default)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
            return new AgentComplianceOnboardingSummaryResponse(messageId) { Success = true, Summary = new() };

        var agentIds = await ScopedAgentIdsAsync(scope, ct);
        var onboarding = await LoadOnboardingApprovedAsync(agentIds, ct);

        var dto = new AgentComplianceOnboardingSummaryDto
        {
            CarriedThroughItems = onboarding.Sum(kv => kv.Value.Count),
            AgentsWithCarriedDocs = onboarding.Count(kv => kv.Value.Count > 0),
        };

        return new AgentComplianceOnboardingSummaryResponse(messageId) { Success = true, Summary = dto };
    }

    // ─── Compose ─────────────────────────────────────────────────────────

    private AgentComplianceDetailDto ComposeDetail(
        int agentId,
        List<DocTypeSnapshot> docTypes,
        List<DocSnapshot> agentDocs,
        HashSet<string> onboardingApprovedDocTypeNames)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);

        // Latest active doc per type.
        var latestByType = new Dictionary<int, DocSnapshot>();
        foreach (var d in agentDocs.OrderByDescending(d => d.UploadedDate))
            if (!latestByType.ContainsKey(d.DocTypeId)) latestByType[d.DocTypeId] = d;

        var requirements = new List<AgentDocRequirementStatusDto>(docTypes.Count);
        foreach (var dt in docTypes)
        {
            var row = new AgentDocRequirementStatusDto
            {
                DocumentTypeId = dt.Id,
                DocumentTypeName = dt.Name,
                Category = dt.Category,
                Mandatory = dt.Mandatory,
            };

            if (latestByType.TryGetValue(dt.Id, out var doc))
            {
                row.Status = MapStatus(doc.VerifyStatus);
                row.Source = "upload";
                row.DocumentId = doc.Id;
                if (doc.Expiry is DateOnly exp)
                {
                    row.ExpiryDate = exp.ToString("yyyy-MM-dd");
                    var diff = exp.DayNumber - today.DayNumber;
                    row.DaysUntilExpiry = diff;
                    var warn = dt.ExpiryWarningDays > 0 ? dt.ExpiryWarningDays : ExpiryWarningDaysFallback;
                    var urgent = dt.ExpiryUrgentDays > 0 ? dt.ExpiryUrgentDays : ExpiryUrgentDaysFallback;
                    if (row.Status == "approved")
                    {
                        row.IsExpired = diff < 0;
                        row.IsExpiringUrgent = diff >= 0 && diff <= urgent;   // red band
                        row.IsExpiring = diff >= 0 && diff <= warn;           // orange band (superset)
                    }
                }
            }
            else if (onboardingApprovedDocTypeNames.Contains(dt.Name))
            {
                // Onboarding carry-through — accepted during onboarding, no re-upload.
                row.Status = "approved";
                row.Source = "onboarding";
            }
            else
            {
                row.Status = "missing";
                row.Source = "directory";
            }

            requirements.Add(row);
        }

        var summary = Summarise(requirements, docTypes);
        var pct = summary.MandatoryDocuments == 0
            ? 100m
            : Math.Round((decimal)summary.ApprovedMandatoryDocuments * 100m / summary.MandatoryDocuments, 1);

        return new AgentComplianceDetailDto
        {
            AgentId = agentId,
            CompliancePercent = pct,
            Summary = summary,
            Requirements = requirements,
        };
    }

    private static AgentBusinessComplianceSummaryDto Summarise(
        List<AgentDocRequirementStatusDto> reqs, List<DocTypeSnapshot> docTypes)
    {
        var mandatoryIds = docTypes.Where(d => d.Mandatory).Select(d => d.Id).ToHashSet();
        return new AgentBusinessComplianceSummaryDto
        {
            TotalDocuments = reqs.Count,
            ApprovedDocuments = reqs.Count(r => r.Status == "approved"),
            MandatoryDocuments = mandatoryIds.Count,
            ApprovedMandatoryDocuments = reqs.Count(r => r.Status == "approved" && mandatoryIds.Contains(r.DocumentTypeId)),
            PendingDocuments = reqs.Count(r => r.Status == "under_review" || r.Status == "uploaded"),
            RejectedDocuments = reqs.Count(r => r.Status == "rejected"),
            MissingDocuments = reqs.Count(r => r.Status == "missing"),
        };
    }

    // Blend the 25/75 NP score onto a composed detail. No-couriers → 100% courier
    // (vacuously compliant, mirrors NpComplianceService.FleetCompliancePercent).
    private static void ApplyScore(
        AgentComplianceDetailDto detail,
        IReadOnlyDictionary<int, NpComplianceService.CourierComplianceRollup> rollups)
    {
        var courierPct = rollups.TryGetValue(detail.AgentId, out var r) ? r.Percent : 100m;
        detail.CourierCompliancePercent = courierPct;
        detail.OverallScorePercent = Math.Round(DocWeight * detail.CompliancePercent + CourierWeight * courierPct, 1);
    }

    private static string RiskLevel(AgentComplianceDetailDto d)
    {
        var mandatoryMissingOrRejected = d.Requirements.Any(r => r.Mandatory && (r.Status == "missing" || r.Status == "rejected"));
        if (mandatoryMissingOrRejected) return "High";
        if (d.Requirements.Any(r => r.IsExpiring || r.IsExpired)) return "Medium";
        return "Low";
    }

    private static bool RiskIsCompliant(AgentComplianceRosterItemDto i) =>
        i.RiskLevel == "Low" && i.Summary.MandatoryDocuments == i.Summary.ApprovedMandatoryDocuments;

    private static int PendingMandatoryApprox(AgentComplianceRosterItemDto i) => 0;

    private static string MapStatus(string verifyStatus) => verifyStatus switch
    {
        "Verified" => "approved",
        "Rejected" => "rejected",
        _          => "under_review",   // Pending
    };

    // ─── Loaders ─────────────────────────────────────────────────────────

    private async Task<List<int>> ScopedAgentIdsAsync(NpScope scope, CancellationToken ct)
    {
        var q = Context.TucAgents.AsNoTracking();
        if (!scope.IsAdmin) q = q.Where(a => a.UcagId == scope.NpAgentId);
        return await q.Select(a => a.UcagId).ToListAsync(ct);
    }

    private async Task<List<DocTypeSnapshot>> LoadNpDocTypesAsync(CancellationToken ct) =>
        await Context.DocumentTypes.AsNoTracking()
            .Where(d => d.IsActive && (d.AppliesTo == "NP" || d.AppliesTo == "All"))
            .OrderBy(d => d.SortOrder).ThenBy(d => d.Name)
            .Select(d => new DocTypeSnapshot(d.Id, d.Name ?? string.Empty, d.Category ?? "Other", d.Mandatory, d.ExpiryWarningDays, d.ExpiryUrgentDays))
            .ToListAsync(ct);

    // Phase 4b-ii — doc types required by each agent's assigned client compliance
    // profiles (tucAgentComplianceProfile → ComplianceProfileRequirements →
    // DocumentTypes). Deduped per agent; Mandatory = OR across the profiles that
    // require it. Unioned onto the base NP set by CombineDocTypes.
    private async Task<Dictionary<int, List<DocTypeSnapshot>>> LoadOverlayDocTypesAsync(IReadOnlyCollection<int> agentIds, CancellationToken ct = default)
    {
        var rows = await Context.TucAgentComplianceProfiles.AsNoTracking()
            .Where(a => agentIds.Contains(a.AgentId))
            .Join(Context.ComplianceProfileRequirements.AsNoTracking(),
                a => a.ProfileId, r => r.ProfileId, (a, r) => new { a.AgentId, r.DocumentTypeId, r.Mandatory })
            .Join(Context.DocumentTypes.AsNoTracking().Where(d => d.IsActive),
                x => x.DocumentTypeId, d => d.Id,
                (x, d) => new { x.AgentId, ReqMandatory = x.Mandatory, d.Id, d.Name, d.Category, d.ExpiryWarningDays, d.ExpiryUrgentDays })
            .ToListAsync(ct);

        var result = new Dictionary<int, List<DocTypeSnapshot>>();
        foreach (var grp in rows.GroupBy(r => r.AgentId))
        {
            var perType = new Dictionary<int, DocTypeSnapshot>();
            foreach (var r in grp)
            {
                if (perType.TryGetValue(r.Id, out var existing))
                {
                    if (r.ReqMandatory && !existing.Mandatory) perType[r.Id] = existing with { Mandatory = true };
                }
                else
                {
                    perType[r.Id] = new DocTypeSnapshot(r.Id, r.Name ?? string.Empty, r.Category ?? "Other", r.ReqMandatory, r.ExpiryWarningDays, r.ExpiryUrgentDays);
                }
            }
            result[grp.Key] = perType.Values.ToList();
        }
        return result;
    }

    // Union of base NP doc types + an agent's overlay doc types. Dedup by Id;
    // a doc type present in both becomes mandatory if either side requires it.
    private static List<DocTypeSnapshot> CombineDocTypes(List<DocTypeSnapshot> baseTypes, List<DocTypeSnapshot> overlay)
    {
        if (overlay.Count == 0) return baseTypes;
        var byId = new Dictionary<int, int>();   // id -> index in ordered
        var ordered = new List<DocTypeSnapshot>(baseTypes.Count + overlay.Count);
        foreach (var dt in baseTypes) { byId[dt.Id] = ordered.Count; ordered.Add(dt); }
        foreach (var ov in overlay)
        {
            if (byId.TryGetValue(ov.Id, out var idx))
            {
                if (ov.Mandatory && !ordered[idx].Mandatory) ordered[idx] = ordered[idx] with { Mandatory = true };
            }
            else
            {
                byId[ov.Id] = ordered.Count;
                ordered.Add(ov);
            }
        }
        return ordered;
    }

    private async Task<Dictionary<int, List<DocSnapshot>>> LoadAgentDocsAsync(IReadOnlyCollection<int> agentIds, CancellationToken ct)
    {
        // Include all active docs (incl. Rejected) — latest-per-type picks the
        // true most-recent state, so a re-upload supersedes an earlier rejection.
        var rows = await Context.TucAgentDocuments.AsNoTracking()
            .Where(d => d.IsActive && agentIds.Contains(d.AgentId))
            .Select(d => new { d.AgentId, Snap = new DocSnapshot(d.UcadId, d.DocumentTypeId, d.VerifyStatus, d.ExpiryDate, d.UploadedDate) })
            .ToListAsync(ct);

        return rows.GroupBy(r => r.AgentId).ToDictionary(g => g.Key, g => g.Select(x => x.Snap).ToList());
    }

    // Onboarding compliance items marked complete → the NP doc-type names they
    // satisfy, per agent (carry-through; upload still takes precedence).
    private async Task<Dictionary<int, HashSet<string>>> LoadOnboardingApprovedAsync(IReadOnlyCollection<int> agentIds, CancellationToken ct)
    {
        var rows = await Context.TucAgentOnboardings.AsNoTracking()
            .Where(o => o.UcagId != null && agentIds.Contains(o.UcagId.Value))
            .SelectMany(o => o.ComplianceItems
                .Where(c => c.Status == "complete")
                .Select(c => new { AgentId = o.UcagId!.Value, c.RequirementKey }))
            .ToListAsync(ct);

        var result = new Dictionary<int, HashSet<string>>();
        foreach (var r in rows)
        {
            if (r.RequirementKey is null) continue;
            if (!OnboardingKeyToDocType.TryGetValue(r.RequirementKey, out var docTypeName)) continue;
            if (!result.TryGetValue(r.AgentId, out var set)) result[r.AgentId] = set = new();
            set.Add(docTypeName);
        }
        return result;
    }

    // ─── Records ─────────────────────────────────────────────────────────

    private sealed record DocTypeSnapshot(int Id, string Name, string Category, bool Mandatory, int ExpiryWarningDays, int ExpiryUrgentDays);
    private sealed record DocSnapshot(int Id, int DocTypeId, string VerifyStatus, DateOnly? Expiry, DateTime UploadedDate);
}
