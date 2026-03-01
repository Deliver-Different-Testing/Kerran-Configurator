using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Workflow
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
