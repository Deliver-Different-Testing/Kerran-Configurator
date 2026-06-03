#nullable disable
namespace DfrntDriveConfigurator.Core.Domain.Master;

// Minimal hand-written projection of the master-controller [User] table.
// Configurator only needs to provision/maintain courier login rows
// (IsCourier = 1), so we model just the columns the mobile-login flow reads
// (see marsapi AuthenticateController / AuthenticationRepository). This is NOT
// EF Power Tools scaffolded — keep it hand-maintained and lean.
public partial class User
{
    public int UserId { get; set; }

    public string Email { get; set; }

    public string Password { get; set; }

    public string Salt { get; set; }

    public string ResetKey { get; set; }

    public int? CurrentTenantId { get; set; }

    public bool IsLegacyHash { get; set; }

    public bool? IsCourier { get; set; }
}
