using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Workflow;

public class WorkflowLookupsResponse : BaseResponse
{
    public WorkflowLookupsResponse(Guid messageId) : base(messageId) { }
    public List<LookupItem> EventTypes { get; set; } = [];
    public List<LookupItem> JobStatuses { get; set; } = [];
}

public class LookupItem
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}
