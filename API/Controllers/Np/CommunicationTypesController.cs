using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

/// <summary>
/// Courier modal §14 — tenant-editable tucEventType catalogue (the courier-comms
/// 'CE' group, and other groups). Drives the §13 Communications Type dropdown.
/// TenantStaffOrAdmin (the existing EventTypeController stays AdminOnly for the
/// automation/workflow group-mapping CRUD; this is the simpler settings surface).
///
///   GET  /api/v1/np/communication-types?group=CE  — catalogue (optionally by group)
///   POST /api/v1/np/communication-types           — add a type
///   PUT  /api/v1/np/communication-types/{id}       — edit a type
/// </summary>
[Route("api/v1/np/communication-types")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class CommunicationTypesController(EventTypeService service) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? group = null)
    {
        try
        {
            Log.Information("({Method} {Path})", Request.Method, Request.Path);
            return HandleResponseNoLogging(await service.GetCatalog(Guid.NewGuid(), group));
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to load communication types");
            throw;
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] EventTypeCatalogRequest request)
    {
        try
        {
            Log.Information("({Method} {Path})", Request.Method, Request.Path);
            return HandleResponse(await service.CreateCatalogItem(request?.Name ?? "", request?.Group ?? "", Guid.NewGuid()));
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to create communication type");
            throw;
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] EventTypeCatalogRequest request)
    {
        try
        {
            Log.Information("({Method} {Path})", Request.Method, Request.Path);
            return HandleResponse(await service.UpdateCatalogItem(id, request?.Name ?? "", request?.Group ?? "", Guid.NewGuid()));
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to update communication type {Id}", id);
            throw;
        }
    }
}
