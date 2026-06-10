using System;
using System.IO;
using System.Linq;
using System.Security.AccessControl;
using System.Threading.Tasks;
using Amazon;
using Amazon.Runtime;
using Amazon.Runtime.CredentialManagement;
using Amazon.S3;
using DeliverDifferentReporting.Extensions;
using DfrntDriveConfigurator;
using DfrntDriveConfigurator.Core.Application.Interfaces;
using DfrntDriveConfigurator.Core.Application.Services;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using DfrntDriveConfigurator.Infrastructure;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Serilog;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Configure forwarded headers for proxy/load balancer support
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// Add services to the container.
builder.Services.AddHealthChecks()
    .AddCheck<SqlServerHealthCheck>("sql_server_health_check");
builder.Services.AddControllersWithViews()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.DateTimeZoneHandling = Newtonsoft.Json.DateTimeZoneHandling.RoundtripKind;
        options.SerializerSettings.DateParseHandling = Newtonsoft.Json.DateParseHandling.DateTimeOffset;
    });

builder.Configuration.AddJsonFile("appsettings.json", optional: true, reloadOnChange: true);
Log.Logger = new LoggerConfiguration().ReadFrom.Configuration(builder.Configuration).WriteTo.Console().CreateLogger();

if (builder.Environment.IsDevelopment())
{
    var keyDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "DeliverDifferent", "DataProtection-Keys");

    // Ensure the directory exists with proper permissions
    if (!Directory.Exists(keyDirectory))
    {
        var dirInfo = Directory.CreateDirectory(keyDirectory);

        if (OperatingSystem.IsWindows())
        {
            // Get the current user's identity
            var currentUser = System.Security.Principal.WindowsIdentity.GetCurrent();
            const FileSystemRights fileSystemRights = FileSystemRights.FullControl;
            const InheritanceFlags inheritanceFlags = InheritanceFlags.ContainerInherit |
                                                      InheritanceFlags.ObjectInherit;
            const PropagationFlags propagationFlags = PropagationFlags.None;
            const AccessControlType accessControlType = AccessControlType.Allow;

            var accessRule = new FileSystemAccessRule(
                currentUser.Name,
                fileSystemRights,
                inheritanceFlags,
                propagationFlags,
                accessControlType);

            var security = dirInfo.GetAccessControl();
            security.AddAccessRule(accessRule);
            dirInfo.SetAccessControl(security);
        }
    }

    if (OperatingSystem.IsWindows())
    {
        builder.Services.AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(keyDirectory))
            .SetApplicationName("DeliverDifferent")
            .ProtectKeysWithDpapi();

        Log.Information("DataProtection configured to use directory: {KeyDirectory}", keyDirectory);
    }
}
else
{
    builder.Services.AddDataProtection().PersistKeysToAWSSystemsManager("/Hub/DataProtection")
        .SetApplicationName("DeliverDifferent");
}


builder.Services.AddSingleton<IConnectionStringManager, ConnectionStringManager>();

// IAmazonS3 — OS-aware credential resolution.
//   Windows (local dev): use the developer's AWS SSO credentials profile
//     (refreshed via `aws sso login`).
//   Linux  (container / pod): rely on the default credential chain which
//     picks up IRSA / instance role / env vars automatically.
// The previous version of this block hard-coded SSO creds and would fail
// at first AWS call from any non-Windows host.
builder.Services.AddSingleton<IAmazonS3>(_ =>
{
    var awsOptions = builder.Configuration.GetAWSOptions();
    var region = awsOptions.Region ?? RegionEndpoint.APSoutheast2;

    Log.Information("AWS Region from config: {Region}", region.SystemName);

    var s3Config = new AmazonS3Config { RegionEndpoint = region };

    if (OperatingSystem.IsWindows())
    {
        var ssoCreds = LoadSsoCredentials("default");
        return new AmazonS3Client(ssoCreds, s3Config);
    }

    return new AmazonS3Client(s3Config);
});

// AppSettings — strongly-typed config (env vars + appsettings.json),
// populated at startup and registered as a singleton. Services inject
// AppSettings for typed access to bucket names etc. Matches the
// despatchweb / Mars pattern for stack consistency.
var appSettings = new AppSettings
{
    S3BucketComplianceUploads = builder.Configuration["S3BucketComplianceUploads"] ?? string.Empty,
    HubBaseUrl = (builder.Configuration["HubBaseUrl"] ?? string.Empty).TrimEnd('/'),
    HubAdminApiKey = builder.Configuration["HubAdminApiKey"] ?? string.Empty,
    DespatchWebBaseUrl = (builder.Configuration["DespatchWebBaseUrl"] ?? string.Empty).TrimEnd('/'),
    RunViewerBaseUrl = (builder.Configuration["RunViewerBaseUrl"] ?? string.Empty).TrimEnd('/'),
};
builder.Services.AddSingleton(appSettings);

if (string.IsNullOrEmpty(appSettings.S3BucketComplianceUploads))
{
    Log.Warning("S3BucketComplianceUploads environment variable is not set — compliance document upload/download will fail until it is configured.");
}
else
{
    Log.Information("S3BucketComplianceUploads: {Bucket}", appSettings.S3BucketComplianceUploads);
}

// Phase 5+28a §B.1 — Hub invite cascade settings. Both must be set for
// the cascade to do the Hub-side identity create + invite-email send;
// missing values degrade gracefully (tenant-side tucClientContact is
// still created, a warning surfaces to the operator).
if (string.IsNullOrEmpty(appSettings.HubBaseUrl) || string.IsNullOrEmpty(appSettings.HubAdminApiKey))
{
    Log.Warning("HubBaseUrl and/or HubAdminApiKey not set — NP user-invite cascade will skip the Hub-side identity create. Tenant-side contacts will still be written but operators must provision Hub users manually.");
}
else
{
    Log.Information("HubBaseUrl: {Url}; HubAdminApiKey present.", appSettings.HubBaseUrl);
}

if (string.IsNullOrEmpty(appSettings.DespatchWebBaseUrl))
{
    Log.Warning("DespatchWebBaseUrl not set — the Recurring Jobs tab (deep-link to DespatchWeb) will be hidden.");
}
else
{
    Log.Information("DespatchWebBaseUrl: {Url}", appSettings.DespatchWebBaseUrl);
}

if (string.IsNullOrEmpty(appSettings.RunViewerBaseUrl))
{
    Log.Warning("RunViewerBaseUrl not set — the Operations page Route Viewer + Print Manager links will be disabled.");
}
else
{
    Log.Information("RunViewerBaseUrl: {Url}", appSettings.RunViewerBaseUrl);
}

builder.Services.Configure<CookiePolicyOptions>(options =>
{
    options.CheckConsentNeeded = _ => true;
    options.MinimumSameSitePolicy = SameSiteMode.Lax;
    options.Secure = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
});

// Set reasonable file upload limits (25MB max to prevent DoS)
const long maxFileSize = 25 * 1024 * 1024; // 25MB
builder.Services.Configure<FormOptions>(x =>
{
    x.ValueLengthLimit = (int)maxFileSize;
    x.MultipartBodyLengthLimit = maxFileSize;
    x.MultipartHeadersLengthLimit = 32768;
});
builder.Services.Configure<IISServerOptions>(options => { options?.MaxRequestBodySize = maxFileSize; });
builder.Services.Configure<KestrelServerOptions>(options => { options?.Limits.MaxRequestBodySize = maxFileSize; });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireAssertion(context =>
        {
            var userGroupId = context.User.FindFirst("UserGroupID")?.Value;
            return userGroupId == "1";
        }));

    // NP-scope endpoints (`/api/v1/np/*`) are accessible to Network Partner
    // users and to DF Admins (DF Admins can read/write across all tenants).
    options.AddPolicy("NetworkPartnerOrAdmin", policy =>
        policy.RequireAssertion(context =>
        {
            var userGroupId = context.User.FindFirst("UserGroupID")?.Value;
            var isNp = context.User.FindFirst("IsNetworkPartner")?.Value;
            return userGroupId == "1"
                || string.Equals(isNp, "True", StringComparison.OrdinalIgnoreCase);
        }));

    // Tenant-scope endpoints (`/api/v1/tenant/*`, plus the courier surface
    // shared from `/api/v1/np/*`) — agents directory, quotes marketplace,
    // My Couriers, etc. — are visible to any staff member of the current
    // tenant, plus DF Admins. Two ways a caller qualifies:
    //
    //   1. Legacy despatch staff: a `tblUser` row enriched at
    //      HomeController.Index → a non-empty `UserGroupID` claim.
    //   2. Hub-native tenant staff: users provisioned through this app
    //      (NpUserService.CreateAsync) get a Hub identity + a tucClientContact
    //      with StaffId=null — NEVER a tblUser — so Hub emits no StaffID and
    //      enrichment never stamps UserGroupID for them. They are still
    //      legitimate staff of the tenant Hub scoped them to, identified by a
    //      present `CurrentTenantID` claim. We admit any such tenant-scoped
    //      user who is NOT a courier (couriers belong to the portal lane, not
    //      the tenant management surface).
    //
    // NPs and DF Admins also satisfy (2) — they carry CurrentTenantID and
    // aren't couriers — so they keep their access. Anonymous callers have
    // neither claim and are denied. Per-action `[RequirePermission(...)]`
    // attributes still apply on top of this coarse gate.
    options.AddPolicy("TenantStaffOrAdmin", policy =>
        policy.RequireAssertion(context =>
        {
            var userGroupId = context.User.FindFirst("UserGroupID")?.Value;
            if (!string.IsNullOrEmpty(userGroupId)) return true;

            var currentTenantId = context.User.FindFirst("CurrentTenantID")?.Value;
            var isCourier = context.User.FindFirst("IsCourier")?.Value;
            return !string.IsNullOrEmpty(currentTenantId)
                && !string.Equals(isCourier, "True", StringComparison.OrdinalIgnoreCase);
        }));

    // Phase 5+31 R3 retired the 9 hardcoded Np* policies that were
    // registered here (NpManageUsers / NpEditSettings / NpViewFinancials /
    // NpAssignCouriers / NpManageCouriers / NpManageFleet / NpViewDispatch /
    // NpViewReports / NpViewDashboard) + their DfAdminOrNpRole helper.
    // Matrix-driven [RequirePermission(key)] attribute filters replace
    // them — same semantics (DF Admin bypass, NpRoleId claim lookup,
    // deny-by-default) but data-driven via dbo.RolePermission so admins
    // can toggle role-to-permission mappings at runtime via the matrix
    // UI without redeploying. See:
    //   Core/Application/Authorization/RequirePermissionAttribute.cs
    //   Core/Application/Services/Permissions/RolePermissionResolver.cs
    //   Migration 20260528090000_CreatePermissionAndRolePermissionMatrix.sql
    //
    // The original 9 policies were only actually applied at 2 sites in
    // NpUsersController (both NpManageUsers), so the retire was almost
    // entirely dead-code cleanup. The matrix is the future enforcement
    // layer for all NP and tenant action-gating.
});

builder.Services.AddHttpClient();
builder.Services.AddHttpContextAccessor();

// Register application services
builder.Services.AddScoped<AppConfigService>();
builder.Services.AddScoped<WorkflowTemplateService>();
builder.Services.AddScoped<EventTypeService>();
builder.Services.AddScoped<LookupService>();

// Phase 4 — Network Partner services
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpUserService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Contacts.AdminContactService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpDashboardService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpComplianceService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpReportService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpFleetService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpLookupService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpQuotesService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpDocumentTypeService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpComplianceProfileService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpRecruitmentStageService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpRegistrationSiteService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpApplicantService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.CourierDocumentService>();
builder.Services.AddScoped<
    DfrntDriveConfigurator.Core.Application.Services.Np.INpScopeResolver,
    DfrntDriveConfigurator.Core.Application.Services.Np.NpScopeResolver>();
// NpRoleResolver removed — the R3 RolePermission resolver superseded it, and
// its enum hardcoded NpAdmin=1/2/3 which is wrong on collided tenants.

// Phase 5+31 R2 §2 — ClientType × Feature matrix resolver. Cross-cutting:
// every lane (DF admin / tenant / NP / customer) consumes via /api/me/visible-features.
builder.Services.AddScoped<
    DfrntDriveConfigurator.Core.Application.Services.Features.IClientTypeFeatureResolver,
    DfrntDriveConfigurator.Core.Application.Services.Features.ClientTypeFeatureResolver>();

// Phase 5+31 R3 — Role × Permission matrix resolver. Backs [RequirePermission]
// attribute filters on controller methods + the matrix UI endpoints. DF Admin
// bypass returns the full catalog; non-admins get their role's allow-set with
// per-client overrides applied. Empty set for users with no NpRoleId claim
// (defensive deny-by-default).
builder.Services.AddScoped<
    DfrntDriveConfigurator.Core.Application.Services.Permissions.IRolePermissionResolver,
    DfrntDriveConfigurator.Core.Application.Services.Permissions.RolePermissionResolver>();

// Common infrastructure services (used by multiple lanes)
builder.Services.AddScoped<
    DfrntDriveConfigurator.Core.Application.Services.Common.IS3StorageService,
    DfrntDriveConfigurator.Core.Application.Services.Common.S3StorageService>();
builder.Services.AddScoped<
    DfrntDriveConfigurator.Core.Application.Services.Common.INpUserInviteService,
    DfrntDriveConfigurator.Core.Application.Services.Common.NpUserInviteService>();

// Phase 5+1 — Tenant scope services
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Tenant.TenantAgentService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Tenant.TenantAgentOnboardingService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Tenant.QuoteInviteTokenService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Tenant.QuoteNotificationService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Tenant.TenantQuotesService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Public.PublicQuotesService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Tenant.TenantDashboardService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Tenant.TenantLookupService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Tenant.TenantProspectService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Tenant.TenantRouteService>();

// Client Reporting lane — Rate Schedule (ported from clientcustomreportbuilder)
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Reporting.ReportingLookupService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Reporting.RegionalRateService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Reporting.InternationalRateService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Reporting.RateScheduleService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Reporting.ClientMonthlyReportService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Reporting.CourierJobDetailReportService>();
// Shared report-rendering package (QuestPDF docs + ClosedXML + tenant branding).
// ITenantBrandingService pulls per-tenant branding from Hub. The configurator
// exposes this as HubBaseUrl (K8S_SECRET_HubBaseUrl); AdminManager uses HubUrl.
// Guarded so a missing/blank value can't crash app startup (the package throws
// "BrandingApiBaseUrl setup is required") — report endpoints fail instead.
var brandingApiBaseUrl = builder.Configuration["HubBaseUrl"];
if (!string.IsNullOrWhiteSpace(brandingApiBaseUrl))
{
    builder.Services.AddTenantBranding(opts => opts.BrandingApiBaseUrl = brandingApiBaseUrl);
}
else
{
    Log.Warning("HubBaseUrl not set — Client Reporting tenant branding is unavailable; report generation will fail until it is configured.");
}

// Automation repository (CRUD for configurator UI — engine execution lives in separate AutomationEngine service)
builder.Services.AddScoped<IAutomationRepository, AutomationRepository>();

// Register DespatchContext with a placeholder connection string
// The DynamicDespatchDbContextFactory resolves the real connection per-request via tenant claims
builder.Services.AddDbContextFactory<DespatchContext>(options =>
        options.UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=dummy;Trusted_Connection=True;"),
    ServiceLifetime.Transient);

builder.Services.AddScoped<IDbContextFactory<DespatchContext>, DynamicDespatchDbContextFactory>();
builder.Services.AddScoped<IDbContextFactory<DynamicDespatchDbContext>>(sp =>
{
    var inner = sp.GetRequiredService<IDbContextFactory<DespatchContext>>();
    return new DynamicDespatchDbContextFactoryAdapter(inner);
});

// MasterContext — single fixed connection onto the master-controller (auth) DB.
// Used to provision courier login rows (IsCourier = 1) so new couriers can sign
// in to the mobile app. Same MasterSQLConnection env var AdminManager uses.
//
// Fall back to SQLHealthCheckConnection (which already points at the SAME
// master-controller DB in every environment — see README) so a deploy that
// lands before the dedicated MasterSQLConnection var is set still STARTS rather
// than crash-looping every pod. If the fallback login lacks write perms, courier
// provisioning degrades gracefully (the create path rolls back and returns a
// clear error) instead of taking the app down. Set MasterSQLConnection with
// write access to [User] to make provisioning work in each environment.
var masterConnectionString = Environment.GetEnvironmentVariable("MasterSQLConnection");
if (string.IsNullOrEmpty(masterConnectionString))
{
    masterConnectionString = Environment.GetEnvironmentVariable("SQLHealthCheckConnection");
    if (!string.IsNullOrEmpty(masterConnectionString))
        Log.Warning("MasterSQLConnection not set — falling back to SQLHealthCheckConnection for the master-controller DB. Courier login provisioning needs a login with write access to [User].");
}
if (string.IsNullOrEmpty(masterConnectionString))
    throw new InvalidOperationException(
        "Neither 'MasterSQLConnection' nor 'SQLHealthCheckConnection' env var is set — cannot reach the master-controller DB.");
builder.Services.AddDbContext<DfrntDriveConfigurator.Core.Domain.Master.MasterContext>(options =>
    options.UseSqlServer(masterConnectionString));


var domain = Environment.GetEnvironmentVariable("Domain") ?? string.Empty;
if (string.IsNullOrEmpty(domain))
    throw new InvalidOperationException(
        "Could not find a env var string named 'Domain'.");

// Ensure domain has leading dot for subdomain cookie sharing
if (!domain.StartsWith('.'))
    domain = "." + domain;

// Configure Redis Based Distributed Session
var redisConfig = Environment.GetEnvironmentVariable("RedisConfig");
if (string.IsNullOrEmpty(redisConfig))
    throw new InvalidOperationException(
        "Could not find a Redis Env Var named 'RedisConfig'.");
var redisConfigurationOptions = ConfigurationOptions.Parse(redisConfig);

builder.Services.AddStackExchangeRedisCache(redisCacheConfig =>
{
    redisCacheConfig.ConfigurationOptions = redisConfigurationOptions;
});

builder.Services.AddAuthentication("Identity.Application")
    .AddCookie("Identity.Application", options =>
    {
        options.Cookie.Name = ".AspNet.SharedCookie";
        options.ExpireTimeSpan = TimeSpan.FromMinutes(20);
        options.SlidingExpiration = true;
        options.AccessDeniedPath = "/Forbidden/";
        options.Events = new CookieAuthenticationEvents
        {
            OnRedirectToLogin = context =>
            {
                context.HttpContext.Response.Redirect(Environment.GetEnvironmentVariable("PublicPath") ?? string.Empty);
                return Task.CompletedTask;
            }
        };
        options.Cookie.HttpOnly = true;
        options.Cookie.Domain = domain;
    });

builder.Services.AddSession(options =>
{
    options.Cookie.Name = "configurator_session";
    options.IdleTimeout = TimeSpan.FromMinutes(60 * 24);
});


var app = builder.Build();
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });

// Must be first - handle forwarded headers from proxy/load balancer
app.UseForwardedHeaders();

app.MapHealthChecks("/healthz", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";

        var response = new
        {
            Status = report.Status.ToString(),
            Checks = report.Entries.Select(e => new
            {
                Component = e.Key,
                Status = e.Value.Status.ToString(),
                e.Value.Description
            }),
            Duration = report.TotalDuration
        };

        await context.Response.WriteAsJsonAsync(response);
    }
});

// Configure the HTTP request pipeline.
var provider = new FileExtensionContentTypeProvider
{
    Mappings =
    {
        [".map"] = "application/json"
    }
};

app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = provider
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "dist")),
    RequestPath = "/dist",
    ContentTypeProvider = provider
});

// CSRF protection for API requests - verify X-Requested-With header
// Combined with SameSite cookies, this prevents CSRF attacks
app.Use(async (context, next) =>
{
    var method = context.Request.Method;
    var isStateChangingRequest = method is "POST" or "PUT" or "PATCH" or "DELETE";

    if (isStateChangingRequest && !context.Request.Path.StartsWithSegments("/healthz"))
    {
        var hasXhrHeader = context.Request.Headers.XRequestedWith == "XMLHttpRequest";
        if (!hasXhrHeader)
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsync("Invalid request - missing required header");
            return;
        }
    }

    await next();
});

// Security headers middleware
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;

    // Prevent MIME type sniffing
    headers.XContentTypeOptions = "nosniff";

    // Prevent clickjacking
    headers.XFrameOptions = "DENY";

    // Control referrer information
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

    // Restrict browser features
    headers["Permissions-Policy"] = "geolocation=(), microphone=()";

    // HSTS - Force HTTPS for 1 year, include subdomains (production only)
    if (!app.Environment.IsDevelopment()) headers.StrictTransportSecurity = "max-age=31536000; includeSubDomains";

    // Content Security Policy - restrict resource loading
    var csp =
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "img-src 'self' data: blob: https:; " +
        "font-src 'self' https://fonts.gstatic.com data:; " +
        "connect-src 'self' wss: ws:" + (app.Environment.IsDevelopment() ? " http://localhost:*" : "") + "; " +
        "worker-src 'self' blob:; " +
        "frame-ancestors 'none'; " +
        "frame-src 'none'; " +
        "object-src 'none'; " +
        "manifest-src 'self'; " +
        "base-uri 'self'; " +
        "form-action 'self';";

    // Only upgrade insecure requests in production
    if (!app.Environment.IsDevelopment())
    {
        csp += " upgrade-insecure-requests;";
    }

    headers.ContentSecurityPolicy = csp;

    await next();
});

app.UseCookiePolicy();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

// SPA fallback: any unmatched non-API path hands off to HomeController so React Router can resolve it.
app.MapFallbackToController("Index", "Home");

app.Run();
return;

// Method to get SSO credentials from the information in the shared config file.
static AWSCredentials LoadSsoCredentials(string profile)
{
    var chain = new CredentialProfileStoreChain();
    if (chain.TryGetAWSCredentials(profile, out var credentials)) return credentials;
#pragma warning disable CS0618 // Type or member is obsolete
    credentials = FallbackCredentialsFactory.GetCredentials();
#pragma warning restore CS0618 // Type or member is obsolete
    return credentials ?? throw new Exception($"Failed to find the {profile} profile or any fallback credentials");
}
