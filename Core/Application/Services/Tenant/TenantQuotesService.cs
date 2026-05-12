using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Tenant;

public class TenantQuotesService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    public async Task<TenantQuotePostingsResponse> GetPostings(Guid messageId)
    {
        var rows = await Context.QuotesPostings
            .AsNoTracking()
            .OrderByDescending(p => p.CreatedDate)
            .Select(p => new
            {
                p.Id,
                p.Title,
                p.Region,
                p.ServiceType,
                p.EstimatedVolume,
                p.StartDate,
                p.EndDate,
                p.Status,
                p.CreatedDate,
                QuoteCount = p.QuotesQuotes.Count(),
            })
            .ToListAsync();

        var postings = rows.Select(r => new TenantQuotePostingDto
        {
            Id = r.Id,
            Title = r.Title ?? string.Empty,
            Region = r.Region ?? string.Empty,
            ServiceType = r.ServiceType ?? string.Empty,
            VolumePerWeek = ParseVolume(r.EstimatedVolume),
            StartDate = r.StartDate?.ToString("yyyy-MM-dd") ?? string.Empty,
            EndDate = r.EndDate?.ToString("yyyy-MM-dd") ?? string.Empty,
            Status = r.Status ?? "Open",
            QuoteCount = r.QuoteCount,
            CreatedDate = r.CreatedDate.ToString("yyyy-MM-dd"),
        }).ToList();

        return new TenantQuotePostingsResponse(messageId)
        {
            Success = true,
            Postings = postings,
        };
    }

    public async Task<TenantQuotesResponse> GetQuotesForPosting(int postingId, Guid messageId)
    {
        // Sweep stale Requested/Submitted quotes for this posting before reading
        // so the UI always sees a consistent lifecycle. Idempotent and scoped to
        // one posting — cheap.
        await ExpireStaleQuotesAsync(postingId);

        // ProspectAgent and TucAgent are the two possible quote sources — left
        // join both via the FK columns and prefer whichever populates.
        var rows = await Context.QuotesQuotes
            .AsNoTracking()
            .Where(q => q.PostingId == postingId)
            .OrderByDescending(q => q.CreatedDate)
            .Select(q => new
            {
                q.Id,
                q.PostingId,
                q.AgentId,
                q.ProspectAgentId,
                q.ProposedRate,
                q.RateType,
                q.Message,
                q.AvailableFleetSize,
                q.AvailableStartDate,
                q.CreatedDate,
                q.SubmittedDate,
                q.ReviewedDate,
                q.ExpiredDate,
                q.Status,
                ProspectName = q.ProspectAgent != null ? q.ProspectAgent.CompanyName : null,
                ProspectAssociation = q.ProspectAgent != null ? q.ProspectAgent.AssociationSource : null,
                ProspectCity = q.ProspectAgent != null ? q.ProspectAgent.City : null,
                ProspectState = q.ProspectAgent != null ? q.ProspectAgent.State : null,
            })
            .ToListAsync();

        var tucAgentIds = rows
            .Where(r => r.AgentId != null)
            .Select(r => r.AgentId!.Value)
            .Distinct()
            .ToList();

        var tucAgentNames = tucAgentIds.Count == 0
            ? new Dictionary<int, string>()
            : await Context.TucAgents
                .AsNoTracking()
                .Where(a => tucAgentIds.Contains(a.UcagId))
                .ToDictionaryAsync(a => a.UcagId, a => a.UcagName ?? string.Empty);

        var quotes = rows.Select(r => new TenantQuoteDto
        {
            Id = r.Id,
            PostingId = r.PostingId,
            AgentId = r.AgentId ?? r.ProspectAgentId ?? 0,
            AgentName = r.AgentId != null && tucAgentNames.TryGetValue(r.AgentId.Value, out var n)
                ? n
                : (r.ProspectName ?? string.Empty),
            Association = NormaliseAssociation(r.ProspectAssociation),
            PricePerJob = r.ProposedRate ?? 0m,
            RateType = r.RateType,
            AvailableFleetSize = r.AvailableFleetSize,
            LeadTime = r.AvailableStartDate?.ToString("yyyy-MM-dd") ?? string.Empty,
            CoverageAreas = string.IsNullOrWhiteSpace(r.ProspectCity)
                ? new List<string>()
                : new List<string> { $"{r.ProspectCity}, {r.ProspectState}".TrimEnd(',', ' ') },
            Notes = r.Message ?? string.Empty,
            // Lifecycle timestamps sent as ISO 8601 UTC so the frontend can
            // compute relative-time labels against the user's local-day
            // boundaries (avoids the UTC/local "yesterday near midnight" trap).
            RequestedDate = FormatUtc(r.CreatedDate),
            SubmittedDate = FormatUtc(r.SubmittedDate),
            ReviewedDate = FormatUtc(r.ReviewedDate),
            ExpiredDate = FormatUtc(r.ExpiredDate),
            Status = string.IsNullOrWhiteSpace(r.Status) ? "Requested" : r.Status,
        }).ToList();

        return new TenantQuotesResponse(messageId)
        {
            Success = true,
            Quotes = quotes,
        };
    }

    public async Task<TenantQuotePostingResponse> CreatePosting(TenantQuotePostingCreateDto dto, Guid messageId)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
        {
            return new TenantQuotePostingResponse(messageId)
            {
                Success = false,
                Messages = { new MessageDto { Message = "Title is required." } },
            };
        }

        var userIdClaim = httpContextAccessor.HttpContext?.User.FindFirst("UserID")?.Value;
        var postedByUserId = int.TryParse(userIdClaim, out var uid) ? uid : 0;
        var now = DateTime.UtcNow;

        var posting = new QuotesPosting
        {
            Title = dto.Title.Trim(),
            Region = dto.Region ?? string.Empty,
            ServiceType = dto.ServiceType ?? string.Empty,
            EstimatedVolume = dto.VolumePerWeek > 0 ? dto.VolumePerWeek.ToString(CultureInfo.InvariantCulture) : string.Empty,
            StartDate = ParseDateOnly(dto.StartDate),
            EndDate = ParseDateOnly(dto.EndDate),
            IsOngoing = string.IsNullOrWhiteSpace(dto.EndDate),
            Description = dto.Description ?? string.Empty,
            Status = "Open",
            PostedByUserId = postedByUserId,
            PublishedDate = now,
            CreatedDate = now,
            UpdatedDate = now,
        };
        Context.QuotesPostings.Add(posting);
        await Context.SaveChangesAsync();

        return new TenantQuotePostingResponse(messageId)
        {
            Success = true,
            Posting = new TenantQuotePostingDto
            {
                Id = posting.Id,
                Title = posting.Title,
                Region = posting.Region ?? string.Empty,
                ServiceType = posting.ServiceType ?? string.Empty,
                VolumePerWeek = ParseVolume(posting.EstimatedVolume),
                StartDate = posting.StartDate?.ToString("yyyy-MM-dd") ?? string.Empty,
                EndDate = posting.EndDate?.ToString("yyyy-MM-dd") ?? string.Empty,
                Status = posting.Status ?? "Open",
                QuoteCount = 0,
                CreatedDate = posting.CreatedDate.ToString("yyyy-MM-dd"),
            },
        };
    }

    public async Task<TenantQuotesResponse> CreateQuoteRequest(TenantQuoteRequestCreateDto dto, Guid messageId)
    {
        if (dto.PostingId <= 0 || (dto.AgentId is null && dto.ProspectAgentId is null))
        {
            return new TenantQuotesResponse(messageId)
            {
                Success = false,
                Messages = { new MessageDto { Message = "PostingId and either AgentId or ProspectAgentId are required." } },
            };
        }

        var postingExists = await Context.QuotesPostings.AnyAsync(p => p.Id == dto.PostingId);
        if (!postingExists)
        {
            return new TenantQuotesResponse(messageId)
            {
                Success = false,
                Messages = { new MessageDto { Message = "Posting not found." } },
            };
        }

        // Idempotency: refuse if this carrier has already been invited to this
        // posting. Migration 027 enforces the same rule at the DB level via
        // filtered unique indexes; this pre-check yields a clean error message
        // instead of an EF unique-constraint exception.
        var duplicate = await Context.QuotesQuotes.AnyAsync(q =>
            q.PostingId == dto.PostingId &&
            ((dto.AgentId != null && q.AgentId == dto.AgentId) ||
             (dto.ProspectAgentId != null && q.ProspectAgentId == dto.ProspectAgentId)));
        if (duplicate)
        {
            return new TenantQuotesResponse(messageId)
            {
                Success = false,
                Messages = { new MessageDto { Message = "This carrier has already been invited to this posting." } },
            };
        }

        var now = DateTime.UtcNow;
        var quote = new QuotesQuote
        {
            PostingId = dto.PostingId,
            AgentId = dto.AgentId,
            ProspectAgentId = dto.ProspectAgentId,
            Message = dto.Message ?? string.Empty,
            Status = "Requested",
            CreatedDate = now,
            UpdatedDate = now,
        };
        Context.QuotesQuotes.Add(quote);
        await Context.SaveChangesAsync();

        // Round-trip the full list of quotes for this posting so the modal
        // refresh on close picks up the new row.
        return await GetQuotesForPosting(dto.PostingId, messageId);
    }

    public async Task<TenantQuotesResponse> AwardQuote(int quoteId, Guid messageId)
    {
        var quote = await Context.QuotesQuotes.FirstOrDefaultAsync(q => q.Id == quoteId);
        if (quote is null)
        {
            return new TenantQuotesResponse(messageId)
            {
                Success = false,
                Messages = { new MessageDto { Message = "Quote not found." } },
            };
        }

        var posting = await Context.QuotesPostings.FirstOrDefaultAsync(p => p.Id == quote.PostingId);
        if (posting is null)
        {
            return new TenantQuotesResponse(messageId)
            {
                Success = false,
                Messages = { new MessageDto { Message = "Posting not found." } },
            };
        }

        if (string.Equals(posting.Status, "Awarded", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(posting.Status, "Closed", StringComparison.OrdinalIgnoreCase))
        {
            return new TenantQuotesResponse(messageId)
            {
                Success = false,
                Messages = { new MessageDto { Message = $"Posting is already {posting.Status}." } },
            };
        }

        var userIdClaim = httpContextAccessor.HttpContext?.User.FindFirst("UserID")?.Value;
        var reviewerId = int.TryParse(userIdClaim, out var uid) ? (int?)uid : null;
        var now = DateTime.UtcNow;

        var siblings = await Context.QuotesQuotes
            .Where(q => q.PostingId == quote.PostingId && q.Id != quote.Id)
            .ToListAsync();

        quote.Status = "Accepted";
        quote.ReviewedByUserId = reviewerId;
        quote.ReviewedDate = now;
        quote.UpdatedDate = now;

        foreach (var sibling in siblings)
        {
            sibling.Status = "Declined";
            sibling.ReviewedByUserId = reviewerId;
            sibling.ReviewedDate = now;
            sibling.UpdatedDate = now;
        }

        posting.Status = "Awarded";
        posting.ClosedDate = now;
        posting.UpdatedDate = now;

        await Context.SaveChangesAsync();

        return await GetQuotesForPosting(quote.PostingId, messageId);
    }

    public async Task<TenantQuotesResponse> SubmitQuote(int quoteId, TenantQuoteSubmitDto dto, Guid messageId)
    {
        var quote = await Context.QuotesQuotes.FirstOrDefaultAsync(q => q.Id == quoteId);
        if (quote is null)
        {
            return new TenantQuotesResponse(messageId)
            {
                Success = false,
                Messages = { new MessageDto { Message = "Quote not found." } },
            };
        }

        // Only invites awaiting (Requested) or already-Submitted quotes can be
        // (re)submitted. Once a quote is Accepted/Declined/Expired, it's frozen.
        if (!string.Equals(quote.Status, "Requested", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(quote.Status, "Submitted", StringComparison.OrdinalIgnoreCase))
        {
            return new TenantQuotesResponse(messageId)
            {
                Success = false,
                Messages = { new MessageDto { Message = $"Quote is {quote.Status} and cannot be modified." } },
            };
        }

        var posting = await Context.QuotesPostings.FirstOrDefaultAsync(p => p.Id == quote.PostingId);
        if (posting is null)
        {
            return new TenantQuotesResponse(messageId)
            {
                Success = false,
                Messages = { new MessageDto { Message = "Posting not found." } },
            };
        }

        if (string.Equals(posting.Status, "Awarded", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(posting.Status, "Closed", StringComparison.OrdinalIgnoreCase))
        {
            return new TenantQuotesResponse(messageId)
            {
                Success = false,
                Messages = { new MessageDto { Message = $"Posting is {posting.Status} and no longer accepting submissions." } },
            };
        }

        var now = DateTime.UtcNow;
        quote.ProposedRate = dto.ProposedRate;
        if (dto.RateType is not null) quote.RateType = dto.RateType;
        if (dto.Message is not null) quote.Message = dto.Message;
        quote.AvailableFleetSize = dto.AvailableFleetSize;
        quote.AvailableStartDate = ParseDateOnly(dto.AvailableStartDate);
        quote.Status = "Submitted";
        quote.SubmittedDate = now;
        quote.UpdatedDate = now;

        await Context.SaveChangesAsync();

        return await GetQuotesForPosting(quote.PostingId, messageId);
    }

    public async Task<TenantExpireSweepResponse> ExpireStaleQuotes(int? postingId, Guid messageId)
    {
        var expired = await ExpireStaleQuotesAsync(postingId);
        return new TenantExpireSweepResponse(messageId)
        {
            Success = true,
            ExpiredCount = expired,
        };
    }

    // Sweep marks Requested/Submitted quotes as Expired when the parent
    // posting is Awarded/Closed, or when its EndDate has passed. Pass a
    // postingId to scope; null sweeps the whole tenant. Idempotent — safe
    // to call on every posting view.
    private async Task<int> ExpireStaleQuotesAsync(int? postingId = null)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);

        var query = Context.QuotesQuotes
            .Join(Context.QuotesPostings, q => q.PostingId, p => p.Id, (q, p) => new { q, p })
            .Where(x => (x.q.Status == "Requested" || x.q.Status == "Submitted") &&
                        (x.p.Status == "Awarded" || x.p.Status == "Closed" ||
                         (x.p.EndDate.HasValue && x.p.EndDate < today)));

        if (postingId is not null)
            query = query.Where(x => x.q.PostingId == postingId);

        var stale = await query.Select(x => x.q).ToListAsync();
        if (stale.Count == 0) return 0;

        var now = DateTime.UtcNow;
        foreach (var q in stale)
        {
            q.Status = "Expired";
            q.ExpiredDate = now;
            q.UpdatedDate = now;
        }

        await Context.SaveChangesAsync();
        return stale.Count;
    }

    // Round-trippable ISO 8601 with explicit UTC marker — values are stored
    // via DateTime.UtcNow but EF reads them back as DateTimeKind.Unspecified,
    // so we re-stamp Kind=Utc before formatting to guarantee a "Z" suffix.
    private static string FormatUtc(DateTime value) =>
        DateTime.SpecifyKind(value, DateTimeKind.Utc).ToString("o");

    private static string FormatUtc(DateTime? value) =>
        value.HasValue ? FormatUtc(value.Value) : string.Empty;

    private static DateOnly? ParseDateOnly(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        return DateOnly.TryParse(raw, out var d) ? d : null;
    }

    // EstimatedVolume is a free-text column ("200 jobs/week", "80", etc.) —
    // pick out the leading integer if present, fall back to 0.
    private static int ParseVolume(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return 0;
        var span = raw.AsSpan();
        var i = 0;
        while (i < span.Length && char.IsDigit(span[i])) i++;
        return i == 0 ? 0 : int.Parse(span[..i], CultureInfo.InvariantCulture);
    }

    private static string NormaliseAssociation(string? src)
    {
        if (string.IsNullOrWhiteSpace(src)) return "None";
        var s = src.Trim();
        if (s.Equals("ECA", StringComparison.OrdinalIgnoreCase)) return "ECA";
        if (s.Equals("CLDA", StringComparison.OrdinalIgnoreCase)) return "CLDA";
        return "None";
    }
}
