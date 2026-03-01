using System;
using System.Collections.Generic;
using System.Linq;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers
{
    public abstract class BaseController : ControllerBase
    {
        protected IActionResult HandleInvalidModelState(Guid messageId)
        {
            var response = new BaseResponse(messageId);

            IEnumerable<MessageDto> messages = ModelState.Values.SelectMany(x => x.Errors.Select(e => new MessageDto() { Message = e.ErrorMessage }));

            response.Messages.AddRange(messages);

            Log.Warning($"Response ({response.MessageId}): {JsonConvert.SerializeObject(response)}");

            return BadRequest(response);
        }

        protected IActionResult HandleResponse(BaseResponse response)
        {
            Log.Information($"Response ({response.MessageId}): {JsonConvert.SerializeObject(response)}");

            if (response.Success)
                return Ok(response);

            return BadRequest(response);
        }

        protected IActionResult HandleResponseNoLogging(BaseResponse response)
        {
            if (response.Success)
                return Ok(response);

            return BadRequest(response);
        }
    }
}
