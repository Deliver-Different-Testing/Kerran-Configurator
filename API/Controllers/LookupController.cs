using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Policy = "AdminOnly")]
    public class LookupController : BaseController
    {
        private readonly LookupService _lookupService;

        public LookupController(LookupService lookupService)
        {
            _lookupService = lookupService;
        }

        [HttpGet("clients")]
        public async Task<IActionResult> GetClients([FromQuery] string? q = null, [FromQuery] int limit = 50)
        {
            try
            {
                Guid messageId = Guid.NewGuid();
                Log.Information($"({Request.Method} {Request.Path}): {messageId}");

                if (q != null || limit != 50)
                {
                    return HandleResponseNoLogging(await _lookupService.SearchClients(q, Math.Clamp(limit, 1, 200), messageId));
                }

                return HandleResponseNoLogging(await _lookupService.GetClients(messageId));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }

        [HttpGet("services")]
        public async Task<IActionResult> GetServices([FromQuery] string? q = null, [FromQuery] int limit = 50)
        {
            try
            {
                Guid messageId = Guid.NewGuid();
                Log.Information($"({Request.Method} {Request.Path}): {messageId}");

                if (q != null || limit != 50)
                {
                    return HandleResponseNoLogging(await _lookupService.SearchServices(q, Math.Clamp(limit, 1, 200), messageId));
                }

                return HandleResponseNoLogging(await _lookupService.GetServices(messageId));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }
    }
}
