using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Policy = "AdminOnly")]
public class EventTypeController(EventTypeService eventTypeService) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            Log.Information($"({Request.Method} {Request.Path})");
            return HandleResponseNoLogging(await eventTypeService.GetAll(Guid.NewGuid()));
        }
        catch (Exception e)
        {
            Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
            throw;
        }
    }

    [HttpPost("Search")]
    public async Task<IActionResult> Search([FromBody] SearchRequest request)
    {
        try
        {
            Log.Information($"({Request.Method} {Request.Path}): {JsonConvert.SerializeObject(request)}");
            if (!ModelState.IsValid) return HandleInvalidModelState(request.MessageId);
            return HandleResponseNoLogging(await eventTypeService.Search(request));
        }
        catch (Exception e)
        {
            Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
            throw;
        }
    }

    [HttpGet("{eventTypeId}/eventTypeGroups")]
    public async Task<IActionResult> GetEventTypeGroups(int eventTypeId)
    {
        try
        {
            Log.Information($"({Request.Method} {Request.Path})");
            return HandleResponseNoLogging(await eventTypeService.GetEventTypeGroups(eventTypeId, Guid.NewGuid()));
        }
        catch (Exception e)
        {
            Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
            throw;
        }
    }

    [HttpPost("{eventTypeId}/eventTypeGroups")]
    public async Task<IActionResult> AddEventTypeGroup(int eventTypeId, [FromBody] AddEventTypeGroupRequest request)
    {
        try
        {
            Log.Information($"({Request.Method} {Request.Path}): {JsonConvert.SerializeObject(request)}");
            return HandleResponse(await eventTypeService.AddEventTypeGroup(eventTypeId, request.EventTypeGroupId, request.Sequence, request.MessageId));
        }
        catch (Exception e)
        {
            Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
            throw;
        }
    }

    [HttpDelete("{eventTypeId}/eventTypeGroups/{mappingId}")]
    public async Task<IActionResult> DeleteEventTypeGroup(int eventTypeId, int mappingId)
    {
        try
        {
            Log.Information($"({Request.Method} {Request.Path})");
            return HandleResponse(await eventTypeService.DeleteEventTypeGroup(eventTypeId, mappingId, Guid.NewGuid()));
        }
        catch (Exception e)
        {
            Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
            throw;
        }
    }
}
