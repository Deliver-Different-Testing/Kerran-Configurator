using System;
using System.Threading.Tasks;
using AdminManager.Core.Application.Dtos.AppConfig;
using AdminManager.Core.Application.Dtos.Common;
using AdminManager.Core.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Serilog;

namespace AdminManager.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Policy = "AdminOnly")]
    public class AppConfigController : BaseController
    {
        private readonly AppConfigService _appConfigService;

        public AppConfigController(AppConfigService appConfigService)
        {
            _appConfigService = appConfigService;
        }

        [HttpPost("Search")]
        public async Task<IActionResult> Search([FromBody] AppConfigSearchRequest request)
        {
            try
            {
                Log.Information($"({Request.Method} {Request.Path}): {JsonConvert.SerializeObject(request)}");

                if (!ModelState.IsValid)
                    return HandleInvalidModelState(request.MessageId);

                return HandleResponseNoLogging(await _appConfigService.Search(request));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }

        [HttpGet("{Id}")]
        public async Task<IActionResult> Get([FromRoute] IdRequest request)
        {
            try
            {
                Log.Information($"({Request.Method} {Request.Path}): {JsonConvert.SerializeObject(request)}");

                if (!ModelState.IsValid)
                    return HandleInvalidModelState(request.MessageId);

                return HandleResponse(await _appConfigService.Get(request));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }

        [HttpGet]
        public async Task<IActionResult> Get()
        {
            try
            {
                Guid messageId = Guid.NewGuid();
                Log.Information($"({Request.Method} {Request.Path}): {messageId}");

                if (!ModelState.IsValid)
                    return HandleInvalidModelState(messageId);

                return HandleResponseNoLogging(await _appConfigService.Get(messageId));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] AppConfigCreateRequest request)
        {
            try
            {
                Log.Information($"({Request.Method} {Request.Path}): {JsonConvert.SerializeObject(request)}");

                if (!ModelState.IsValid)
                    return HandleInvalidModelState(request.MessageId);

                return HandleResponse(await _appConfigService.Create(request));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }

        [HttpPost("{Id}")]
        public async Task<IActionResult> Update([FromRoute] int id, [FromBody] AppConfigUpdateRequest request)
        {
            try
            {
                request.Id = id;
                Log.Information($"({Request.Method} {Request.Path}): {JsonConvert.SerializeObject(request)}");

                if (!ModelState.IsValid)
                    return HandleInvalidModelState(request.MessageId);

                return HandleResponse(await _appConfigService.Update(request));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }

        [HttpDelete("{Id}")]
        public async Task<IActionResult> Delete([FromRoute] IdRequest request)
        {
            try
            {
                Log.Information($"({Request.Method} {Request.Path}): {JsonConvert.SerializeObject(request)}");

                if (!ModelState.IsValid)
                    return HandleInvalidModelState(request.MessageId);

                return HandleResponse(await _appConfigService.Delete(request));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }
    }
}
