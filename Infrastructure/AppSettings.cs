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
}
