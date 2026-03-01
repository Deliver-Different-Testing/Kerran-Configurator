using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.MobileConfig
{
    public class MobileConfigResponse : BaseResponse
    {
        public MobileConfigResponse(Guid messageId) : base(messageId) { }

        /// <summary>Feature flags: key → enabled (e.g. "barcodeScan" → true)</summary>
        public Dictionary<string, bool> Features { get; set; } = new();

        /// <summary>Branding settings: key → value (e.g. "primaryColor" → "#1976D2")</summary>
        public Dictionary<string, string> Branding { get; set; } = new();

        /// <summary>Available support task types for the courier</summary>
        public List<MobileTaskDto> SupportTasks { get; set; } = new();
    }

    public class MobileTaskDto
    {
        public int EventTypeId { get; set; }
        public string Name { get; set; }
    }
}
