namespace DfrntDriveConfigurator.Infrastructure;

/// <summary>
/// Strongly-typed application settings populated at startup from configuration
/// sources (environment variables, appsettings.json). Registered as a singleton
/// so any service can inject it. Matches the despatchweb / Mars pattern for
/// stack consistency.
/// </summary>
public class AppSettings
{
    /// <summary>
    /// S3 bucket holding compliance / training document uploads keyed off the
    /// CourierDocuments table. Set per environment:
    ///   sandbox / local dev   urgent-couriers-compliance-uploads-sandbox
    ///   dfrnt staging         urgent-couriers-compliance-uploads-staging
    ///   per-tenant staging    urgent-couriers-compliance-uploads-{tenant}-staging
    ///   per-tenant prod       urgent-couriers-compliance-uploads-{tenant}-prod
    /// Bound from env var S3BucketComplianceUploads at startup.
    /// </summary>
    public string S3BucketComplianceUploads { get; set; } = string.Empty;

    /// <summary>
    /// S3 bucket holding the PDF Overlay tool's templates, field-maps and rendered
    /// output (folded in from the standalone pdf-overlay-tool). Keys are rooted at
    /// `tenants/{tenantId}/templates/...` so the one bucket is shared across tenants
    /// with isolation by prefix. Bound from env var S3BucketPdfOverlay at startup.
    /// Empty value disables the tool (the admin endpoints throw a clear 500 until set).
    /// </summary>
    public string S3BucketPdfOverlay { get; set; } = string.Empty;

    /// <summary>
    /// Base URL of the Hub app (`https://hub.example.com`), used by the
    /// configurator's NP user-invite cascade to call Hub's
    /// `POST /api/admin/users` endpoint server-to-server (Phase 5+28a §B.1).
    /// No trailing slash. Empty value disables the invite cascade — the
    /// configurator still creates tenant-side tucClientContact rows but
    /// the Hub-side identity + invite-email step is skipped (with a
    /// warning surfaced to the operator).
    /// </summary>
    public string HubBaseUrl { get; set; } = string.Empty;

    /// <summary>
    /// Shared secret for the configurator's server-to-server calls to Hub's
    /// `/api/admin/users` endpoint (Phase 5+28a §B.1). Hub validates this
    /// against its own `ConfiguratorApiKey` env var. Separate from any
    /// PartnerDirectoryApiKey to keep the trust boundaries distinct.
    /// </summary>
    public string HubAdminApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Base URL of the tenant's DespatchWeb (Dispatch software) app
    /// (`https://despatch.{tenant}.{env}.deliverdifferent.com`), no trailing
    /// slash. Set per-tenant deployment via env var DespatchWebBaseUrl.
    /// Surfaced to the SPA in the bootstrap blob so the Recurring Routes page
    /// can deep-link to DespatchWeb's Recurring Jobs view. Empty value hides
    /// the "Recurring Jobs" tab (e.g. local dev with no DespatchWeb).
    /// </summary>
    public string DespatchWebBaseUrl { get; set; } = string.Empty;

    /// <summary>
    /// Base URL of the tenant's RunViewer app
    /// (`https://runviewer.{tenant}.{env}.deliverdifferent.com`), no trailing
    /// slash. Set per-tenant deployment via env var RunViewerBaseUrl. Surfaced
    /// to the SPA so the Operations page can deep-link to RunViewer (Route
    /// Viewer + Print Manager). Empty value leaves those links disabled.
    /// </summary>
    public string RunViewerBaseUrl { get; set; } = string.Empty;

    // ---- Courier Portal (Phase 1) ----------------------------------------
    // The configurator is absorbing the legacy `courierportal` app. The new
    // applicant/courier portal serves anonymous public surfaces
    // (/apply/* and /courier/*) that have no Hub cookie, so they cannot
    // resolve the tenant DB the normal way (Hub passes the connection in a
    // claim at login). Instead the portal is deployed ONE-PER-TENANT and
    // reads its own tenant id + Despatch connection from config. The
    // :tenantSlug in the URL is cosmetic/branding only.
    //
    // All four are empty by default — when PortalTenantId /
    // PortalDespatchConnection are unset the portal is DISABLED (its
    // endpoints return 503 and the Razor entry points 404), so the shared
    // multi-tenant configurator deployment is unaffected.

    /// <summary>
    /// This deployment's tenant id (the CurrentTenantID value the Hub would
    /// otherwise stamp). Used to seed the connection-string cache and stamp
    /// the per-request tenant override for anonymous /api/portal/* calls.
    /// Bound from env var PortalTenantId.
    /// </summary>
    public string PortalTenantId { get; set; } = string.Empty;

    /// <summary>
    /// The tenant Despatch DB connection string for this portal deployment
    /// (without the shared SQLCredentials suffix — that is appended at seed
    /// time, same as HomeController does for the Hub-supplied connection).
    /// Bound from env var PortalDespatchConnection.
    /// </summary>
    public string PortalDespatchConnection { get; set; } = string.Empty;

    /// <summary>
    /// Cosmetic slug used in branded portal URLs (e.g. /apply/{slug}).
    /// Branding only — never used for backend tenant resolution. Defaults to
    /// "portal" when unset. Bound from env var PortalTenantSlug.
    /// </summary>
    public string PortalTenantSlug { get; set; } = "portal";

    /// <summary>
    /// Display/brand name shown in portal emails and the themed shell
    /// (e.g. "Acme Couriers"). Defaults to "Deliver Different" when unset.
    /// Bound from env var PortalDisplayName.
    /// </summary>
    public string PortalDisplayName { get; set; } = "Deliver Different";

    /// <summary>True when the portal has the minimum config to operate.</summary>
    public bool PortalEnabled =>
        !string.IsNullOrEmpty(PortalTenantId) && !string.IsNullOrEmpty(PortalDespatchConnection);
}
