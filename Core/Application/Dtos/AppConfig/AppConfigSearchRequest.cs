using AdminManager.Core.Application.Dtos.Common;

namespace AdminManager.Core.Application.Dtos.AppConfig
{
    public class AppConfigSearchRequest : BaseRequest
    {
        public string? Category { get; set; }
        public string? SearchText { get; set; }
    }
}
