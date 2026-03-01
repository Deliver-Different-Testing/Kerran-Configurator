using System;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Common
{
    public class BaseRequest
    {
        public Guid MessageId { get; set; } = Guid.NewGuid();
    }
}
