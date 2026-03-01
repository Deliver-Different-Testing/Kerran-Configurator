using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.AppConfig
{
    public class AppConfigCreateRequest : BaseRequest
    {
        public string ConfigKey { get; set; }
        public string? ConfigValue { get; set; }
        public string DataType { get; set; } = "string";
        public string Category { get; set; } = "feature";
        public string? Description { get; set; }
    }
}
