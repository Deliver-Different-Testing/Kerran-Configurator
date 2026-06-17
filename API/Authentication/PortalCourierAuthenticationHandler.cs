using System.Globalization;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Portal;
using DfrntDriveConfigurator.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DfrntDriveConfigurator.API.Authentication;

// Courier Portal magic-link (Item 8.5) — dual-auth scheme for /api/v1/courier/*.
//
// The courier self-service surface is normally gated by the Hub shared cookie
// ("Identity.Application"). This scheme lets the SAME endpoints also accept a
// passwordless courier SESSION token (issued by /api/portal/courier/auth/validate
// after a /drive/<token> magic-link redemption), carried as X-Portal-Token.
//
// On a valid token it manufactures a courier principal (IsCourier=True +
// CurrentTenantID + the courier id) so the existing "CourierOnly" policy passes
// unchanged, and stamps the per-request HttpContext.Items overrides that
// DynamicDespatchDbContextFactory (tenant) and CourierScopeResolver (courier id)
// read — so neither has to care which scheme authenticated the request.
public class PortalCourierAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "PortalCourier";

    // HttpContext.Items key carrying the resolved courier id (int) for
    // CourierScopeResolver to short-circuit its cookie email→id lookup.
    public const string CourierIdItemsKey = "PortalCourierId";

    private const string TokenHeader = "X-Portal-Token";

    private readonly PortalCourierSessionTokenService _tokenService;

    public PortalCourierAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        PortalCourierSessionTokenService tokenService)
        : base(options, logger, encoder)
    {
        _tokenService = tokenService;
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var token = Request.Headers[TokenHeader].ToString();
        if (string.IsNullOrWhiteSpace(token))
            // No portal token — defer to the cookie scheme (Hub-SSO couriers).
            return Task.FromResult(AuthenticateResult.NoResult());

        var decoded = _tokenService.TryRead(token);
        if (decoded is null)
            // A token was presented but is tampered/expired — fail this scheme so
            // the SPA gets a 401 and re-opens the magic link.
            return Task.FromResult(AuthenticateResult.Fail("Invalid or expired courier session token."));

        var (tenantId, courierId) = decoded.Value;

        // Overrides read downstream regardless of which principal lands on
        // HttpContext.User (the factory + scope resolver check Items first).
        Context.Items[DynamicDespatchDbContextFactory.OverrideTenantIdItemsKey] = tenantId;
        Context.Items[CourierIdItemsKey] = courierId;

        var claims = new[]
        {
            new Claim("IsCourier", "True"),
            new Claim("CurrentTenantID", tenantId),
            new Claim(ClaimTypes.Name, $"courier:{courierId.ToString(CultureInfo.InvariantCulture)}"),
        };
        var identity = new ClaimsIdentity(claims, SchemeName);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
