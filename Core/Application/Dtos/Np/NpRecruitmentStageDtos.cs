using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Mirrors the React RecruitmentStageConfig type, backed by the
// RecruitmentStages table (migration 031). tenantId is omitted — per-tenant DB.
public class NpRecruitmentStageDto
{
    public int Id { get; set; }
    public string StageName { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool Enabled { get; set; }
    public bool Mandatory { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedDate { get; set; }
}

public class NpRecruitmentStageUpsertDto
{
    public string StageName { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool Enabled { get; set; } = true;
    public bool Mandatory { get; set; }
    public string Description { get; set; } = string.Empty;
}

public class NpRecruitmentStagesResponse : BaseResponse
{
    public NpRecruitmentStagesResponse(Guid messageId) : base(messageId) { }
    public List<NpRecruitmentStageDto> Stages { get; set; } = new();
}

public class NpRecruitmentStageResponse : BaseResponse
{
    public NpRecruitmentStageResponse(Guid messageId) : base(messageId) { }
    public NpRecruitmentStageDto? Stage { get; set; }
}
