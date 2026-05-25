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
}
