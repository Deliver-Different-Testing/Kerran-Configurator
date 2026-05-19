using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// Read-only lookup feeds for select dropdowns on NP-side pages.
//   GET /api/v1/np/lookups/vehicle-makes
//   GET /api/v1/np/lookups/insurance-companies
//   GET /api/v1/np/lookups/courier-fleets
[Route("api/v1/np/lookups")]
[ApiController]
[Authorize(Policy = "NetworkPartnerOrAdmin")]
public class NpLookupController(NpLookupService lookupService) : BaseController
{
    [HttpGet("vehicle-makes")]
    public async Task<IActionResult> GetVehicleMakes()
    {
        try
        {
            var items = await lookupService.GetVehicleMakes();
            return Ok(items);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch vehicle-makes lookup");
            throw;
        }
    }

    [HttpGet("insurance-companies")]
    public async Task<IActionResult> GetInsuranceCompanies()
    {
        try
        {
            var items = await lookupService.GetInsuranceCompanies();
            return Ok(items);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch insurance-companies lookup");
            throw;
        }
    }

    [HttpGet("courier-fleets")]
    public async Task<IActionResult> GetCourierFleets()
    {
        try
        {
            var items = await lookupService.GetCourierFleets();
            return Ok(items);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch courier-fleets lookup");
            throw;
        }
    }
}
