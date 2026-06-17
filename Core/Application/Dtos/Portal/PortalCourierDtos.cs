using System;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Portal;

// Courier Portal magic-link (Item 8.5). Body for POST /api/portal/courier/auth/validate
// — the opaque DB token from the /drive/<slug>/<token> link.
public class PortalCourierDriveTokenDto
{
    public string DriveToken { get; set; } = string.Empty;
}

// Returned on a successful magic-link redemption: the signed courier session
// token (carried as X-Portal-Token on /api/v1/courier/*) + a thin profile the
// SPA shows in the shell header before the first /api/v1/courier/profile call.
public class PortalCourierSessionDto
{
    public string Token { get; set; } = string.Empty;
    public DateTime Expires { get; set; }
    public PortalCourierProfileDto Courier { get; set; } = new();
}

public class PortalCourierProfileDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string SurName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
}
