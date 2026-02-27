using System;
using System.Collections.Generic;
using AdminManager.Core.Application.Dtos.Common;

namespace AdminManager.Core.Application.Dtos.Workflow
{
    public class WorkflowNlpResponse : BaseResponse
    {
        public WorkflowNlpResponse(Guid messageId) : base(messageId) { }

        public string SuggestedName { get; set; }
        public string? ClientScope { get; set; }
        public string? ServiceScope { get; set; }
        public List<WorkflowNlpStepDto> Steps { get; set; } = new();
        public string Explanation { get; set; }
    }

    public class WorkflowNlpStepDto
    {
        public int? EventTypeId { get; set; }
        public string EventTypeName { get; set; }
        public int Sequence { get; set; }
        public int? StatusId { get; set; }
        public string StageTrigger { get; set; }
        public int TimeOffset { get; set; }
    }
}
