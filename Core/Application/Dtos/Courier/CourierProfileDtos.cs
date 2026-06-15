namespace DfrntDriveConfigurator.Core.Application.Dtos.Courier;

// Phase 2 — courier self-service profile (mirrors the legacy courierportal
// CourierDto/CourierUpdateRequest, ported natively). Mutable [FromBody] classes
// per project convention.

public class CourierProfileDto
{
    public int Id { get; set; }
    public string Code { get; set; }
    public string FirstName { get; set; }
    public string Surname { get; set; }
    public string Phone { get; set; }
    public string Mobile { get; set; }
    public string Email { get; set; }
    public string AddressLine1 { get; set; }
    public string AddressLine2 { get; set; }
    public string AddressLine3 { get; set; }
    public string AddressLine4 { get; set; }
    public string AddressLine5 { get; set; }
    public string AddressLine6 { get; set; }
    public string AddressLine7 { get; set; }
    public string AddressLine8 { get; set; }
    public string DriversLicenceNo { get; set; }
    public string VehicleRegistrationNo { get; set; }
    public string BankRoutingNumber { get; set; }
    public string BankAccountNo { get; set; }
    public string TaxNo { get; set; }            // GST / IRD / tax number (UccrGst)
    public int CourierTypeId { get; set; }
    public bool IsMaster { get; set; }           // no MasterCourierId => operates as a master/standalone
}

// Editable subset — Code / type / audit are not courier-editable.
// All nullable: these are optional fields and the client legitimately sends null
// for ones left blank. Non-nullable `string` would be treated as implicitly
// [Required] by [ApiController] model validation (nullable-ref-types on) and 400
// before the service runs. FirstName/Surname are validated in the service.
public class CourierProfileUpdateDto
{
    public string? FirstName { get; set; }
    public string? Surname { get; set; }
    public string? Phone { get; set; }
    public string? Mobile { get; set; }
    public string? Email { get; set; }
    public string? AddressLine1 { get; set; }
    public string? AddressLine2 { get; set; }
    public string? AddressLine3 { get; set; }
    public string? AddressLine4 { get; set; }
    public string? AddressLine5 { get; set; }
    public string? AddressLine6 { get; set; }
    public string? AddressLine7 { get; set; }
    public string? AddressLine8 { get; set; }
    public string? DriversLicenceNo { get; set; }
    public string? VehicleRegistrationNo { get; set; }
    public string? BankRoutingNumber { get; set; }
    public string? BankAccountNo { get; set; }
    public string? TaxNo { get; set; }
}
