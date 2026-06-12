using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// ComplianceHub dashboard aggregates (Phase 5+25). Computes live counts across
// CourierDocuments + DocumentTypes for active in-scope couriers.
//
// NP-scoped: admin sees all active couriers in tenant; NP users see only those
// where tucCourier.NpAgentId matches their scope (mirrors NpFleetService).
//
// Semantics:
//   Active courier      = TucCourier.Active && (FinishDate is null || FinishDate > today)
//                         (matches NpDashboardService.activeCouriers definition)
//   Tracked doc type    = DocumentTypes.IsActive
//                         && AppliesTo in ('ActiveCourier', 'Both')
//                         — NP-only doc types are excluded from the courier matrix.
//   Status derivation   = per-doc, using DocumentType.ExpiryWarningDays as the
//                         Expiring threshold (falls back to 30 if unset).
//                         If a courier has no doc of a given type AND the type
//                         is Mandatory → Missing. Non-mandatory missing is not
//                         flagged.
//   Courier rollup      = NonCompliant if any Expired OR Missing-mandatory;
//                         Warning if any Expiring (and not NonCompliant);
//                         Compliant otherwise.
//
// Doc-instance lookup: the latest active, non-Rejected CourierDocument per
// (CourierId, DocumentTypeId). Older instances are treated as superseded and
// ignored for compliance calculations (matches the frontend's Superseded
// handling in np_documentService).
//
// Compliance profiles (per-courier requirement sets) are NOT applied here —
// the dashboard emits the flat "all mandatory active doc types" matrix, and
// the frontend filters down per profile selection at display time. A future
// vertical can layer per-courier profile assignment if needed.
public class NpComplianceService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    INpScopeResolver scopeResolver) : BaseService(contextFactory)
{
    private const int ExpiryWarningDaysFallback = 30;

    // ─── Public methods ──────────────────────────────────────────────────

    public async Task<NpComplianceDashboardResponse> GetDashboard(Guid messageId, CancellationToken ct = default)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return new NpComplianceDashboardResponse(messageId) { Success = true, Dashboard = EmptyDashboard() };
        }

        var matrix = await BuildMatrixAsync(scope, ct);
        var dashboard = ComposeDashboard(matrix);
        return new NpComplianceDashboardResponse(messageId) { Success = true, Dashboard = dashboard };
    }

    public async Task<NpComplianceAlertsResponse> GetAlerts(
        string? docType, string? status, string? courierName, int? daysAhead,
        Guid messageId, CancellationToken ct = default)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return new NpComplianceAlertsResponse(messageId) { Success = true, Alerts = new() };
        }

        var matrix = await BuildMatrixAsync(scope, ct);
        var alerts = ComposeAlerts(matrix, includeCurrent: true);

        // Apply filters.
        IEnumerable<NpComplianceAlertDto> filtered = alerts;
        if (!string.IsNullOrWhiteSpace(docType))
            filtered = filtered.Where(a => string.Equals(a.DocumentType, docType, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(status))
            filtered = filtered.Where(a => string.Equals(a.AlertStatus, status, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(courierName))
            filtered = filtered.Where(a => a.CourierName.Contains(courierName, StringComparison.OrdinalIgnoreCase));
        if (daysAhead.HasValue)
            filtered = filtered.Where(a => a.DaysUntilExpiry.HasValue && a.DaysUntilExpiry.Value <= daysAhead.Value);

        // Sort: Expired first, then Missing, then Expiring, then Current; within each, soonest first.
        var ordered = filtered
            .OrderBy(a => StatusSortKey(a.AlertStatus))
            .ThenBy(a => a.DaysUntilExpiry ?? int.MaxValue)
            .ThenBy(a => a.CourierName)
            .ToList();

        return new NpComplianceAlertsResponse(messageId) { Success = true, Alerts = ordered };
    }

    public async Task<NpCourierComplianceScoreResponse> GetCourierScore(int courierId, Guid messageId, CancellationToken ct = default)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return Fail(messageId, "No NP scope configured for this user.");
        }

        // Single courier — verify scope access first, then build score from the
        // doc types + that courier's docs only (no need for full matrix).
        var courierQuery = Context.TucCouriers.AsNoTracking().Where(c => c.UccrId == courierId);
        if (!scope.IsAdmin)
            courierQuery = courierQuery.Where(c => c.NpAgentId == scope.NpAgentId);

        var courier = await courierQuery
            .Select(c => new { c.UccrId, c.UccrName, c.UccrSurname, c.Active, c.UccrFinishDate })
            .FirstOrDefaultAsync(ct);
        if (courier is null)
        {
            return Fail(messageId, "Courier not found or outside your scope.");
        }

        var docTypes = await LoadTrackedDocTypesAsync(ct);

        var courierDocs = await Context.CourierDocuments
            .AsNoTracking()
            .Where(d => d.CourierId == courierId && d.IsActive && d.VerifyStatus != "Rejected")
            .OrderByDescending(d => d.UploadedDate)
            .Select(d => new DocSnapshot(d.CourierId, d.DocumentTypeId, d.ExpiryDate))
            .ToListAsync(ct);

        var latestByType = LatestPerDocType(courierDocs);

        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var statuses = new List<NpCourierDocTypeStatusDto>(docTypes.Count);
        int mandatoryCount = 0, mandatoryCurrent = 0;

        foreach (var dt in docTypes)
        {
            if (dt.Mandatory) mandatoryCount++;

            var hasDoc = latestByType.TryGetValue(dt.Id, out var doc);
            string status;
            int? days = null;
            DateOnly? expiry = hasDoc ? doc.Expiry : null;

            if (!hasDoc)
            {
                status = dt.Mandatory ? "Missing" : "Current";
            }
            else
            {
                (status, days) = DeriveStatus(expiry, dt.ExpiryWarningDays);
                // React side names the warning state ExpiringSoon (not Expiring) on CourierDocTypeStatus.
                if (status == "Expiring") status = "ExpiringSoon";
            }

            if (dt.Mandatory && status == "Current") mandatoryCurrent++;

            statuses.Add(new NpCourierDocTypeStatusDto
            {
                DocumentTypeId = dt.Id,
                DocumentTypeName = dt.Name,
                Category = dt.Category,
                Mandatory = dt.Mandatory,
                Status = status,
                ExpiryDate = expiry?.ToString("yyyy-MM-dd"),
                DaysUntilExpiry = days,
            });
        }

        var pct = mandatoryCount == 0 ? 100m : Math.Round((decimal)mandatoryCurrent * 100m / mandatoryCount, 1);
        var name = $"{courier.UccrName} {courier.UccrSurname}".Trim();

        return new NpCourierComplianceScoreResponse(messageId)
        {
            Success = true,
            Score = new NpCourierComplianceScoreDto
            {
                CourierId = courier.UccrId,
                CourierName = name,
                Status = courier.Active && (courier.UccrFinishDate == null || courier.UccrFinishDate > DateTime.UtcNow) ? "active" : "inactive",
                CompliancePercent = pct,
                DocumentStatuses = statuses,
            },
        };
    }

    // Per-agent courier-compliance roll-up — the 75% component of the NP score
    // (Phase 4). Returns, for each NpAgentId in scope, how many of that agent's
    // active couriers are fully compliant (no expired, no mandatory-missing, no
    // expiring) out of the total. Same scope rules as the dashboard.
    public async Task<Dictionary<int, CourierComplianceRollup>> GetCourierComplianceByAgentAsync(CancellationToken ct = default)
    {
        var result = new Dictionary<int, CourierComplianceRollup>();
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null) return result;

        var matrix = await BuildMatrixAsync(scope, ct);
        foreach (var courier in matrix.Couriers)
        {
            if (courier.NpAgentId is not int agentId) continue;

            bool hasExpiredOrMissing = false, hasExpiring = false;
            foreach (var dt in matrix.DocTypes)
            {
                var (status, _) = ResolveStatus(courier, dt, matrix);
                if (status == "Expired") hasExpiredOrMissing = true;
                else if (status == "Missing" && dt.Mandatory) hasExpiredOrMissing = true;
                else if (status == "Expiring") hasExpiring = true;
            }

            if (!result.TryGetValue(agentId, out var roll)) result[agentId] = roll = new CourierComplianceRollup();
            roll.Total++;
            if (!hasExpiredOrMissing && !hasExpiring) roll.Compliant++;
        }
        return result;
    }

    // ─── Matrix builder ──────────────────────────────────────────────────

    private async Task<ComplianceMatrix> BuildMatrixAsync(NpScope scope, CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;

        // Active couriers in scope.
        var courierQuery = Context.TucCouriers.AsNoTracking()
            .Where(c => c.Active && (c.UccrFinishDate == null || c.UccrFinishDate > today));
        if (!scope.IsAdmin)
            courierQuery = courierQuery.Where(c => c.NpAgentId == scope.NpAgentId);

        var couriers = await courierQuery
            .Select(c => new CourierSnapshot(
                c.UccrId,
                ((c.UccrName ?? string.Empty) + " " + (c.UccrSurname ?? string.Empty)).Trim(),
                c.NpAgentId,
                c.Code, c.CourierTypeId, c.UccrEmail, c.UccrVehicle, c.UccrMobile ?? c.UccrTel))
            .ToListAsync(ct);

        if (couriers.Count == 0)
            return new ComplianceMatrix(couriers, await LoadTrackedDocTypesAsync(ct), new Dictionary<(int, int), DocSnapshot>(), new Dictionary<int, string>());

        var agentNames = await LoadAgentNamesAsync(couriers, ct);
        var docTypes = await LoadTrackedDocTypesAsync(ct);

        // All courier docs for the in-scope courier set (active, not Rejected).
        var courierIds = couriers.Select(c => c.Id).ToList();
        var rawDocs = await Context.CourierDocuments
            .AsNoTracking()
            .Where(d => d.IsActive && d.VerifyStatus != "Rejected" && courierIds.Contains(d.CourierId))
            .OrderByDescending(d => d.UploadedDate)
            .Select(d => new DocSnapshot(d.CourierId, d.DocumentTypeId, d.ExpiryDate))
            .ToListAsync(ct);

        // Reduce to latest doc per (courierId, docTypeId).
        var docTypeIds = docTypes.Select(d => d.Id).ToHashSet();
        var latest = new Dictionary<(int CourierId, int DocTypeId), DocSnapshot>();
        foreach (var d in rawDocs)
        {
            if (!docTypeIds.Contains(d.DocTypeId)) continue;  // doc against a non-tracked type → skip
            var key = (d.CourierId, d.DocTypeId);
            if (!latest.ContainsKey(key)) latest[key] = d;    // rawDocs is already ordered desc → first wins
        }

        return new ComplianceMatrix(couriers, docTypes, latest, agentNames);
    }

    // Network-partner names for the in-scope couriers' NpAgentIds (for the
    // Compliance Risk "Network Partner" column; couriers with no NpAgentId
    // render "Direct" at compose time).
    private async Task<Dictionary<int, string>> LoadAgentNamesAsync(List<CourierSnapshot> couriers, CancellationToken ct)
    {
        var agentIds = couriers.Where(c => c.NpAgentId.HasValue)
            .Select(c => c.NpAgentId!.Value).Distinct().ToList();
        if (agentIds.Count == 0) return new Dictionary<int, string>();
        return await Context.TucAgents.AsNoTracking()
            .Where(a => agentIds.Contains(a.UcagId))
            .ToDictionaryAsync(a => a.UcagId, a => a.UcagName ?? string.Empty, ct);
    }

    private async Task<List<DocTypeSnapshot>> LoadTrackedDocTypesAsync(CancellationToken ct)
    {
        return await Context.DocumentTypes.AsNoTracking()
            .Where(d => d.IsActive && (d.AppliesTo == "ActiveCourier" || d.AppliesTo == "Both"))
            .OrderBy(d => d.SortOrder)
            .ThenBy(d => d.Name)
            .Select(d => new DocTypeSnapshot(
                d.Id,
                d.Name ?? string.Empty,
                d.Category ?? "Other",
                d.Mandatory,
                d.ExpiryWarningDays))
            .ToListAsync(ct);
    }

    // ─── Compose dashboard ───────────────────────────────────────────────

    private NpComplianceDashboardDto ComposeDashboard(ComplianceMatrix m)
    {
        var dto = EmptyDashboard();
        dto.TotalActiveCouriers = m.Couriers.Count;

        // Per-type breakdown counters
        var breakdown = m.DocTypes.ToDictionary(
            dt => dt.Id,
            dt => new NpComplianceBreakdownDto
            {
                DocumentTypeId = dt.Id,
                DocumentTypeName = dt.Name,
                Category = dt.Category,
                TotalRequired = m.Couriers.Count,
            });

        foreach (var courier in m.Couriers)
        {
            bool hasExpiredOrMissing = false;
            bool hasExpiring = false;

            foreach (var dt in m.DocTypes)
            {
                var (status, _) = ResolveStatus(courier, dt, m);
                var b = breakdown[dt.Id];
                switch (status)
                {
                    case "Current":  b.Current++;  break;
                    case "Expiring": b.Expiring++; hasExpiring = true; break;
                    case "Expired":  b.Expired++;  hasExpiredOrMissing = true; break;
                    case "Missing":  b.Missing++;  if (dt.Mandatory) hasExpiredOrMissing = true; break;
                }
            }

            if (hasExpiredOrMissing) dto.TotalNonCompliant++;
            else if (hasExpiring)    dto.TotalWarnings++;
            else                     dto.TotalCompliant++;
        }

        dto.BreakdownByType = breakdown.Values
            .OrderBy(b => b.DocumentTypeName)
            .ToList();

        dto.FleetCompliancePercent = m.Couriers.Count == 0
            ? 100m
            : Math.Round((decimal)dto.TotalCompliant * 100m / m.Couriers.Count, 1);

        // Top-10 urgent alerts: Expired > Missing-mandatory > Expiring (excluding Current).
        dto.UrgentAlerts = ComposeAlerts(m, includeCurrent: false)
            .Where(a => a.AlertStatus != "Missing" || IsMandatoryByName(a.DocumentType, m))
            .OrderBy(a => StatusSortKey(a.AlertStatus))
            .ThenBy(a => a.DaysUntilExpiry ?? int.MaxValue)
            .ThenBy(a => a.CourierName)
            .Take(10)
            .ToList();

        return dto;
    }

    // ─── Compose alerts ──────────────────────────────────────────────────

    private List<NpComplianceAlertDto> ComposeAlerts(ComplianceMatrix m, bool includeCurrent)
    {
        var alerts = new List<NpComplianceAlertDto>();
        foreach (var courier in m.Couriers)
        {
            foreach (var dt in m.DocTypes)
            {
                var (status, days) = ResolveStatus(courier, dt, m);

                // Only emit Missing alerts for mandatory doc types — non-mandatory
                // missing isn't a compliance violation.
                if (status == "Missing" && !dt.Mandatory) continue;
                if (status == "Current" && !includeCurrent) continue;

                m.Latest.TryGetValue((courier.Id, dt.Id), out var doc);
                alerts.Add(new NpComplianceAlertDto
                {
                    CourierId = courier.Id,
                    CourierName = courier.Name,
                    DocumentType = dt.Name,
                    ExpiryDate = doc?.Expiry?.ToString("yyyy-MM-dd"),
                    IsExpired = status == "Expired",
                    AlertStatus = status,
                    Fleet = null,                    // master-courier resolution deferred
                    DaysUntilExpiry = days,
                    Code = courier.Code,
                    Role = MapCourierRole(courier.CourierTypeId),
                    Phone = courier.Phone,
                    Email = courier.Email,
                    Vehicle = courier.Vehicle,
                    NetworkPartner = courier.NpAgentId is int npId && m.AgentNames.TryGetValue(npId, out var apName) && !string.IsNullOrWhiteSpace(apName)
                        ? apName
                        : "Direct",
                });
            }
        }
        return alerts;
    }

    // ─── Status derivation ───────────────────────────────────────────────

    private (string Status, int? DaysUntilExpiry) ResolveStatus(CourierSnapshot c, DocTypeSnapshot dt, ComplianceMatrix m)
    {
        if (!m.Latest.TryGetValue((c.Id, dt.Id), out var doc))
        {
            return (dt.Mandatory ? "Missing" : "Current", null);
        }
        return DeriveStatus(doc.Expiry, dt.ExpiryWarningDays);
    }

    private static (string Status, int? DaysUntilExpiry) DeriveStatus(DateOnly? expiry, int warningDays)
    {
        if (expiry is null)
        {
            // No expiry tracked on the doc → can't go stale → Current.
            return ("Current", null);
        }
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var diff = expiry.Value.DayNumber - today.DayNumber;
        var threshold = warningDays > 0 ? warningDays : ExpiryWarningDaysFallback;
        if (diff < 0) return ("Expired", diff);
        if (diff <= threshold) return ("Expiring", diff);
        return ("Current", diff);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private static int StatusSortKey(string status) => status switch
    {
        "Expired"  => 0,
        "Missing"  => 1,
        "Expiring" => 2,
        "Current"  => 3,
        _          => 4,
    };

    private static bool IsMandatoryByName(string docTypeName, ComplianceMatrix m) =>
        m.DocTypes.Any(d => d.Name == docTypeName && d.Mandatory);

    private static Dictionary<int, DocSnapshot> LatestPerDocType(IEnumerable<DocSnapshot> docs)
    {
        var result = new Dictionary<int, DocSnapshot>();
        foreach (var d in docs)                                // expects desc order by uploadedDate
        {
            if (!result.ContainsKey(d.DocTypeId)) result[d.DocTypeId] = d;
        }
        return result;
    }

    private static NpComplianceDashboardDto EmptyDashboard() => new()
    {
        TotalActiveCouriers = 0,
        TotalCompliant = 0,
        TotalWarnings = 0,
        TotalNonCompliant = 0,
        FleetCompliancePercent = 100m,
        BreakdownByType = new(),
        UrgentAlerts = new(),
    };

    private static NpCourierComplianceScoreResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
    };

    // ─── Internal records ────────────────────────────────────────────────

    private sealed record CourierSnapshot(
        int Id, string Name, int? NpAgentId,
        string? Code, int CourierTypeId, string? Email, string? Vehicle, string? Phone);

    // tucCourier.CourierTypeId: 1 Independent, 2 Master, 3 Sub, 4 Gig (NpFleetDtos).
    private static string MapCourierRole(int courierTypeId) => courierTypeId switch
    {
        1 => "Independent",
        2 => "Master",
        3 => "Sub",
        4 => "Gig",
        _ => "—",
    };

    // Per-agent courier-compliance tally (public — consumed by NpAgentComplianceService).
    public sealed class CourierComplianceRollup
    {
        public int Compliant { get; set; }
        public int Total { get; set; }
        public decimal Percent => Total == 0 ? 100m : Math.Round((decimal)Compliant * 100m / Total, 1);
    }
    private sealed record DocTypeSnapshot(int Id, string Name, string Category, bool Mandatory, int ExpiryWarningDays);
    private sealed record DocSnapshot(int CourierId, int DocTypeId, DateOnly? Expiry);

    private sealed record ComplianceMatrix(
        List<CourierSnapshot> Couriers,
        List<DocTypeSnapshot> DocTypes,
        Dictionary<(int CourierId, int DocTypeId), DocSnapshot> Latest,
        Dictionary<int, string> AgentNames);   // NpAgentId → agent name (for the Network Partner column)
}
