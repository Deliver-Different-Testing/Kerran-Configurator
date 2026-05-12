using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Np;

// Carrier-side quote endpoints. Phase 5+12 introduces the NP-portal flow:
// pending-invite inbox + submit response. The state machine itself lives in
// TenantQuotesService — NpQuotesService applies the scope guard and delegates.
//
//   GET /api/v1/np/quotes/pending           — invites awaiting this carrier
//   PUT /api/v1/np/quotes/{quoteId}/submit  — Requested → Submitted with payload
//
// Carrier UI for external (CLDA/ECA) prospect agents lands in a later slice —
// that flow uses a separate public-link controller with anonymous auth.
[Route("api/v1/np/quotes")]
[ApiController]
[Authorize(Policy = "NetworkPartnerOrAdmin")]
public class NpQuotesController(NpQuotesService npQuotesService) : BaseController
{
    [HttpGet("pending")]
    public async Task<IActionResult> GetPending()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await npQuotesService.GetPendingInvites(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Invites);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch NP pending invites");
            throw;
        }
    }

    [HttpPut("{quoteId:int}/submit")]
    public async Task<IActionResult> Submit(int quoteId, [FromBody] NpQuoteSubmitDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await npQuotesService.SubmitInvite(quoteId, dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Quotes);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to submit NP quote {QuoteId}", quoteId);
            throw;
        }
    }
}
