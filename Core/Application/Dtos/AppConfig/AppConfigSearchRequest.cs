using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.AppConfig
{
    public class AppConfigSearchRequest : BaseRequest
    {
        public string? Category { get; set; }
        public string? SearchText { get; set; }
    }
}
