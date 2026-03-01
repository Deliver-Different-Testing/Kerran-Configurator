using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Utilities
{
    public static class ResponseUtility
    {
        public static TBaseResponse AddMessageAndReturnResponse<TBaseResponse>(TBaseResponse response, string message) where TBaseResponse : BaseResponse
        {
            response.Messages.Add(new MessageDto() { Message = message });
            return response;
        }
    }
}
