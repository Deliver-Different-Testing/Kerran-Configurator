using System;
using System.Collections.Generic;
using AdminManager.Core.Application.Dtos.Common;

namespace AdminManager.Core.Application.Dtos.Workflow
{
    public class WorkflowTemplateResponse : BaseResponse
    {
        public WorkflowTemplateResponse(Guid messageId) : base(messageId) { }
        public WorkflowTemplateDto Template { get; set; }
    }

    public class WorkflowTemplatesResponse : BaseResponse
    {
        public WorkflowTemplatesResponse(Guid messageId) : base(messageId) { }
        public IEnumerable<WorkflowTemplateDto> Templates { get; set; }
    }
}
