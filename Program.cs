using System;
using System.IO;
using System.Linq;
using System.Security.AccessControl;
using System.Threading.Tasks;
using Amazon;
using Amazon.Runtime;
using Amazon.Runtime.CredentialManagement;
using Amazon.S3;
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
builder.Services.AddSingleton<IAmazonS3>(_ =>
{
    var awsOptions = builder.Configuration.GetAWSOptions();

    Log.Information("AWS Region from config: {Region}", awsOptions.Region?.SystemName ?? "null");

    var ssoCreds = LoadSsoCredentials("default");
    return new AmazonS3Client(ssoCreds, new AmazonS3Config
    {
        RegionEndpoint = awsOptions.Region ?? RegionEndpoint.APSoutheast2
    });
});

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

    // Tenant-scope endpoints (`/api/v1/tenant/*`) — agents directory, quotes
    // marketplace, etc. — are visible to any tenant staff member (anyone
    // whose tblUser row was enriched at HomeController.Index, i.e. has a
    // UserGroupID claim) plus DF Admins. NPs also get in via this policy
    // because they're staff at their own tenant.
    options.AddPolicy("TenantStaffOrAdmin", policy =>
        policy.RequireAssertion(context =>
        {
            var userGroupId = context.User.FindFirst("UserGroupID")?.Value;
            return !string.IsNullOrEmpty(userGroupId);
        }));
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
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpDashboardService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpComplianceService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpReportService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpFleetService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpLookupService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Np.NpQuotesService>();
builder.Services.AddScoped<
    DfrntDriveConfigurator.Core.Application.Services.Np.INpScopeResolver,
    DfrntDriveConfigurator.Core.Application.Services.Np.NpScopeResolver>();

// Phase 5+1 — Tenant scope services
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Tenant.TenantAgentService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Tenant.QuoteNotificationService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Tenant.TenantQuotesService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Tenant.TenantDashboardService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Tenant.TenantLookupService>();
builder.Services.AddScoped<DfrntDriveConfigurator.Core.Application.Services.Tenant.TenantProspectService>();

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
