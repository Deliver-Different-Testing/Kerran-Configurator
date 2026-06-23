using System;
using System.Linq;
using System.Net.Http;
using System.Net.Sockets;
using System.Threading.Tasks;
using Amazon.S3;
using DfrntDriveConfigurator.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DfrntDriveConfigurator.Core.PdfOverlay;

/// <summary>
/// DI wiring for the vendored PDF Overlay tool: the pure renderer, SSRF-guarded image resolution, the
/// tenant-scoped S3 template store, and the orchestrator. Reuses configurator's already-registered
/// <see cref="IAmazonS3"/> singleton and reads the bucket from <see cref="AppSettings.S3BucketPdfOverlay"/>.
/// </summary>
public static class PdfOverlayServiceRegistration
{
    private const int MaxImageBytes = 10 * 1024 * 1024; // 10 MB
    private static readonly TimeSpan FetchTimeout = TimeSpan.FromSeconds(10);

    public static IServiceCollection AddPdfOverlay(this IServiceCollection services)
    {
        services.TryAddSingleton(TimeProvider.System);
        services.TryAddSingleton<IPdfOverlayRenderer, PdfOverlayRenderer>();
        services.AddHttpContextAccessor();
        services.TryAddScoped<ITenantContext, HttpTenantContext>();
        services.TryAddScoped<IPdfOverlayTemplates, PdfOverlayTemplates>();

        // Tenant-scoped S3 store over the existing IAmazonS3 singleton; bucket from AppSettings.
        services.AddScoped<ITemplateStore>(sp =>
        {
            var settings = sp.GetRequiredService<AppSettings>();
            var bucket = string.IsNullOrWhiteSpace(settings.S3BucketPdfOverlay)
                ? throw new InvalidOperationException(
                    "S3BucketPdfOverlay is not configured — the PDF Overlay tool cannot store templates.")
                : settings.S3BucketPdfOverlay;

            return new S3TemplateStore(
                sp.GetRequiredService<IAmazonS3>(),
                bucket,
                sp.GetRequiredService<ITenantContext>().TenantId,
                sp.GetRequiredService<TimeProvider>());
        });

        AddImageResolver(services);
        return services;
    }

    /// <summary>Registers <see cref="IImageResolver"/> with an SSRF-hardened, size/time-bounded HttpClient.</summary>
    private static void AddImageResolver(IServiceCollection services)
    {
        services
            .AddHttpClient<IImageResolver, HttpImageResolver>(client =>
            {
                client.Timeout = FetchTimeout;
                client.MaxResponseContentBufferSize = MaxImageBytes;
            })
            .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
            {
                AllowAutoRedirect = false, // a public URL could 30x to an internal one
                ConnectTimeout = FetchTimeout,
                // Authoritative guard: validate the actual IP being connected to (defeats DNS rebinding).
                ConnectCallback = async (context, ct) =>
                {
                    var addresses = await System.Net.Dns.GetHostAddressesAsync(context.DnsEndPoint.Host, ct);
                    var safe = addresses.Where(ip => !SsrfGuard.IsBlocked(ip)).ToArray();
                    if (safe.Length == 0)
                    {
                        throw new ImageResolutionException(
                            $"Refusing to connect to blocked host '{context.DnsEndPoint.Host}'.");
                    }

                    var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
                    try
                    {
                        await socket.ConnectAsync(safe, context.DnsEndPoint.Port, ct);
                        return new NetworkStream(socket, ownsSocket: true);
                    }
                    catch
                    {
                        socket.Dispose();
                        throw;
                    }
                }
            });
    }
}
