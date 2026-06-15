using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Courier;

// Phase 2 — resolves the currently logged-in courier's TucCourier record from
// the Hub shared-cookie claims. Couriers authenticate via the Hub SSO cookie
// (IsCourier), and the tenant DB is resolved the normal claim-driven way by
// DynamicDespatchDbContextFactory (CurrentTenantID claim) — no portal override.
//
// Linkage is by EMAIL: there is no StaffId column on TucCourier, so we match
// the cookie's name/email claim against TucCourier.UccrEmail (the same linkage
// NpFleetService uses for courier mobile-login lookups). Result is cached
// per-request on HttpContext.Items (mirrors NpScopeResolver).
public sealed record CourierScope(int CourierId, int? MasterCourierId, int CourierTypeId, string Email);

public interface ICourierScopeResolver
{
    Task<CourierScope?> ResolveAsync(CancellationToken ct = default);
}

public class CourierScopeResolver(
    IHttpContextAccessor httpContextAccessor,
    IDbContextFactory<DynamicDespatchDbContext> contextFactory) : ICourierScopeResolver
{
    private const string ItemsKey = "CourierScope";

    public async Task<CourierScope?> ResolveAsync(CancellationToken ct = default)
    {
        var http = httpContextAccessor.HttpContext;
        if (http == null) return null;

        if (http.Items.TryGetValue(ItemsKey, out var cached))
            return cached as CourierScope;

        var email = http.User.FindFirst(ClaimTypes.Name)?.Value;
        if (string.IsNullOrWhiteSpace(email))
        {
            Log.Warning("CourierScopeResolver: no email/name claim on the courier principal.");
            http.Items[ItemsKey] = null;
            return null;
        }

        var emailLower = email.ToLower();
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var match = await ctx.TucCouriers
            .Where(c => c.Active && c.UccrEmail != null && c.UccrEmail.ToLower() == emailLower)
            .Select(c => new { c.UccrId, c.MasterCourierId, c.CourierTypeId })
            .FirstOrDefaultAsync(ct);

        CourierScope? scope = match == null
            ? null
            : new CourierScope(match.UccrId, match.MasterCourierId, match.CourierTypeId, email);

        if (scope == null)
            Log.Warning("CourierScopeResolver: no active TucCourier found for {Email}.", email);

        http.Items[ItemsKey] = scope;
        return scope;
    }
}
