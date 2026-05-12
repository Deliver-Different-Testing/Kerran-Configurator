using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Application.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.Api.Controllers.Tenant;

// Read-only first slice of the Quotes/Marketplace vertical.
//   GET /api/v1/tenant/quotes/postings           — list all postings
//   GET /api/v1/tenant/quotes/postings/{id}/quotes — quotes submitted for one
// Write/discovery endpoints (createPosting / searchCarriers / sendQuoteRequest)
// land in a separate later pass.
[Route("api/v1/tenant/quotes")]
[ApiController]
[Authorize(Policy = "TenantStaffOrAdmin")]
public class TenantQuotesController(TenantQuotesService quotesService) : BaseController
{
    [HttpGet("postings")]
    public async Task<IActionResult> GetPostings()
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await quotesService.GetPostings(messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Postings);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch quote postings");
            throw;
        }
    }

    [HttpGet("postings/{id:int}/quotes")]
    public async Task<IActionResult> GetQuotesForPosting(int id)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await quotesService.GetQuotesForPosting(id, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Quotes);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to fetch quotes for posting {Id}", id);
            throw;
        }
    }

    [HttpPost("postings")]
    public async Task<IActionResult> CreatePosting([FromBody] TenantQuotePostingCreateDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await quotesService.CreatePosting(dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Posting);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to create quote posting");
            throw;
        }
    }

    [HttpPost("quote-request")]
    public async Task<IActionResult> CreateQuoteRequest([FromBody] TenantQuoteRequestCreateDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await quotesService.CreateQuoteRequest(dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Quotes);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to create quote request");
            throw;
        }
    }

    [HttpPost("{quoteId:int}/award")]
    public async Task<IActionResult> AwardQuote(int quoteId)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await quotesService.AwardQuote(quoteId, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Quotes);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to award quote {QuoteId}", quoteId);
            throw;
        }
    }

    // Carrier-side response: transitions Requested → Submitted with rate /
    // lead-time / fleet-size payload. No NP-scope guard yet — the carrier
    // response UI (next slice) will introduce auth for the carrier identity.
    [HttpPut("{quoteId:int}/submit")]
    public async Task<IActionResult> SubmitQuote(int quoteId, [FromBody] TenantQuoteSubmitDto dto)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await quotesService.SubmitQuote(quoteId, dto, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response.Quotes);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to submit quote {QuoteId}", quoteId);
            throw;
        }
    }

    // Manual sweep trigger. Marks Requested/Submitted quotes as Expired when
    // parent posting is Awarded/Closed or its EndDate has passed. GetQuotesForPosting
    // already auto-sweeps the posting being viewed; this endpoint is for cron-style
    // bulk sweeps (no postingId) or targeted reconciliation.
    [HttpPost("expire-sweep")]
    public async Task<IActionResult> ExpireSweep([FromQuery] int? postingId = null)
    {
        try
        {
            var messageId = Guid.NewGuid();
            Log.Information("({Method} {Path}): {MessageId}", Request.Method, Request.Path, messageId);

            var response = await quotesService.ExpireStaleQuotes(postingId, messageId);
            if (!response.Success) return BadRequest(response);
            return Ok(response);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to run expire sweep");
            throw;
        }
    }
}
