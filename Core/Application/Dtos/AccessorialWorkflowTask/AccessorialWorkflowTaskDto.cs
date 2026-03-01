namespace DfrntDriveConfigurator.Core.Application.Dtos.AccessorialWorkflowTask
{
    public class AccessorialWorkflowTaskDto
    {
        public int Id { get; set; }
        public int AccessorialChargeId { get; set; }
        public string? AccessorialChargeName { get; set; }
        public int EventTypeId { get; set; }
        public string? EventTypeName { get; set; }
        public int StageId { get; set; }
        public string StageName { get; set; } = "";
        public int Sequence { get; set; }
        public bool Required { get; set; }
        public string? ConfigJson { get; set; }
        public bool Active { get; set; }
    }

    public class AccessorialWorkflowTaskCreateRequest
    {
        public int AccessorialChargeId { get; set; }
        public int EventTypeId { get; set; }
        public int StageId { get; set; }
        public int Sequence { get; set; }
        public bool Required { get; set; } = true;
        public string? ConfigJson { get; set; }
    }

    public class AccessorialWorkflowTaskUpdateRequest : AccessorialWorkflowTaskCreateRequest
    {
        public int Id { get; set; }
    }
}
