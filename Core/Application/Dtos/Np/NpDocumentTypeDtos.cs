using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Mirrors the React DocumentType type (wwwroot/app/react/types/index.ts),
// backed by the DocumentTypes table (migration 030). tenantId is omitted —
// the per-tenant-DB model has no tenant column.
public class NpDocumentTypeDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Instructions { get; set; } = string.Empty;
    public string Category { get; set; } = "Other";
    public bool Mandatory { get; set; }
    public bool Active { get; set; }
    public bool HasExpiry { get; set; }
    public int ExpiryWarningDays { get; set; }
    public bool BlockOnExpiry { get; set; }
    public string AppliesTo { get; set; } = "Both";
    public int SortOrder { get; set; }
    public string Purpose { get; set; } = "Compliance";
    public string ContentUrl { get; set; } = string.Empty;
    public int? EstimatedMinutes { get; set; }
    public bool QuizRequired { get; set; }
    public bool HasTemplate { get; set; }
    public string TemplateFileName { get; set; } = string.Empty;
    public string TemplateMimeType { get; set; } = string.Empty;
    // Tenant-defined AI accept/reject criteria for this doc type (Phase 3b).
    // Null/empty → the reviewer falls back to its built-in default prompt.
    public string ReviewCriteria { get; set; } = string.Empty;
    public DateTime CreatedDate { get; set; }
    public DateTime? ModifiedDate { get; set; }
}

// Editable subset for POST/PUT. Excludes Id + audit dates; the template
// metadata (HasTemplate/TemplateFileName/...) is owned by the template-upload
// flow, not the settings form.
public class NpDocumentTypeUpsertDto
{
    public string Name { get; set; } = string.Empty;
    public string Instructions { get; set; } = string.Empty;
    public string Category { get; set; } = "Other";
    public bool Mandatory { get; set; }
    public bool Active { get; set; } = true;
    public bool HasExpiry { get; set; }
    public int ExpiryWarningDays { get; set; } = 30;
    public bool BlockOnExpiry { get; set; }
    public string AppliesTo { get; set; } = "Both";
    public int SortOrder { get; set; }
    public string Purpose { get; set; } = "Compliance";
    public string ContentUrl { get; set; } = string.Empty;
    public int? EstimatedMinutes { get; set; }
    public bool QuizRequired { get; set; }
    public string ReviewCriteria { get; set; } = string.Empty;
}

public class NpDocumentTypesResponse : BaseResponse
{
    public NpDocumentTypesResponse(Guid messageId) : base(messageId) { }
    public List<NpDocumentTypeDto> DocumentTypes { get; set; } = new();
}

public class NpDocumentTypeResponse : BaseResponse
{
    public NpDocumentTypeResponse(Guid messageId) : base(messageId) { }
    public NpDocumentTypeDto? DocumentType { get; set; }
}
