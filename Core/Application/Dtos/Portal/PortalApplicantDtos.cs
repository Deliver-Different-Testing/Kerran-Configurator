using System;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Portal;

// Courier Portal Phase 1 — applicant lightweight auth + resumable application.
// Mutable [FromBody] classes (project convention; Newtonsoft handles them).

public class PortalRegisterDto
{
    public string FirstName { get; set; }
    public string LastName { get; set; }   // -> CourierApplicant.Surname
    public string Email { get; set; }
    public string Mobile { get; set; }
    public string Password { get; set; }
    // Small optional starter field collected inline on the entry step.
    public string VehicleType { get; set; }
}

public class PortalVerifyEmailDto
{
    public string Email { get; set; }
    public string Code { get; set; }
}

public class PortalLoginDto
{
    public string Email { get; set; }
    public string Password { get; set; }
}

public class PortalRefreshDto
{
    public string Token { get; set; }
}

// Returned by register (no token yet — applicant is unverified).
public class PortalRegisterResultDto
{
    public string Email { get; set; }
    public bool EmailVerified { get; set; }
}

// Returned after verify / login / refresh — the session token + the applicant.
public class PortalSessionDto
{
    public string Token { get; set; }
    public DateTime Expires { get; set; }
    public PortalApplicantDto Applicant { get; set; }
}

// "me" + saved progress. Identity/status fields are read-only from the client's
// point of view; the progress fields round-trip via PortalProgressDto.
public class PortalApplicantDto
{
    public int Id { get; set; }
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public string Email { get; set; }
    public string Mobile { get; set; }
    public string Phone { get; set; }
    public bool EmailVerified { get; set; }
    public string PipelineStage { get; set; }   // derived from legacy flags

    // ---- progress (editable) ----
    public string AddressLine1 { get; set; }
    public string City { get; set; }
    public string State { get; set; }
    public string PostCode { get; set; }
    public string DriversLicenceNo { get; set; }
    public string VehicleType { get; set; }
    public string VehicleMake { get; set; }
    public string VehicleModel { get; set; }
    public int? VehicleYear { get; set; }
    public string VehicleRegistrationNo { get; set; }
    public string BankAccountName { get; set; }
    public string BankAccountNo { get; set; }
    public string BankBsb { get; set; }
    public string NextOfKin { get; set; }
    public string NextOfKinRelationship { get; set; }
    public string NextOfKinPhone { get; set; }
    public string Notes { get; set; }
}

// PUT body — the editable subset only.
public class PortalProgressDto
{
    public string AddressLine1 { get; set; }
    public string City { get; set; }
    public string State { get; set; }
    public string PostCode { get; set; }
    public string DriversLicenceNo { get; set; }
    public string VehicleType { get; set; }
    public string VehicleMake { get; set; }
    public string VehicleModel { get; set; }
    public int? VehicleYear { get; set; }
    public string VehicleRegistrationNo { get; set; }
    public string BankAccountName { get; set; }
    public string BankAccountNo { get; set; }
    public string BankBsb { get; set; }
    public string NextOfKin { get; set; }
    public string NextOfKinRelationship { get; set; }
    public string NextOfKinPhone { get; set; }
    public string Notes { get; set; }
}
