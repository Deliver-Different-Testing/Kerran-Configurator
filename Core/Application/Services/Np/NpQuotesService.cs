using System;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Application.Services.Tenant;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Carrier-side concerns. An NP-portal user sees pending invites attributed
// to their own tucAgent (scope.NpAgentId) and can submit a response that
// transitions the quote Requested → Submitted.
//
// State-machine ownership lives in TenantQuotesService.SubmitQuote — this
// service applies the scope guard then delegates, so the lifecycle rules
// stay in one place.
public class NpQuotesService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    INpScopeResolver scopeResolver,
    TenantQuotesService tenantQuotesService) : BaseService(contextFactory)
{
    public async Task<NpPendingInvitesResponse> GetPendingInvites(Guid messageId)
    {
        var scope = await scopeResolver.ResolveAsync();

        // Non-admin NP user with no agent linkage configured → defensive empty.
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return new NpPendingInvitesResponse(messageId) { Success = true, Invites = [] };
        }

        var query = Context.QuotesQuotes
            .AsNoTracking()
            .Where(q => q.Status == "Requested");

        // Admins see all Requested invites across the tenant — useful for
        // ops/diagnostic. NP users see only their own.
        if (!scope.IsAdmin)
        {
            query = query.Where(q => q.AgentId == scope.NpAgentId!.Value);
        }

        var rows = await query
            .OrderByDescending(q => q.CreatedDate)
            .Select(q => new
            {
                q.Id,
                q.PostingId,
                q.Message,
                q.CreatedDate,
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
            .ToListAsync();

        // Hide invites attached to postings that have since been closed —
        // the auto-sweep at /quotes/postings/{id}/quotes will eventually
        // mark these Expired, but until then we want them out of the carrier
        // inbox so they don't waste time on dead postings.
        var invites = rows
            .Where(r => r.PostingStatus != "Awarded" && r.PostingStatus != "Closed")
            .Select(r => new NpPendingInviteDto
            {
                QuoteId = r.Id,
                PostingId = r.PostingId,
                PostingTitle = r.PostingTitle ?? string.Empty,
                Region = r.Region ?? string.Empty,
                ServiceType = r.ServiceType ?? string.Empty,
                VolumePerWeek = ParseVolume(r.EstimatedVolume),
                StartDate = r.StartDate?.ToString("yyyy-MM-dd") ?? string.Empty,
                EndDate = r.EndDate?.ToString("yyyy-MM-dd") ?? string.Empty,
                IsOngoing = r.IsOngoing,
                Description = r.Description ?? string.Empty,
                TenantMessage = r.Message ?? string.Empty,
                RequestedDate = FormatUtc(r.CreatedDate),
            })
            .ToList();

        return new NpPendingInvitesResponse(messageId)
        {
            Success = true,
            Invites = invites,
        };
    }

    public async Task<TenantQuotesResponse> SubmitInvite(int quoteId, NpQuoteSubmitDto dto, Guid messageId)
    {
        var scope = await scopeResolver.ResolveAsync();

        // Non-admin NP users may only submit on quotes attributed to their
        // own NpAgentId. Admins bypass the check (diagnostic/ops use).
        if (!scope.IsAdmin)
        {
            if (scope.NpAgentId is null)
            {
                return Fail(messageId, "No NP scope configured for this user.");
            }

            var ownsQuote = await Context.QuotesQuotes
                .AnyAsync(q => q.Id == quoteId && q.AgentId == scope.NpAgentId!.Value);

            if (!ownsQuote)
            {
                return Fail(messageId, "Quote not found or outside your scope.");
            }
        }

        // State-machine + projection lives on the tenant service — delegate.
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

    private static TenantQuotesResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
    };

    private static string FormatUtc(DateTime value) =>
        DateTime.SpecifyKind(value, DateTimeKind.Utc).ToString("o");

    // Mirror of TenantQuotesService.ParseVolume — EstimatedVolume is free-text.
    private static int ParseVolume(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return 0;
        var span = raw.AsSpan();
        var i = 0;
        while (i < span.Length && char.IsDigit(span[i])) i++;
        return i == 0 ? 0 : int.Parse(span[..i], System.Globalization.CultureInfo.InvariantCulture);
    }
}
