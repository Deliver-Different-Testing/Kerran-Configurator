using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Shapes mirror the React types in wwwroot/app/react/types/index.ts
// (ComplianceDashboard / ComplianceBreakdownByType / ComplianceAlert /
//  CourierComplianceScore / CourierDocTypeStatus).
//
// Phase 5+25 expands the original stub to the full dashboard payload,
// computed live against DocumentTypes + CourierDocuments (Phase 5+17 /
// Phase 5+23). Profile-driven per-courier requirement matrices are NOT
// applied here — the frontend overlays profile filters on top of the
// flat "all mandatory active doc types" model emitted here.

public class NpComplianceDashboardDto
{
    public int TotalActiveCouriers { get; set; }
    public int TotalCompliant { get; set; }
    public int TotalWarnings { get; set; }
    public int TotalNonCompliant { get; set; }
    public decimal FleetCompliancePercent { get; set; }
    public List<NpComplianceBreakdownDto> BreakdownByType { get; set; } = new();
    public List<NpComplianceAlertDto> UrgentAlerts { get; set; } = new();
}

public class NpComplianceBreakdownDto
{
    public int DocumentTypeId { get; set; }
    public string DocumentTypeName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int TotalRequired { get; set; }
    public int Current { get; set; }
    public int Expiring { get; set; }
    public int Expired { get; set; }
    public int Missing { get; set; }
}

public class NpComplianceAlertDto
{
    public int CourierId { get; set; }
    public string CourierName { get; set; } = string.Empty;
    public string DocumentType { get; set; } = string.Empty;
    public string? ExpiryDate { get; set; }                // ISO date "yyyy-MM-dd" or null
    public bool IsExpired { get; set; }
    public string AlertStatus { get; set; } = "Current";   // Expired | Expiring | Missing | Current
    public string? Fleet { get; set; }                     // null for now — master-courier resolution deferred
    public int? DaysUntilExpiry { get; set; }

    // Courier operator context (Steve 2026-06-12 — Compliance Risk columns).
    // Repeats across a courier's per-document rows; sourced live from TucCourier
    // (+ TucAgent for the network-partner name; "Direct" when the courier has
    // no NpAgentId).
    public string? Code { get; set; }
    public string? Role { get; set; }                      // Independent | Master | Sub | Gig
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Vehicle { get; set; }
    public string NetworkPartner { get; set; } = "Direct";
}

public class NpCourierComplianceScoreDto
{
    public int CourierId { get; set; }
    public string CourierName { get; set; } = string.Empty;
    public string Status { get; set; } = "active";         // matches React 'active' | 'inactive'
    public decimal CompliancePercent { get; set; }
    public List<NpCourierDocTypeStatusDto> DocumentStatuses { get; set; } = new();
}

public class NpCourierDocTypeStatusDto
{
    public int DocumentTypeId { get; set; }
    public string DocumentTypeName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool Mandatory { get; set; }
    public string Status { get; set; } = "Current";        // Current | ExpiringSoon | Expired | Missing
    public string? ExpiryDate { get; set; }
    public int? DaysUntilExpiry { get; set; }
}

public class NpComplianceDashboardResponse : BaseResponse
{
    public NpComplianceDashboardResponse(Guid messageId) : base(messageId) { }
    public NpComplianceDashboardDto Dashboard { get; set; } = new();
}

public class NpComplianceAlertsResponse : BaseResponse
{
    public NpComplianceAlertsResponse(Guid messageId) : base(messageId) { }
    public List<NpComplianceAlertDto> Alerts { get; set; } = new();
}

public class NpCourierComplianceScoreResponse : BaseResponse
{
    public NpCourierComplianceScoreResponse(Guid messageId) : base(messageId) { }
    public NpCourierComplianceScoreDto? Score { get; set; }
}
