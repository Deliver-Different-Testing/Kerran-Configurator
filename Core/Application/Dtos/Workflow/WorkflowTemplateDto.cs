using System;
using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Workflow
{
    public class WorkflowTemplateDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string? Description { get; set; }
        public int? ClientId { get; set; }
        public string? ClientName { get; set; }
        public int? SpeedId { get; set; }
        public string? SpeedName { get; set; }
        public bool IsActive { get; set; }
        public DateTime Created { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? LastModified { get; set; }
        public string? LastModifiedBy { get; set; }
        public string ScopeLabel { get; set; } // "Default", "Client", "Service", "Client+Service"
        public bool MirrorToAgentPortal { get; set; }
        public int StepCount { get; set; }
        public List<WorkflowTemplateDetailDto> Details { get; set; } = new();
    }

    public class WorkflowTemplateDetailDto
    {
        public int Id { get; set; }
        public int TemplateId { get; set; }
        public int StatusId { get; set; }
        public string StatusName { get; set; }
        public int EventTypeId { get; set; }
        public string EventTypeName { get; set; }
        public int TimeOffset { get; set; }
        public int Sequence { get; set; }
        public bool IsActive { get; set; }
        public bool Required { get; set; } = true;
        public string? ConfigJson { get; set; }
        public string Context { get; set; } = "both";
    }
}
