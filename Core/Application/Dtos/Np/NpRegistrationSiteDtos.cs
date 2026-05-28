using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Backs the "Registration Settings" page — per-site applicant-registration
// toggle, mapped to the legacy TblSite.CourierApplicantEnabled column.
// Tenant-wide config; not NP-scoped.
public class NpRegistrationSiteDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool ApplicantEnabled { get; set; }
}

public class NpRegistrationSiteToggleDto
{
    public bool ApplicantEnabled { get; set; }
}

public class NpRegistrationSitesResponse : BaseResponse
{
    public NpRegistrationSitesResponse(Guid messageId) : base(messageId) { }
    public List<NpRegistrationSiteDto> Sites { get; set; } = new();
}

public class NpRegistrationSiteResponse : BaseResponse
{
    public NpRegistrationSiteResponse(Guid messageId) : base(messageId) { }
    public NpRegistrationSiteDto? Site { get; set; }
}
