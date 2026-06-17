using System;

namespace DfrntDriveConfigurator.Core.Domain.Despatch;

// Hand-authored, regen-safe (lives outside the EFPT output folder
// Core/Domain/Despatch). Adds the courier magic-link columns from migration
// 049 to the scaffolded TucCourier entity without a full reverse-engineer.
// Scalar properties map by convention (property name = column name), so no
// extra OnModelCreating configuration is needed. See [[project-configurator-
// cleanup-and-doc-fields]] Item 8.5.
public partial class TucCourier
{
    // Opaque ~22-char base64url magic-link token. Null when no link is issued.
    public string? PortalAccessToken { get; set; }

    // When the current token was generated — drives the 90-day expiry check.
    public DateTime? PortalTokenIssuedAt { get; set; }

    // Last time the link was redeemed (operator visibility on the Courier List).
    public DateTime? PortalTokenLastUsedAt { get; set; }
}
