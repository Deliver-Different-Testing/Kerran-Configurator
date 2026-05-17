using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Public;
using DfrntDriveConfigurator.Core.Application.Services.Public;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Public;

// Phase 5+14 — anonymous public-link external-carrier flow. Prospect
// agents (CLDA/ECA, no Hub account) reach this controller via the signed
// /p/quote/{token} link in their invite email. No cookies, no role, no
// scope guard — the signed token IS the authorization.
//
//   GET /api/public/quotes/{token}         — invite info
//   PUT /api/public/quotes/{token}/submit  — Requested -> Submitted response
//
// Anonymous endpoints still respect the X-Requested-With CSRF requirement
// because the frontend (services/public_quotesService.ts) sends the
// header; rejecting requests without it is a cheap double-submit defence
// against direct browser address-bar POSTs.
[Route("api/public/quotes")]
[ApiController]
[AllowAnonymous]
public class PublicQuotesController(PublicQuotesService publicQuotesService) : BaseController
{
    [HttpGet("{token}")]
    public async Task<IActionResult> GetInvite(string token)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await publicQuotesService.GetInviteByToken(token, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Invite);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch public quote invite for token");
            throw;
        }
    }

    [HttpPut("{token}/submit")]
    public async Task<IActionResult> Submit(string token, [FromBody] PublicQuoteSubmitDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await publicQuotesService.SubmitByToken(token, dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Quotes);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to submit public quote for token");
            throw;
        }
    }
}
