using AdminManager.Core.Application.Dtos.Common;

namespace AdminManager.Core.Application.Dtos.Workflow
{
    public class WorkflowNlpRequest : BaseRequest
    {
        public string Instruction { get; set; }
    }
}
