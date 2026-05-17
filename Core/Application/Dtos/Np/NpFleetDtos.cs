using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Shape consumed by the React Courier type (wwwroot/app/react/types/index.ts).
// Lookup-table fields (insuranceCo, carrierLiab, publicLiab, channel, deviceType,
// make) are NOT populated yet — they need joins to lookup tables and land in a
// later pass. Frontend defaults those to safe values until then.
public class NpFleetCourierDto
{
    // Identity / links
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public int? MasterCourierId { get; set; }

    // Profile
    public string FirstName { get; set; } = string.Empty;
    public string SurName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;       // urgent mobile
    public string Mobile { get; set; } = string.Empty;      // personal
    public string HomePhone { get; set; } = string.Empty;
    public bool? Gender { get; set; }                       // null=unknown, true=Male, false=Female
    public DateTime? Dob { get; set; }
    public string Address { get; set; } = string.Empty;
    public string Doctor { get; set; } = string.Empty;
    public string DoctorPhone { get; set; } = string.Empty;
    public string NextOfKin { get; set; } = string.Empty;
    public string NokRelationship { get; set; } = string.Empty;
    public string NokAddress { get; set; } = string.Empty;
    public string NokPhone { get; set; } = string.Empty;
    public DateTime? StartDate { get; set; }
    public DateTime? FinishDate { get; set; }
    public bool Active { get; set; }

    // Vehicle
    public string Vehicle { get; set; } = string.Empty;     // descriptor string
    public int? MakeId { get; set; }                        // FK to tucVehicleMake — drives the dropdown
    public string Make { get; set; } = string.Empty;        // resolved name for display when offline
    public string Model { get; set; } = string.Empty;
    public int? Year { get; set; }
    public string Rego { get; set; } = string.Empty;
    public bool LowEmission { get; set; }
    public int? MaxPallets { get; set; }
    public double? TareWeight { get; set; }
    public double? MaxCarry { get; set; }
    public double? RucWeight { get; set; }
    public double? RucKms { get; set; }
    public double? RucPayload { get; set; }
    public double? Height { get; set; }
    public double? Width { get; set; }
    public double? Length { get; set; }
    public DateTime? InspectionExpiry { get; set; }
    public DateTime? RegoExpiry { get; set; }

    // Licensing
    public string DlNo { get; set; } = string.Empty;
    public DateTime? DlExpiry { get; set; }
    public bool DangerousGoods { get; set; }
    public DateTime? DgExpiry { get; set; }
    public bool Hte { get; set; }
    public string TslNo { get; set; } = string.Empty;       // OpenForceNumber

    // Insurance — three FKs all to tucInsuranceCompany. UcicName comes back
    // as the display string for each. (Schema oddity: the "Carrier Liability"
    // and "Public Liability" columns are FK-to-company, not dollar amounts as
    // Steve's prototype Courier type assumed.)
    public string PolicyNo { get; set; } = string.Empty;
    public int? InsuranceCoId { get; set; }
    public string InsuranceCo { get; set; } = string.Empty;
    public int? CarrierLiabId { get; set; }
    public string CarrierLiabCompany { get; set; } = string.Empty;
    public int? PublicLiabId { get; set; }
    public string PublicLiabCompany { get; set; } = string.Empty;
    public bool CommercialIns { get; set; }

    // Financial
    public string TaxId { get; set; } = string.Empty;       // UccrGst
    public decimal? Wht { get; set; }
    public string BankAcct { get; set; } = string.Empty;
    public double? PayPct { get; set; }
    public decimal? BonusPct { get; set; }
    public bool PaydayReg { get; set; }
    public DateTime? ContractSigned { get; set; }
    public DateTime? SecurityCheck { get; set; }

    // Device & settings
    public bool DeviceAdmin { get; set; }
    public bool Vodafone { get; set; }
    public bool SmsJob { get; set; }
    public bool SmsAlert { get; set; }
    public bool WebEnabled { get; set; }
    public bool AutoDispatch { get; set; }
    public bool ShowClientPhone { get; set; }
    public bool DisplayWeb { get; set; }
    public bool PodRequired { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }

    // Notes & audit
    public string Notes { get; set; } = string.Empty;
    public DateTime Created { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime Modified { get; set; }
    public string ModifiedBy { get; set; } = string.Empty;
}

public class NpFleetCouriersResponse : BaseResponse
{
    public NpFleetCouriersResponse(Guid messageId) : base(messageId) { }
    public List<NpFleetCourierDto> Couriers { get; set; } = new();
}

// Payload for PUT /api/v1/np/fleet/{id}. Mirrors editable fields from
// NpFleetCourierDto but drops identity (Id/Code/MasterCourierId), audit
// columns (Created/Modified*), and NpAgentId — NP users cannot transfer
// a courier to another NP from the edit form.
public class NpFleetCourierUpdateDto
{
    // Profile
    public string FirstName { get; set; } = string.Empty;
    public string SurName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;       // urgent mobile
    public string Mobile { get; set; } = string.Empty;      // personal
    public string HomePhone { get; set; } = string.Empty;
    public bool? Gender { get; set; }
    public DateTime? Dob { get; set; }
    public string Address { get; set; } = string.Empty;
    public string Doctor { get; set; } = string.Empty;
    public string DoctorPhone { get; set; } = string.Empty;
    public string NextOfKin { get; set; } = string.Empty;
    public string NokRelationship { get; set; } = string.Empty;
    public string NokAddress { get; set; } = string.Empty;
    public string NokPhone { get; set; } = string.Empty;
    public DateTime? StartDate { get; set; }
    public DateTime? FinishDate { get; set; }
    public bool Active { get; set; }

    // Vehicle
    public string Vehicle { get; set; } = string.Empty;
    public int? MakeId { get; set; }                        // FK to tucVehicleMake
    public string Model { get; set; } = string.Empty;
    public int? Year { get; set; }
    public string Rego { get; set; } = string.Empty;
    public bool LowEmission { get; set; }
    public int? MaxPallets { get; set; }
    public double? TareWeight { get; set; }
    public double? MaxCarry { get; set; }
    public double? RucWeight { get; set; }
    public double? RucKms { get; set; }
    public double? RucPayload { get; set; }
    public double? Height { get; set; }
    public double? Width { get; set; }
    public double? Length { get; set; }
    public DateTime? InspectionExpiry { get; set; }
    public DateTime? RegoExpiry { get; set; }

    // Licensing
    public string DlNo { get; set; } = string.Empty;
    public DateTime? DlExpiry { get; set; }
    public bool DangerousGoods { get; set; }
    public DateTime? DgExpiry { get; set; }
    public bool Hte { get; set; }
    public string TslNo { get; set; } = string.Empty;

    // Insurance (scalar + lookup IDs)
    public string PolicyNo { get; set; } = string.Empty;
    public int? InsuranceCoId { get; set; }
    public int? CarrierLiabId { get; set; }
    public int? PublicLiabId { get; set; }
    public bool CommercialIns { get; set; }

    // Financial
    public string TaxId { get; set; } = string.Empty;
    public decimal? Wht { get; set; }
    public string BankAcct { get; set; } = string.Empty;
    public double? PayPct { get; set; }
    public decimal? BonusPct { get; set; }
    public bool PaydayReg { get; set; }
    public DateTime? ContractSigned { get; set; }
    public DateTime? SecurityCheck { get; set; }

    // Device & settings
    public bool DeviceAdmin { get; set; }
    public bool Vodafone { get; set; }
    public bool SmsJob { get; set; }
    public bool SmsAlert { get; set; }
    public bool WebEnabled { get; set; }
    public bool AutoDispatch { get; set; }
    public bool ShowClientPhone { get; set; }
    public bool DisplayWeb { get; set; }
    public bool PodRequired { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }

    // Notes
    public string Notes { get; set; } = string.Empty;
}

// Payload for POST /api/v1/np/fleet — the lean "Quick Add" courier-create
// flow. Only the essentials are captured; the remaining ~45 fields on
// NpFleetCourierDto are filled afterwards from the CourierSetup edit screen.
// Code is user-supplied (matches AdminManager's CourierService.Create) — the
// service validates it's non-empty and not already in use before insert.
public class NpFleetCourierCreateDto
{
    public string Code { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string SurName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;       // personal mobile
    public string VehicleType { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
}

public class NpFleetCourierResponse : BaseResponse
{
    public NpFleetCourierResponse(Guid messageId) : base(messageId) { }
    public NpFleetCourierDto? Courier { get; set; }
}
