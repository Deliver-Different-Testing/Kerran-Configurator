using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Tenant;

// Agent/NP Onboarding pipeline DTOs (GARRY-AGENT-NP-ONBOARDING-REMOVE-DUMMY-DATA).
// Replaces the BUSINESS_ONBOARDING_SEED in-memory shape with real persisted rows.

public class TenantAgentOnboardingComplianceDto
{
    public string RequirementKey { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Status { get; set; } = "missing";   // complete / in_progress / missing
    public DateTime? UpdatedAt { get; set; }
    public string Notes { get; set; } = string.Empty;
}

public class TenantAgentOnboardingTimelineDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
    public DateTime EventAt { get; set; }
}

// Full detail — drives the five workspace tabs AND the pipeline list rows.
public class TenantAgentOnboardingDetailDto
{
    public int Id { get; set; }
    public int? LinkedAgentId { get; set; }
    public string BusinessName { get; set; } = string.Empty;
    public string PrimaryContact { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public List<string> Coverage { get; set; } = new();
    public string Association { get; set; } = string.Empty;
    public string MemberId { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string Stage { get; set; } = string.Empty;
    public string NetworkPartnerStatus { get; set; } = string.Empty;
    public string FleetProfile { get; set; } = string.Empty;
    public int EstimatedDrivers { get; set; }
    public List<string> ServiceCapabilities { get; set; } = new();
    public List<string> Specialties { get; set; } = new();
    public string Notes { get; set; } = string.Empty;
    public List<TenantAgentOnboardingComplianceDto> ComplianceItems { get; set; } = new();
    public bool ComplianceComplete { get; set; }
    public List<TenantAgentOnboardingTimelineDto> Timeline { get; set; } = new();
    public string Reviewer { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
    public bool Archived { get; set; }
    public DateTime LastUpdated { get; set; }
    public DateTime CreatedAt { get; set; }
}

// Create/update payload. On create the service fills defaults (stage, compliance
// template, the "created" timeline event); stage transitions go through the
// dedicated advance/approve/archive endpoints, not this DTO.
public class TenantAgentOnboardingUpsertDto
{
    public string BusinessName { get; set; } = string.Empty;
    public string PrimaryContact { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public List<string> Coverage { get; set; } = new();
    public string Association { get; set; } = "None";
    public string MemberId { get; set; } = string.Empty;
    public string Source { get; set; } = "Manual Entry";
    public string NetworkPartnerStatus { get; set; } = "Candidate";
    public string FleetProfile { get; set; } = string.Empty;
    public int EstimatedDrivers { get; set; }
    public List<string> ServiceCapabilities { get; set; } = new();
    public List<string> Specialties { get; set; } = new();
    public string Notes { get; set; } = string.Empty;
    public string Reviewer { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
}

// Records carry full detail (the pipeline list inline-expands each row), and an
// onboarding pipeline is small, so there's no value in a lean list projection.
public class TenantAgentOnboardingListResponse : BaseResponse
{
    public TenantAgentOnboardingListResponse(Guid messageId) : base(messageId) { }
    public List<TenantAgentOnboardingDetailDto> Records { get; set; } = new();
}

public class TenantAgentOnboardingResponse : BaseResponse
{
    public TenantAgentOnboardingResponse(Guid messageId) : base(messageId) { }
    public TenantAgentOnboardingDetailDto? Record { get; set; }
}
