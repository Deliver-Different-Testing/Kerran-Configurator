using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Mirrors the React CourierApplicant type, backed by the legacy courierportal
// CourierApplicant table (+ migration-031 columns). pipelineStage is DERIVED
// from the legacy flags — not a stored column. tenantId is omitted (per-tenant
// DB); declarationSignatureS3Key has no backing (legacy stores the signature
// as a byte[] blob).
public class NpApplicantDto
{
    public int Id { get; set; }
    public int? RegionId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Postcode { get; set; } = string.Empty;
    public string VehicleType { get; set; } = string.Empty;
    public string VehicleMake { get; set; } = string.Empty;
    public string VehicleModel { get; set; } = string.Empty;
    public int? VehicleYear { get; set; }
    public string VehiclePlate { get; set; } = string.Empty;
    public string BankAccountName { get; set; } = string.Empty;
    public string BankAccountNumber { get; set; } = string.Empty;
    public string BankBsb { get; set; } = string.Empty;
    public string NextOfKinName { get; set; } = string.Empty;
    public string NextOfKinPhone { get; set; } = string.Empty;
    public string NextOfKinRelationship { get; set; } = string.Empty;
    public string PipelineStage { get; set; } = string.Empty;   // derived
    public bool DeclarationSigned { get; set; }
    public DateTime? DeclarationSignedDate { get; set; }
    public DateTime? RejectedDate { get; set; }
    public string RejectedReason { get; set; } = string.Empty;
    public int? ApprovedAsCourierId { get; set; }
    public DateTime CreatedDate { get; set; }
    public DateTime? ModifiedDate { get; set; }
    public string Notes { get; set; } = string.Empty;
    public List<NpApplicantDocumentDto> Documents { get; set; } = new();
}

// One row per active CourierApplicantDocument (doc type), with the applicant's
// upload state. The legacy upload has no verify/reject/expiry — so Status is
// only "uploaded" or "missing".
public class NpApplicantDocumentDto
{
    public string DocumentTypeName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool Mandatory { get; set; }
    public string Status { get; set; } = "missing";
    public string FileName { get; set; } = string.Empty;
    public DateTime? UploadedDate { get; set; }
}

public class NpPipelineSummaryDto
{
    public string StageName { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class NpApplicantsResponse : BaseResponse
{
    public NpApplicantsResponse(Guid messageId) : base(messageId) { }
    public List<NpApplicantDto> Applicants { get; set; } = new();
}

public class NpApplicantResponse : BaseResponse
{
    public NpApplicantResponse(Guid messageId) : base(messageId) { }
    public NpApplicantDto? Applicant { get; set; }
}

public class NpPipelineSummaryResponse : BaseResponse
{
    public NpPipelineSummaryResponse(Guid messageId) : base(messageId) { }
    public List<NpPipelineSummaryDto> Summary { get; set; } = new();
}
