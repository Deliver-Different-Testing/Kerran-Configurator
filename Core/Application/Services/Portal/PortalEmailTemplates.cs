using System.Net;

namespace DfrntDriveConfigurator.Core.Application.Services.Portal;

// Courier Portal Phase 1 — applicant verification email.
// Pure static builder (mirrors Tenant/QuoteInviteEmailTemplates). The body is
// queued into the tucManualMessage outbox; a downstream worker (AutomationEngine
// EmailService) sends it.
public static class PortalEmailTemplates
{
    public static string Subject(string brand) => $"Verify your {brand} application";

    public static string BuildVerificationHtml(string brand, string firstName, string code, string verifyLink)
    {
        var safeName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(firstName) ? "there" : firstName);
        var safeBrand = WebUtility.HtmlEncode(brand);
        var safeCode = WebUtility.HtmlEncode(code);
        var safeLink = WebUtility.HtmlEncode(verifyLink);

        return $@"<!DOCTYPE html>
<html>
<body style=""margin:0;padding:0;background:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;"">
  <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#f4f5f7;padding:24px 0;"">
    <tr><td align=""center"">
      <table role=""presentation"" width=""480"" cellpadding=""0"" cellspacing=""0"" style=""background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;"">
        <tr><td style=""background:#0f172a;color:#ffffff;padding:20px 28px;font-size:18px;font-weight:600;"">{safeBrand}</td></tr>
        <tr><td style=""padding:28px;"">
          <p style=""margin:0 0 14px;font-size:15px;"">Hi {safeName},</p>
          <p style=""margin:0 0 14px;font-size:15px;line-height:1.5;"">Thanks for starting your courier application. Use the code below to verify your email and continue:</p>
          <div style=""margin:18px 0;text-align:center;"">
            <span style=""display:inline-block;font-size:30px;letter-spacing:8px;font-weight:700;color:#0f172a;background:#f1f5f9;border-radius:8px;padding:12px 20px;"">{safeCode}</span>
          </div>
          <p style=""margin:0 0 18px;font-size:14px;line-height:1.5;"">Or click the button to verify and pick up where you left off:</p>
          <div style=""text-align:center;margin-bottom:8px;"">
            <a href=""{safeLink}"" style=""display:inline-block;background:#06b6d4;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 26px;border-radius:8px;"">Verify &amp; continue</a>
          </div>
          <p style=""margin:18px 0 0;font-size:12px;color:#6b7280;line-height:1.5;"">This code expires shortly. If you didn't start an application, you can ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>";
    }
}
