using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Workflow
{
    public class WorkflowNlpRequest : BaseRequest
    {
        public string Instruction { get; set; }
    }
}
