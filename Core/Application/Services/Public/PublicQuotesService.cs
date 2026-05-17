using System;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Dtos.Public;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Application.Services.Tenant;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Public;

// Phase 5+14 / slice 2b — anonymous public-link carrier-response flow.
//
// External CLDA/ECA prospect agents receive a /p/quote/{token} link in
// their invite email (issued by QuoteInviteTokenService, 30-day TTL).
// This service validates the token and either returns the invite info
// (GET) or applies a state transition (PUT submit). State-machine
// ownership stays with TenantQuotesService.SubmitQuote — this service
// only enforces the public-flow constraints:
//   * Token must be valid (not tampered, not expired)
//   * Quote must be for a ProspectAgent (not a known NP agent)
//   * Quote must be in Requested or Submitted state (not terminal)
// Token reuse is allowed while the quote is editable; once a tenant
// Awards (status -> Accepted/Declined) or sweep marks Expired, the
// public flow rejects further submissions.
public class PublicQuotesService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IHttpContextAccessor httpContextAccessor,
    QuoteInviteTokenService tokenService,
    TenantQuotesService tenantQuotesService) : BaseService(contextFactory)
{
    // Stash the tenant id from the signed token into HttpContext.Items so
    // DynamicDespatchDbContextFactory can resolve the per-tenant connection
    // string without a CurrentTenantID claim. Propagates to TenantQuotesService
    // when we delegate the state-machine to it.
    private void ApplyTenantOverride(string tenantId)
    {
        var ctx = httpContextAccessor.HttpContext;
        if (ctx is not null)
            ctx.Items[DynamicDespatchDbContextFactory.OverrideTenantIdItemsKey] = tenantId;
    }

    public async Task<PublicQuoteInviteResponse> GetInviteByToken(string token, Guid messageId)
    {
        var decoded = tokenService.TryRead(token);
        if (decoded is null)
            return FailInvite(messageId, "This invitation link is invalid or has expired.");

        var (tenantId, quoteId) = decoded.Value;
        ApplyTenantOverride(tenantId);

        var row = await Context.QuotesQuotes.AsNoTracking()
            .Where(q => q.Id == quoteId)
            .Select(q => new
            {
                q.Id,
                q.Status,
                q.AgentId,
                q.ProspectAgentId,
                q.ProposedRate,
                q.RateType,
                q.AvailableFleetSize,
                q.AvailableStartDate,
                q.Message,
                TenantMessage = q.Message,
                ProspectName = q.ProspectAgent != null ? q.ProspectAgent.CompanyName : null,
                PostingTitle = q.Posting.Title,
                Region = q.Posting.Region,
                ServiceType = q.Posting.ServiceType,
                EstimatedVolume = q.Posting.EstimatedVolume,
                StartDate = q.Posting.StartDate,
                EndDate = q.Posting.EndDate,
                IsOngoing = q.Posting.IsOngoing,
                Description = q.Posting.Description,
                PostingStatus = q.Posting.Status,
            })
            .FirstOrDefaultAsync();

        if (row is null)
            return FailInvite(messageId, "Invitation not found.");

        // Public flow only — refuse if the quote was bound to a known NP
        // agent (those use the authenticated NP-portal route).
        if (row.ProspectAgentId is null)
            return FailInvite(messageId, "This invitation is not available via the public link.");

        // Terminal-state quotes are read-only here. Don't echo the previous
        // response either — the prospect is past the point of revising.
        if (row.Status != "Requested" && row.Status != "Submitted")
            return FailInvite(messageId, $"This invitation is no longer accepting responses (status: {row.Status}).");

        // Likewise if the posting itself has been Awarded/Closed, the
        // prospect's window has shut even if their quote row is still
        // Requested (the next read on the tenant side would auto-sweep it).
        if (string.Equals(row.PostingStatus, "Awarded", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(row.PostingStatus, "Closed", StringComparison.OrdinalIgnoreCase))
            return FailInvite(messageId, "The posting for this invitation has closed.");

        return new PublicQuoteInviteResponse(messageId)
        {
            Success = true,
            Invite = new PublicQuoteInviteDto
            {
                QuoteId = row.Id,
                Status = row.Status,
                PostingTitle = row.PostingTitle ?? string.Empty,
                Region = row.Region ?? string.Empty,
                ServiceType = row.ServiceType ?? string.Empty,
                VolumePerWeek = ParseLeadingInt(row.EstimatedVolume),
                StartDate = row.StartDate?.ToString("yyyy-MM-dd") ?? string.Empty,
                EndDate = row.EndDate?.ToString("yyyy-MM-dd") ?? string.Empty,
                IsOngoing = row.IsOngoing,
                Description = row.Description ?? string.Empty,
                TenantMessage = row.TenantMessage ?? string.Empty,
                ProspectName = row.ProspectName ?? string.Empty,
                ProposedRate = row.ProposedRate,
                RateType = row.RateType,
                AvailableFleetSize = row.AvailableFleetSize,
                AvailableStartDate = row.AvailableStartDate?.ToString("yyyy-MM-dd") ?? string.Empty,
                ResponseMessage = row.Status == "Submitted" ? row.Message ?? string.Empty : string.Empty,
            },
        };
    }

    public async Task<TenantQuotesResponse> SubmitByToken(string token, PublicQuoteSubmitDto dto, Guid messageId)
    {
        var decoded = tokenService.TryRead(token);
        if (decoded is null)
            return FailQuotes(messageId, "This invitation link is invalid or has expired.");

        var (tenantId, quoteId) = decoded.Value;
        ApplyTenantOverride(tenantId);

        var quote = await Context.QuotesQuotes.AsNoTracking()
            .Where(q => q.Id == quoteId)
            .Select(q => new { q.Id, q.ProspectAgentId })
            .FirstOrDefaultAsync();

        if (quote is null)
            return FailQuotes(messageId, "Invitation not found.");

        if (quote.ProspectAgentId is null)
            return FailQuotes(messageId, "This invitation is not available via the public link.");

        // Delegate state machine + projection to the existing tenant service.
        // The Items override propagates so TenantQuotesService.Context also
        // resolves to the correct tenant DB.
        var tenantDto = new TenantQuoteSubmitDto
        {
            ProposedRate = dto.ProposedRate,
            RateType = dto.RateType,
            Message = dto.Message,
            AvailableFleetSize = dto.AvailableFleetSize,
            AvailableStartDate = dto.AvailableStartDate,
        };

        return await tenantQuotesService.SubmitQuote(quoteId, tenantDto, messageId);
    }

    private static PublicQuoteInviteResponse FailInvite(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
    };

    private static TenantQuotesResponse FailQuotes(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
    };

    private static int ParseLeadingInt(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return 0;
        var span = raw.AsSpan();
        var i = 0;
        while (i < span.Length && char.IsDigit(span[i])) i++;
        return i == 0 ? 0 : int.Parse(span[..i], System.Globalization.CultureInfo.InvariantCulture);
    }
}
