using System;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Tenant;

// Phase 5+13 / slice 3 — Quote-invite notification trigger.
//
// When TenantQuotesService.CreateQuoteRequest inserts a Requested invite row,
// this service queues an email via the existing tucManualMessage outbox table
// (the same queue AutomationEngine's SendEmail action writes to — some
// downstream worker picks up UcmmSent=0 rows and dispatches).
//
// Failure mode: never throws. A failed notification is logged but does NOT
// block the invite — the invite is source of truth, notification is
// best-effort delivery.
public class QuoteNotificationService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    private const string FeatureFlagCategory = "NP";
    private const string FeatureFlagKey = "QuoteInviteEmailEnabled";

    public async Task TryNotifyCarrierAsync(int quoteId, CancellationToken ct = default)
    {
        try
        {
            if (!await IsFeatureEnabledAsync(ct))
            {
                Log.Information("Quote-invite emails disabled by AppConfig — skipping for quoteId={QuoteId}", quoteId);
                return;
            }

            var info = await LoadQuoteInviteInfoAsync(quoteId, ct);
            if (info is null)
            {
                Log.Warning("Quote-invite notification: quote+posting not found for quoteId={QuoteId}", quoteId);
                return;
            }

            var recipient = await ResolveRecipientAsync(info, ct);
            if (string.IsNullOrWhiteSpace(recipient))
            {
                Log.Warning("Quote-invite: no recipient resolved for quoteId={QuoteId} agentId={AgentId} prospectAgentId={ProspectAgentId}",
                    quoteId, info.AgentId, info.ProspectAgentId);
                return;
            }

            var template = QuoteInviteEmailTemplates.Build(BuildTemplateData(info));
            await QueueOutboxRowAsync(recipient, template.Subject, template.HtmlBody, ct);

            Log.Information("Quote-invite queued: quoteId={QuoteId} recipient={Recipient} subject='{Subject}'",
                quoteId, recipient, template.Subject);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Quote-invite notification failed for quoteId={QuoteId} — invite was created successfully but no email queued", quoteId);
        }
    }

    private async Task<bool> IsFeatureEnabledAsync(CancellationToken ct)
    {
        var raw = await Context.AppConfigs.AsNoTracking()
            .Where(c => c.Category == FeatureFlagCategory && c.ConfigKey == FeatureFlagKey)
            .Select(c => c.ConfigValue)
            .FirstOrDefaultAsync(ct);

        // Absent → default enabled. Avoids forcing a migration to ship this slice.
        return raw is null || string.Equals(raw, "true", StringComparison.OrdinalIgnoreCase);
    }

    private record QuoteInviteInfo(
        int QuoteId,
        int? AgentId,
        int? ProspectAgentId,
        bool AgentPortalEnabled,
        string TenantMessage,
        string PostingTitle,
        string Region,
        string ServiceType,
        string EstimatedVolume,
        DateOnly? StartDate,
        DateOnly? EndDate,
        bool IsOngoing,
        string Description);

    private async Task<QuoteInviteInfo?> LoadQuoteInviteInfoAsync(int quoteId, CancellationToken ct)
    {
        return await Context.QuotesQuotes.AsNoTracking()
            .Where(q => q.Id == quoteId)
            .Select(q => new QuoteInviteInfo(
                q.Id,
                q.AgentId,
                q.ProspectAgentId,
                // Portal link only valid when invite is to a known tucAgent with portal access enabled.
                q.AgentId != null && Context.TucAgents.Any(a => a.UcagId == q.AgentId && a.NpPortalEnabled),
                q.Message ?? string.Empty,
                q.Posting.Title ?? string.Empty,
                q.Posting.Region ?? string.Empty,
                q.Posting.ServiceType ?? string.Empty,
                q.Posting.EstimatedVolume ?? string.Empty,
                q.Posting.StartDate,
                q.Posting.EndDate,
                q.Posting.IsOngoing,
                q.Posting.Description ?? string.Empty))
            .FirstOrDefaultAsync(ct);
    }

    // Priority chain:
    //   1. NpFeatureConfig.NotificationEmail (explicit per-NP override)
    //      — also short-circuits to "skip" if NotifyOnNewJob=false on that row
    //   2. ProspectAgent.Email (for invites to a prospect)
    //   3. tucClientContact with NpAdmin role joined via tucClient.NpAgentId
    //   4. Any active tucClientContact for the agent's tucClient with an email
    //   5. null → caller logs and skips
    private async Task<string?> ResolveRecipientAsync(QuoteInviteInfo info, CancellationToken ct)
    {
        // 1. Per-NP override (and opt-out check)
        if (info.AgentId is int agentId)
        {
            var npConfig = await Context.NpFeatureConfigs.AsNoTracking()
                .Where(c => c.AgentId == agentId)
                .Select(c => new { c.NotifyOnNewJob, c.NotificationEmail })
                .FirstOrDefaultAsync(ct);

            if (npConfig is not null && !npConfig.NotifyOnNewJob)
            {
                Log.Information("Quote-invite skipped: NP agentId={AgentId} has NotifyOnNewJob=false", agentId);
                return null;
            }

            if (!string.IsNullOrWhiteSpace(npConfig?.NotificationEmail))
                return npConfig!.NotificationEmail;
        }

        // 2. ProspectAgent direct email
        if (info.ProspectAgentId is int prospectId)
        {
            var prospectEmail = await Context.ProspectAgents.AsNoTracking()
                .Where(p => p.Id == prospectId)
                .Select(p => p.Email)
                .FirstOrDefaultAsync(ct);

            if (!string.IsNullOrWhiteSpace(prospectEmail))
                return prospectEmail;
        }

        // 3 + 4. Walk the tucClientContact chain (only meaningful for known agents).
        if (info.AgentId is int knownAgentId)
        {
            var npAdminRoleId = await Context.TblContactRoles.AsNoTracking()
                .Where(r => r.Name == "NpAdmin")
                .Select(r => (int?)r.ContactRoleId)
                .FirstOrDefaultAsync(ct);

            if (npAdminRoleId is int roleId)
            {
                var adminEmail = await FindActiveContactEmailAsync(knownAgentId, roleId, ct);
                if (!string.IsNullOrWhiteSpace(adminEmail))
                    return adminEmail;
            }

            var anyEmail = await FindActiveContactEmailAsync(knownAgentId, contactRoleId: null, ct);
            if (!string.IsNullOrWhiteSpace(anyEmail))
                return anyEmail;
        }

        return null;
    }

    private async Task<string?> FindActiveContactEmailAsync(int agentId, int? contactRoleId, CancellationToken ct)
    {
        var query = Context.TucClientContacts.AsNoTracking()
            .Where(cc => cc.Active
                      && cc.HasEmail
                      && cc.UcctEmail != null
                      && cc.UcctEmail != string.Empty
                      && cc.UcctClient != null
                      && cc.UcctClient.NpAgentId == agentId);

        if (contactRoleId is int role)
            query = query.Where(cc => cc.ContactRoleId == role);

        return await query
            .Select(cc => cc.UcctEmail)
            .FirstOrDefaultAsync(ct);
    }

    private QuoteInviteEmailTemplates.TemplateData BuildTemplateData(QuoteInviteInfo info)
    {
        string? portalLink = null;
        if (info.AgentPortalEnabled)
        {
            var request = httpContextAccessor.HttpContext?.Request;
            if (request is not null)
                portalLink = $"{request.Scheme}://{request.Host}/quotes";
        }

        return new QuoteInviteEmailTemplates.TemplateData
        {
            PostingTitle = info.PostingTitle,
            Region = info.Region,
            ServiceType = info.ServiceType,
            VolumePerWeek = ParseLeadingInt(info.EstimatedVolume),
            StartDate = info.StartDate?.ToString("yyyy-MM-dd") ?? string.Empty,
            EndDate = info.EndDate?.ToString("yyyy-MM-dd") ?? string.Empty,
            IsOngoing = info.IsOngoing,
            Description = info.Description,
            TenantMessage = info.TenantMessage,
            PortalLink = portalLink,
        };
    }

    // Raw INSERT matches AutomationEngine.EmailService.SendEmailAsync exactly,
    // so a downstream worker picks the row up identically. No JobId / attachment
    // on quote invites — those columns stay null.
    private async Task QueueOutboxRowAsync(string recipientEmail, string subject, string htmlBody, CancellationToken ct)
    {
        await Context.Database.ExecuteSqlRawAsync(
            @"INSERT INTO tucManualMessage
              (UcmmDate, SendToEmailAddress, Subject, UcmmMessage, ReplyToEmailAddress,
               JobId, HasAttachment, FileName, FileType, FileContent, UcmmSent)
              VALUES
              (GETUTCDATE(), @p0, @p1, @p2, NULL, NULL, 0, NULL, NULL, NULL, 0)",
            [recipientEmail, subject, htmlBody],
            ct);
    }

    // EstimatedVolume is free-text ("200 jobs/week", "80", etc.) — pull the
    // leading integer if any. Mirrors TenantQuotesService.ParseVolume.
    private static int ParseLeadingInt(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return 0;
        var span = raw.AsSpan();
        var i = 0;
        while (i < span.Length && char.IsDigit(span[i])) i++;
        return i == 0 ? 0 : int.Parse(span[..i], CultureInfo.InvariantCulture);
    }
}
