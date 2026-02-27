using System.Collections.Generic;
using AdminManager.Core.Application.Dtos.Common;

namespace AdminManager.Core.Application.Dtos.Workflow
{
    public class WorkflowTemplateCreateRequest : BaseRequest
    {
        public string Name { get; set; }
        public string? Description { get; set; }
        public int? ClientId { get; set; }
        public int? SpeedId { get; set; }
        public bool IsActive { get; set; } = true;
        public bool MirrorToAgentPortal { get; set; }
        public List<WorkflowTemplateDetailCreateRequest> Details { get; set; } = new();
    }

    public class WorkflowTemplateDetailCreateRequest
    {
        public int StatusId { get; set; }
        public int EventTypeId { get; set; }
        public int TimeOffset { get; set; }
        public int Sequence { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
