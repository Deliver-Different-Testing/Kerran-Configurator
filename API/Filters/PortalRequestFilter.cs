using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Portal;
using DfrntDriveConfigurator.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;

namespace DfrntDriveConfigurator.API.Filters;

// Marks a portal action that requires a valid X-Portal-Token (the signed
// applicant session). Anonymous portal actions (register / verify / login /
// refresh) omit it.
[AttributeUsage(AttributeTargets.Method)]
public sealed class PortalAuthorizeAttribute : Attribute;

// Runs before every /api/portal/* action. Two jobs:
//   1. Ensure the portal is configured + the tenant connection is seeded, then
//      stamp DynamicDespatchDbContextFactory's per-request tenant override so
//      anonymous requests resolve the right per-deployment tenant DB.
//   2. For [PortalAuthorize] actions, validate the X-Portal-Token, override the
//      tenant from the token, and expose the applicant id on HttpContext.Items.
public sealed class PortalRequestFilter(
    IPortalTenantContext portalTenant,
    PortalSessionTokenService tokenService) : IAsyncActionFilter
{
    public const string ApplicantIdItemsKey = "PortalApplicantId";
    private const string TokenHeader = "X-Portal-Token";

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (!portalTenant.IsConfigured)
        {
            context.Result = new ObjectResult(new { message = "The courier portal is not enabled on this deployment." })
            {
                StatusCode = StatusCodes.Status503ServiceUnavailable
            };
            return;
        }

        await portalTenant.EnsureConnectionSeededAsync();

        var http = context.HttpContext;
        // Default: anonymous portal calls use the deployment's configured tenant.
        http.Items[DynamicDespatchDbContextFactory.OverrideTenantIdItemsKey] = portalTenant.TenantId;

        if (RequiresAuth(context))
        {
            var token = http.Request.Headers[TokenHeader].ToString();
            var decoded = tokenService.TryRead(token);
            if (decoded == null)
            {
                context.Result = new ObjectResult(new { message = "Session expired. Please sign in again." })
                {
                    StatusCode = StatusCodes.Status401Unauthorized
                };
                return;
            }

            // The token carries its own tenant — prefer it over the config
            // default (defence-in-depth; in a one-deployment-per-tenant model
            // they are the same).
            http.Items[DynamicDespatchDbContextFactory.OverrideTenantIdItemsKey] = decoded.Value.TenantId;
            http.Items[ApplicantIdItemsKey] = decoded.Value.ApplicantId;
        }

        await next();
    }

    private static bool RequiresAuth(ActionExecutingContext context) =>
        context.ActionDescriptor is ControllerActionDescriptor cad &&
        cad.MethodInfo.GetCustomAttributes(typeof(PortalAuthorizeAttribute), inherit: true).Length > 0;
}
