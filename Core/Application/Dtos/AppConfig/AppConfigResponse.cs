using System;
using System.Collections.Generic;
using AdminManager.Core.Application.Dtos.Common;

namespace AdminManager.Core.Application.Dtos.AppConfig
{
    public class AppConfigResponse : BaseResponse
    {
        public AppConfigResponse(Guid messageId) : base(messageId) { }
        public AppConfigDto Config { get; set; }
    }

    public class AppConfigsResponse : BaseResponse
    {
        public AppConfigsResponse(Guid messageId) : base(messageId) { }
        public IEnumerable<AppConfigDto> Configs { get; set; }
    }
}
