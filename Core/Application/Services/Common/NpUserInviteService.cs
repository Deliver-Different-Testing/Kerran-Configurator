using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Infrastructure;
using Microsoft.AspNetCore.Http;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Common;

// Phase 5+28a §B.1 — server-to-server caller for Hub's
// POST /api/admin/users endpoint. Used by the NP creation cascade
// (TenantAgentService §A) and, in a later slice, the NP Users page's
// Add User flow (§B.2).
//
// Partial-failure UX per the brief corrections (#2): Hub returns 201 with
// `inviteEmailSent: false` when the Master.User was created but the
// tenant-DB SMTP-via-proc step couldn't fire — the caller should still
// surface "user provisioned but invite email failed" rather than rolling
// back. The tenant-side tucClientContact is created by §A regardless.

public record NpInviteResult(
    bool MasterUserCreated,
    bool InviteEmailSent,
    int? HubUserId,
    string? FailureMessage)
{
    /// <summary>Both halves succeeded — Hub user exists AND invite email dispatched.</summary>
    public bool FullySucceeded => MasterUserCreated && InviteEmailSent;

    /// <summary>Partial — Hub user created, invite email did not send. Operator can retry.</summary>
    public bool PartialSuccess => MasterUserCreated && !InviteEmailSent;
}

public interface INpUserInviteService
{
    // isNetworkPartner selects the Hub provisioning endpoint:
    //   true  -> POST /api/admin/users         (Master.User IsNetworkPartner=true)
    //   false -> POST /api/admin/users/tenant  (tenant/DF-admin user, IsNetworkPartner=false)
    // Defaults to true so the original NP cascade callers are unchanged.
    Task<NpInviteResult> InviteAsync(
        string email, bool isNetworkPartner = true, CancellationToken cancellationToken = default);

    // Item 7b — staff password management against Hub's
    // POST /api/admin/users/set-password and /send-reset. Used by the
    // configurator's Team & Users → Access tab. Both identify the staff
    // (non-courier) Master.User by email.
    Task<HubPasswordResult> SetStaffPasswordAsync(
        string email, string password, CancellationToken cancellationToken = default);

    Task<HubPasswordResult> SendStaffResetAsync(
        string email, CancellationToken cancellationToken = default);
}

// Outcome of a staff set-password / send-reset call. Success=false carries an
// operator-facing FailureMessage; for send-reset, EmailSent reflects whether the
// reset email actually dispatched (a key can be stored even if the email fails).
public record HubPasswordResult(bool Success, bool EmailSent, string? FailureMessage)
{
    public static HubPasswordResult Ok(bool emailSent = false) => new(true, emailSent, null);
    public static HubPasswordResult Fail(string message) => new(false, false, message);
}

public class NpUserInviteService(
    IHttpClientFactory httpClientFactory,
    IHttpContextAccessor httpContextAccessor,
    AppSettings appSettings) : INpUserInviteService
{
    public async Task<NpInviteResult> InviteAsync(
        string email, bool isNetworkPartner = true, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
            return new NpInviteResult(false, false, null, "Email is required.");

        // Graceful no-op when Hub is not configured (dev / local without
        // a Hub instance, or before infra wires the env vars). Allows
        // the §A cascade to proceed and surfaces a clear message.
        if (string.IsNullOrEmpty(appSettings.HubBaseUrl) || string.IsNullOrEmpty(appSettings.HubAdminApiKey))
        {
            return new NpInviteResult(false, false, null,
                "Hub invite cascade not configured (HubBaseUrl / HubAdminApiKey env vars unset). User provisioning skipped — provision in Hub manually.");
        }

        // CurrentTenantID claim is required — populated by Hub at login
        // and read by every per-tenant service in this app. If it's
        // missing the caller is in an unauthenticated context that
        // shouldn't be hitting this code path.
        var tenantIdClaim = httpContextAccessor.HttpContext?.User
            .FindFirst("CurrentTenantID")?.Value;
        if (!int.TryParse(tenantIdClaim, out var currentTenantId) || currentTenantId <= 0)
        {
            return new NpInviteResult(false, false, null,
                "CurrentTenantID claim missing — Hub invite cascade cannot resolve the tenant for the new user.");
        }

        var route = isNetworkPartner ? "/api/admin/users" : "/api/admin/users/tenant";
        var url = $"{appSettings.HubBaseUrl}{route}";
        var client = httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(30);

        var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(new HubCreateNpUserRequest(email.Trim(), currentTenantId)),
        };
        request.Headers.Add("X-Api-Key", appSettings.HubAdminApiKey);

        try
        {
            using var response = await client.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                Log.Warning("Hub invite cascade returned {Status} for {Email}: {Body}",
                    (int)response.StatusCode, email, body);

                var friendly = (int)response.StatusCode switch
                {
                    409 => $"A Hub user with email \"{email}\" already exists. Edit the agent's contact email or have an admin clear the existing Hub identity.",
                    401 => "Hub rejected the invite request (HubAdminApiKey mismatch). Check configuration.",
                    400 => $"Hub rejected the invite request (bad payload): {body}",
                    _   => $"Hub invite cascade failed ({(int)response.StatusCode}). User provisioning skipped — provision in Hub manually."
                };
                return new NpInviteResult(false, false, null, friendly);
            }

            var payload = await response.Content.ReadFromJsonAsync<HubCreateNpUserResponse>(cancellationToken: cancellationToken);
            if (payload is null)
            {
                return new NpInviteResult(true, false, null,
                    "Hub returned a success status but an unreadable body — Hub user is probably created; check Hub directly.");
            }

            Log.Information("Hub invite cascade for {Email}: userId={UserId}, emailSent={EmailSent}",
                email, payload.UserId, payload.InviteEmailSent);
            return new NpInviteResult(
                MasterUserCreated: true,
                InviteEmailSent: payload.InviteEmailSent,
                HubUserId: payload.UserId,
                FailureMessage: payload.InviteEmailSent ? null
                    : "Hub user was provisioned but the invite email did not send. Operator should re-issue the invite once the email-send issue is resolved.");
        }
        catch (TaskCanceledException tcEx)
        {
            Log.Error(tcEx, "Hub invite cascade timed out for {Email}", email);
            return new NpInviteResult(false, false, null,
                "Hub invite cascade timed out. The Hub identity may or may not have been created — check Hub before retrying.");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Hub invite cascade unexpected failure for {Email}", email);
            return new NpInviteResult(false, false, null,
                $"Hub invite cascade failed: {ex.Message}. User provisioning skipped — provision in Hub manually.");
        }
    }

    public async Task<HubPasswordResult> SetStaffPasswordAsync(
        string email, string password, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email)) return HubPasswordResult.Fail("Email is required.");
        if (string.IsNullOrWhiteSpace(password)) return HubPasswordResult.Fail("Password is required.");
        if (password.Trim().Length < 8) return HubPasswordResult.Fail("Password must be at least 8 characters.");

        var notConfigured = HubNotConfigured();
        if (notConfigured is not null) return notConfigured;

        return await PostPasswordAsync(
            "/api/admin/users/set-password",
            new HubSetPasswordRequest(email.Trim(), password.Trim()),
            email, expectEmailSent: false, cancellationToken);
    }

    public async Task<HubPasswordResult> SendStaffResetAsync(
        string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email)) return HubPasswordResult.Fail("Email is required.");

        var notConfigured = HubNotConfigured();
        if (notConfigured is not null) return notConfigured;

        return await PostPasswordAsync(
            "/api/admin/users/send-reset",
            new HubSendResetRequest(email.Trim()),
            email, expectEmailSent: true, cancellationToken);
    }

    // Graceful guard so dev/local (no Hub) gives a clear message rather than a
    // confusing connection error — mirrors InviteAsync's configuration check.
    private HubPasswordResult? HubNotConfigured()
    {
        if (string.IsNullOrEmpty(appSettings.HubBaseUrl) || string.IsNullOrEmpty(appSettings.HubAdminApiKey))
            return HubPasswordResult.Fail(
                "Hub is not configured (HubBaseUrl / HubAdminApiKey env vars unset). Staff password management is unavailable in this environment.");
        return null;
    }

    private async Task<HubPasswordResult> PostPasswordAsync(
        string route, object body, string email, bool expectEmailSent, CancellationToken cancellationToken)
    {
        var url = $"{appSettings.HubBaseUrl}{route}";
        var client = httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(30);

        var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = JsonContent.Create(body) };
        request.Headers.Add("X-Api-Key", appSettings.HubAdminApiKey);

        try
        {
            using var response = await client.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var errBody = await response.Content.ReadAsStringAsync(cancellationToken);
                Log.Warning("Hub {Route} returned {Status} for {Email}: {Body}", route, (int)response.StatusCode, email, errBody);
                var friendly = (int)response.StatusCode switch
                {
                    404 => $"No Hub login exists for \"{email}\". Provision the user (re-send their invite) before setting a password.",
                    401 => "Hub rejected the request (HubAdminApiKey mismatch). Check configuration.",
                    400 => $"Hub rejected the request: {errBody}",
                    _ => $"Hub password request failed ({(int)response.StatusCode}). Try again or action it in Hub admin.",
                };
                return HubPasswordResult.Fail(friendly);
            }

            if (!expectEmailSent)
            {
                Log.Information("Hub {Route} succeeded for {Email}", route, email);
                return HubPasswordResult.Ok();
            }

            var payload = await response.Content.ReadFromJsonAsync<HubSendResetResponse>(cancellationToken: cancellationToken);
            var emailSent = payload?.ResetEmailSent ?? false;
            Log.Information("Hub {Route} succeeded for {Email}; resetEmailSent={EmailSent}", route, email, emailSent);
            return emailSent
                ? HubPasswordResult.Ok(emailSent: true)
                : new HubPasswordResult(true, false,
                    "Reset link generated, but the email did not send. Hand the user the reset link from Hub, or retry.");
        }
        catch (TaskCanceledException tcEx)
        {
            Log.Error(tcEx, "Hub {Route} timed out for {Email}", route, email);
            return HubPasswordResult.Fail("The request to Hub timed out. Check Hub before retrying.");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Hub {Route} unexpected failure for {Email}", route, email);
            return HubPasswordResult.Fail($"Hub password request failed: {ex.Message}");
        }
    }

    // Wire-shape records — kept private and mapped to NpInviteResult so
    // the public surface is independent of Hub's exact JSON.
    private sealed record HubSetPasswordRequest(
        [property: JsonPropertyName("email")] string Email,
        [property: JsonPropertyName("password")] string Password);

    private sealed record HubSendResetRequest(
        [property: JsonPropertyName("email")] string Email);

    private sealed record HubSendResetResponse(
        [property: JsonPropertyName("userId")] int UserId,
        [property: JsonPropertyName("email")] string Email,
        [property: JsonPropertyName("resetEmailSent")] bool ResetEmailSent);

    private sealed record HubCreateNpUserRequest(
        [property: JsonPropertyName("email")] string Email,
        [property: JsonPropertyName("currentTenantId")] int CurrentTenantId);

    private sealed record HubCreateNpUserResponse(
        [property: JsonPropertyName("userId")] int UserId,
        [property: JsonPropertyName("email")] string Email,
        [property: JsonPropertyName("inviteEmailSent")] bool InviteEmailSent);
}
