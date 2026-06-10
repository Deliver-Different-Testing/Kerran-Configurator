using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Agent / NP business-document compliance aggregates. Computed live against the
// NP DocumentTypes (AppliesTo IN ('NP','All')) + tucAgentDocument, with
// onboarding carry-through from TucAgentOnboardingCompliance. Mirrors the FE
// BusinessComplianceSummary contract (pages/tenant/agentComplianceService.ts) so
// the Compliance Hub + AgentWorkspace scorecards drop straight onto these.
//
// Profile-driven per-agent requirement sets + client overlays are NOT applied
// here yet (Phase 4) — this emits the flat "all active NP doc types" matrix.

public class AgentBusinessComplianceSummaryDto
{
    public int TotalDocuments { get; set; }
    public int ApprovedDocuments { get; set; }
    public int MandatoryDocuments { get; set; }
    public int ApprovedMandatoryDocuments { get; set; }
    public int PendingDocuments { get; set; }
    public int RejectedDocuments { get; set; }
    public int MissingDocuments { get; set; }
}

public class AgentDocRequirementStatusDto
{
    public int DocumentTypeId { get; set; }
    public string DocumentTypeName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool Mandatory { get; set; }
    // FE vocab: missing | under_review | approved | rejected
    public string Status { get; set; } = "missing";
    // Where the satisfied state came from: directory | upload | onboarding
    public string Source { get; set; } = "directory";
    public int? DocumentId { get; set; }              // tucAgentDocument.UcadId when source = upload
    public string? ExpiryDate { get; set; }           // ISO "yyyy-MM-dd" or null
    public int? DaysUntilExpiry { get; set; }
    public bool IsExpiring { get; set; }              // approved + within warning (orange) window
    public bool IsExpiringUrgent { get; set; }        // approved + within urgent (red) window
    public bool IsExpired { get; set; }
}

// Per-agent scorecard — feeds AgentWorkspace's Compliance / Pending Review /
// Rejected-Missing cards + the Agent / NP Compliance tab rows.
public class AgentComplianceDetailDto
{
    public int AgentId { get; set; }
    public decimal CompliancePercent { get; set; }       // business-doc completeness % (25% weight)
    public decimal CourierCompliancePercent { get; set; } // courier roll-up % (75% weight)
    public decimal OverallScorePercent { get; set; }     // 0.25*docs + 0.75*courier (Steve, 2026-06-10)
    public AgentBusinessComplianceSummaryDto Summary { get; set; } = new();
    public List<AgentDocRequirementStatusDto> Requirements { get; set; } = new();
}

// Compliance-only roster row. Identity (name/contact/city/NP-tier) is joined on
// the FE from the live /api/v1/tenant/agents roster — not duplicated here.
public class AgentComplianceRosterItemDto
{
    public int AgentId { get; set; }
    public decimal CompliancePercent { get; set; }        // business-doc completeness %
    public decimal CourierCompliancePercent { get; set; } // courier roll-up %
    public decimal OverallScorePercent { get; set; }      // blended 25/75 NP score
    public string RiskLevel { get; set; } = "Low";        // High | Medium | Low
    public AgentBusinessComplianceSummaryDto Summary { get; set; } = new();
}

public class AgentComplianceDashboardDto
{
    public int TotalAgents { get; set; }
    public int CompliantAgents { get; set; }
    public int HighRiskAgents { get; set; }
    public int AgentsWithExpiring { get; set; }
    public int AgentsWithMissingMandatory { get; set; }
    public int TotalMissingMandatoryDocs { get; set; }
    public int TotalExpiringDocs { get; set; }
    public decimal AverageCompliancePercent { get; set; }
}

public class AgentComplianceOnboardingSummaryDto
{
    public int CarriedThroughItems { get; set; }      // onboarding compliance items surfaced as already-accepted
    public int AgentsWithCarriedDocs { get; set; }
}

public class AgentComplianceDetailResponse : BaseResponse
{
    public AgentComplianceDetailResponse(Guid messageId) : base(messageId) { }
    public AgentComplianceDetailDto? Detail { get; set; }
}

public class AgentComplianceRosterResponse : BaseResponse
{
    public AgentComplianceRosterResponse(Guid messageId) : base(messageId) { }
    public List<AgentComplianceRosterItemDto> Roster { get; set; } = new();
}

public class AgentComplianceDashboardResponse : BaseResponse
{
    public AgentComplianceDashboardResponse(Guid messageId) : base(messageId) { }
    public AgentComplianceDashboardDto Dashboard { get; set; } = new();
}

public class AgentComplianceOnboardingSummaryResponse : BaseResponse
{
    public AgentComplianceOnboardingSummaryResponse(Guid messageId) : base(messageId) { }
    public AgentComplianceOnboardingSummaryDto Summary { get; set; } = new();
}
