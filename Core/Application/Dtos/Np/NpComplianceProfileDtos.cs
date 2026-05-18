using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Mirrors the React ComplianceProfile type (wwwroot/app/react/types/index.ts),
// backed by ComplianceProfiles + ComplianceProfileRequirements +
// ComplianceProfileClient (migration 030). tenantId / clientId(s) on the React
// type are vestigial — the UI works with client *names*; see ClientNames.
public class NpComplianceProfileDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
    public bool Active { get; set; }
    public List<string> ClientNames { get; set; } = new();
    public List<NpComplianceRequirementDto> Requirements { get; set; } = new();
    public DateTime CreatedDate { get; set; }
    public DateTime? ModifiedDate { get; set; }
}

// purpose + documentTypeName are derived from the joined DocumentType.
public class NpComplianceRequirementDto
{
    public int Id { get; set; }
    public int ProfileId { get; set; }
    public int DocumentTypeId { get; set; }
    public string DocumentTypeName { get; set; } = string.Empty;
    public string Purpose { get; set; } = "Compliance";
    public bool Mandatory { get; set; }
    public int SortOrder { get; set; }
    public bool QuizRequired { get; set; }
    public int? QuizId { get; set; }
}

// POST/PUT payload. ClientNames + Requirements are the full desired sets —
// the service reconciles the child rows. Requirement Id is not sent: rows are
// matched by DocumentTypeId (a profile holds at most one per document type).
public class NpComplianceProfileUpsertDto
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
    public bool Active { get; set; } = true;
    public List<string> ClientNames { get; set; } = new();
    public List<NpComplianceRequirementUpsertDto> Requirements { get; set; } = new();
}

public class NpComplianceRequirementUpsertDto
{
    public int DocumentTypeId { get; set; }
    public bool Mandatory { get; set; } = true;
    public int SortOrder { get; set; }
    public bool QuizRequired { get; set; }
    public int? QuizId { get; set; }
}

public class NpComplianceProfilesResponse : BaseResponse
{
    public NpComplianceProfilesResponse(Guid messageId) : base(messageId) { }
    public List<NpComplianceProfileDto> Profiles { get; set; } = new();
}

public class NpComplianceProfileResponse : BaseResponse
{
    public NpComplianceProfileResponse(Guid messageId) : base(messageId) { }
    public NpComplianceProfileDto? Profile { get; set; }
}
