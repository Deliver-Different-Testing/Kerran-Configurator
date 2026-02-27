using System;

namespace AdminManager.Core.Application.Dtos.AppConfig
{
    public class AppConfigDto
    {
        public int Id { get; set; }
        public string ConfigKey { get; set; }
        public string? ConfigValue { get; set; }
        public string DataType { get; set; }
        public string Category { get; set; }
        public string? Description { get; set; }
        public bool IsActive { get; set; }
        public DateTime Created { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? LastModified { get; set; }
        public string? LastModifiedBy { get; set; }
    }
}
