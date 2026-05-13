using System.Net;

namespace DfrntDriveConfigurator.Core.Application.Services.Tenant;

// Pure static template builder for quote-invite notification emails.
// Hardcoded HTML for now — no templating service exists yet, and we don't
// want per-tenant branding before the Quotes vertical is even shipped.
// Inline CSS only (most email clients strip <style> blocks); no images.
public static class QuoteInviteEmailTemplates
{
    public record EmailContent(string Subject, string HtmlBody);

    public class TemplateData
    {
        public string PostingTitle { get; init; } = string.Empty;
        public string Region { get; init; } = string.Empty;
        public string ServiceType { get; init; } = string.Empty;
        public int VolumePerWeek { get; init; }
        public string StartDate { get; init; } = string.Empty;     // YYYY-MM-DD or empty
        public string EndDate { get; init; } = string.Empty;
        public bool IsOngoing { get; init; }
        public string Description { get; init; } = string.Empty;
        public string TenantMessage { get; init; } = string.Empty;
        public string? PortalLink { get; init; }                   // null for prospect-agent recipients
    }

    public static EmailContent Build(TemplateData d)
    {
        var titleSafe = WebUtility.HtmlEncode(d.PostingTitle);
        var regionSafe = WebUtility.HtmlEncode(d.Region);
        var subject = $"New Quote Request: {d.PostingTitle}"
            + (string.IsNullOrWhiteSpace(d.Region) ? string.Empty : $" — {d.Region}");

        var serviceSafe = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(d.ServiceType) ? "Service TBD" : d.ServiceType);
        var volumeLine = d.VolumePerWeek > 0 ? $"{d.VolumePerWeek} jobs/week" : "Volume TBD";
        var dateLine = d.IsOngoing
            ? "Ongoing"
            : (!string.IsNullOrWhiteSpace(d.StartDate) || !string.IsNullOrWhiteSpace(d.EndDate))
                ? $"{(string.IsNullOrWhiteSpace(d.StartDate) ? "?" : d.StartDate)} → {(string.IsNullOrWhiteSpace(d.EndDate) ? "?" : d.EndDate)}"
                : "Dates TBD";

        var descriptionBlock = string.IsNullOrWhiteSpace(d.Description)
            ? string.Empty
            : $"""<p style="margin:16px 0;color:#475569;line-height:1.5;">{WebUtility.HtmlEncode(d.Description).Replace("\n", "<br>")}</p>""";

        var tenantMessageBlock = string.IsNullOrWhiteSpace(d.TenantMessage)
            ? string.Empty
            : $"""
              <div style="margin:20px 0;padding:12px 16px;border-left:3px solid #43C7F4;background:#f6f8fa;border-radius:4px;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;margin-bottom:4px;">Message from the tenant</div>
                <div style="font-style:italic;color:#374151;">{WebUtility.HtmlEncode(d.TenantMessage)}</div>
              </div>
              """;

        var ctaBlock = string.IsNullOrWhiteSpace(d.PortalLink)
            ? """
              <p style="margin:24px 0 8px;color:#374151;">The tenant will be in touch with next steps. If you're already registered on the portal, log in to respond directly.</p>
              """
            : $"""
              <p style="margin:24px 0;text-align:center;">
                <a href="{WebUtility.HtmlEncode(d.PortalLink)}"
                   style="display:inline-block;padding:12px 28px;background:#43C7F4;color:#14152D;font-weight:700;text-decoration:none;border-radius:9999px;font-size:14px;">
                  Respond to this Quote Request
                </a>
              </p>
              <p style="margin:8px 0 0;text-align:center;font-size:12px;color:#6b7280;">
                or paste this link into your browser:<br>
                <span style="word-break:break-all;color:#43C7F4;">{WebUtility.HtmlEncode(d.PortalLink)}</span>
              </p>
              """;

        var html = $"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="margin:0;padding:0;background:#fafbfc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0d0c2c;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fafbfc;padding:24px 0;">
                <tr><td align="center">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #e4e8ed;border-radius:8px;overflow:hidden;">
                    <tr><td style="background:#14152D;padding:20px 28px;">
                      <div style="color:#43C7F4;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;font-weight:700;">DFRNT Drive — Quotes Marketplace</div>
                    </td></tr>
                    <tr><td style="padding:28px;">
                      <h1 style="margin:0 0 4px;font-size:22px;color:#0d0c2c;">New Quote Request</h1>
                      <div style="font-size:18px;font-weight:700;color:#0d0c2c;margin:12px 0 4px;">{titleSafe}</div>
                      <div style="font-size:14px;color:#6b7280;">{regionSafe} · {serviceSafe} · {WebUtility.HtmlEncode(volumeLine)} · {WebUtility.HtmlEncode(dateLine)}</div>
                      {descriptionBlock}
                      {tenantMessageBlock}
                      {ctaBlock}
                    </td></tr>
                    <tr><td style="background:#f6f8fa;padding:16px 28px;border-top:1px solid #e4e8ed;font-size:12px;color:#6b7280;">
                      This invitation was sent automatically when a tenant requested a quote from your business on DFRNT Drive.
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;

        return new EmailContent(subject, html);
    }
}
