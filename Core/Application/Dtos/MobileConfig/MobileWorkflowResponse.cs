using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.MobileConfig
{
    public class MobileWorkflowResponse : BaseResponse
    {
        public MobileWorkflowResponse(Guid messageId) : base(messageId) { }

        public int JobId { get; set; }
        public string TemplateName { get; set; }
        public int TemplateId { get; set; }

        /// <summary>
        /// When true, this workflow is also visible in the Agent Portal (InboundAgent)
        /// so Network Partners see the same steps as drivers.
        /// </summary>
        public bool MirrorToAgentPortal { get; set; }

        public List<MobileWorkflowStepResponse> Steps { get; set; } = new();
    }

    public class MobileWorkflowStepResponse
    {
        public int TemplateDetailId { get; set; }
        public int Sequence { get; set; }
        public string EventTypeName { get; set; }
        public int EventTypeId { get; set; }
        public string StageTrigger { get; set; }
        public int TimeOffset { get; set; }
        public bool IsCompleted { get; set; }
        public DateTime? CompletedAt { get; set; }

        /// <summary>
        /// Source of this step: "template" (from base workflow) or "accessorial" (injected from AccessorialWorkflowTask)
        /// </summary>
        public string Source { get; set; } = "template";

        /// <summary>
        /// Whether this step is required for job completion (relevant for accessorial steps)
        /// </summary>
        public bool Required { get; set; } = true;

        /// <summary>
        /// Step-specific configuration JSON. Used by the generic fallback renderer
        /// when the MAUI app doesn't have a native renderer for this event type.
        /// Contains field definitions, validation rules, etc.
        /// </summary>
        public string? ConfigJson { get; set; }
    }
}
