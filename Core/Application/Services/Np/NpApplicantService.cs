using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Recruitment pipeline — read side. Applicants are the legacy courierportal
// CourierApplicant table. pipelineStage is DERIVED from the legacy flags
// (the legacy model is flag-based, not stage-based — see migration 031).
// Tenant-wide; not NP-scoped. Mutating actions (advance / approve / reject)
// are a later slice.
//
// Feature gate: every public method short-circuits with FeatureGateDenied
// when the caller's per-NP NpFeatureConfig.CanManageApplicants is false.
// DF Admin bypasses (NpFeatures.AllOn). See Phase 5+26 / NpFeatureResolver.
public class NpApplicantService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IHttpContextAccessor httpContextAccessor,
    INpFeatureResolver featureResolver) : BaseService(contextFactory)
{
    private const string FeatureGateDeniedMessage =
        "Applicant management is disabled for your network partner. Contact your DF Admin to enable it.";

    // The 7-stage React union. The legacy flags only pin down 5 of them —
    // Registration and Profile have no flag, so applicants surface in the
    // nearest flag-backed stage.
    private static string DerivePipelineStage(CourierApplicant a)
    {
        if (a.CourierId.HasValue || a.TrainingCompleted) return "Approval";
        if (a.DeclarationAgree) return "Training";
        if (a.EmailVerified) return "Documentation";
        return "Email Verification";
    }

    public async Task<NpApplicantsResponse> GetApplicants(Guid messageId)
    {
        if (!(await featureResolver.ResolveAsync()).CanManageApplicants)
            return FailApplicants(messageId, FeatureGateDeniedMessage);

        var rows = await Context.CourierApplicants.AsNoTracking()
            .OrderByDescending(a => a.Created)
            .ToListAsync();

        var applicants = await BuildDtos(rows);
        return new NpApplicantsResponse(messageId) { Success = true, Applicants = applicants };
    }

    public async Task<NpApplicantResponse> GetById(int id, Guid messageId)
    {
        if (!(await featureResolver.ResolveAsync()).CanManageApplicants)
            return FailApplicant(messageId, FeatureGateDeniedMessage);

        var row = await Context.CourierApplicants.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id);
        if (row is null)
            return FailApplicant(messageId, "Applicant not found.");

        var dtos = await BuildDtos([row]);
        return new NpApplicantResponse(messageId) { Success = true, Applicant = dtos.FirstOrDefault() };
    }

    // Advances an applicant to the next derived stage by setting the next
    // legacy flag. Stops at Approval — promoting to a courier is Slice C.
    public async Task<NpApplicantResponse> AdvanceAsync(int id, Guid messageId)
    {
        if (!(await featureResolver.ResolveAsync()).CanManageApplicants)
            return FailApplicant(messageId, FeatureGateDeniedMessage);

        var a = await Context.CourierApplicants.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return FailApplicant(messageId, "Applicant not found.");
        if (a.RejectDate is not null) return FailApplicant(messageId, "Cannot advance a rejected applicant.");
        if (a.CourierId.HasValue) return FailApplicant(messageId, "Applicant is already approved.");

        switch (DerivePipelineStage(a))
        {
            case "Email Verification":
                a.EmailVerified = true;
                break;
            case "Documentation":
                a.DeclarationAgree = true;
                a.DeclarationDate ??= DateTime.UtcNow;
                break;
            case "Training":
                a.TrainingCompleted = true;
                break;
            default:
                return FailApplicant(messageId, "Applicant is at the final stage — use Approve to activate as a courier.");
        }

        a.ModifiedDate = DateTime.UtcNow;
        await Context.SaveChangesAsync();
        return await GetById(id, messageId);
    }

    public async Task<NpApplicantResponse> RejectAsync(int id, string reason, Guid messageId)
    {
        if (!(await featureResolver.ResolveAsync()).CanManageApplicants)
            return FailApplicant(messageId, FeatureGateDeniedMessage);

        var a = await Context.CourierApplicants.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return FailApplicant(messageId, "Applicant not found.");

        a.RejectDate = DateTime.UtcNow;
        a.RejectReason = string.IsNullOrWhiteSpace(reason) ? "Rejected" : reason.Trim();
        a.ModifiedDate = DateTime.UtcNow;
        await Context.SaveChangesAsync();
        return await GetById(id, messageId);
    }

    // Puts a rejected applicant back on the pipeline — clears the rejection.
    public async Task<NpApplicantResponse> ResubmitAsync(int id, Guid messageId)
    {
        if (!(await featureResolver.ResolveAsync()).CanManageApplicants)
            return FailApplicant(messageId, FeatureGateDeniedMessage);

        var a = await Context.CourierApplicants.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return FailApplicant(messageId, "Applicant not found.");

        a.RejectDate = null;
        a.RejectReason = null;
        a.ModifiedDate = DateTime.UtcNow;
        await Context.SaveChangesAsync();
        return await GetById(id, messageId);
    }

    // Approve → courier promotion. Creates a TucCourier from the applicant's
    // data, links CourierApplicant.CourierId. Code auto-assigns when blank.
    // Mirrors the Add Courier slice (NpFleetService.CreateAsync) for the
    // TucCourier shape. No Master-DB user sync — that's a Contact-level concern.
    public async Task<NpApplicantResponse> ApproveAsync(int id, NpApplicantApproveDto dto, Guid messageId)
    {
        if (!(await featureResolver.ResolveAsync()).CanManageApplicants)
            return FailApplicant(messageId, FeatureGateDeniedMessage);

        var a = await Context.CourierApplicants.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return FailApplicant(messageId, "Applicant not found.");
        if (a.CourierId.HasValue) return FailApplicant(messageId, "Applicant is already approved.");
        if (a.RejectDate is not null) return FailApplicant(messageId, "Cannot approve a rejected applicant.");

        if (dto.CourierFleetId <= 0 ||
            !await Context.TucCourierFleets.AnyAsync(f => f.UccfId == dto.CourierFleetId))
            return FailApplicant(messageId, "A valid fleet must be selected.");

        var code = (dto.CourierCode ?? string.Empty).Trim();
        if (code.Length == 0)
            code = await GenerateCourierCode(a);
        else if (await Context.TucCouriers.AsNoTracking().AnyAsync(c => c.Code == code))
            return FailApplicant(messageId, $"Courier code \"{code}\" is already in use.");

        var actor = httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
                    ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
                    ?? "system";
        var now = DateTime.UtcNow;

        var courier = new TucCourier
        {
            Code = code,
            UccrName = a.FirstName ?? string.Empty,
            UccrSurname = a.Surname ?? string.Empty,
            UccrEmail = a.Email ?? string.Empty,
            PersonalMobile = a.Mobile ?? string.Empty,
            UccrTel = a.Phone ?? string.Empty,
            UccrDob = a.DateOfBirth,
            AddressLine1 = a.AddressLine1 ?? a.Address ?? string.Empty,
            AddressLine6 = a.State ?? string.Empty,           // AddressLine6 = "American State"
            UccrDlno = a.DriversLicenceNo ?? string.Empty,
            UccrVehicle = a.VehicleType ?? string.Empty,
            UccrReg = a.VehicleRegistrationNo ?? string.Empty,
            UccrVehicleModel = a.VehicleModel ?? string.Empty,
            UccrVehicleYear = a.VehicleYear,
            UccrGst = a.TaxNo ?? string.Empty,
            UccrBankAccountNo = a.BankAccountNo ?? string.Empty,
            UccrKinName = a.NextOfKin ?? string.Empty,
            UccrKinRelationship = a.NextOfKinRelationship ?? string.Empty,
            UccrKinTel = a.NextOfKinPhone ?? string.Empty,
            UccrKinAdd = a.NextOfKinAddress ?? string.Empty,
            RegionId = a.RegionId,
            CourierTypeId = a.CourierTypeId ?? 2,             // default Master
            MasterCourierId = a.MasterCourierId,
            CourierFleetId = dto.CourierFleetId,
            Active = true,
            Created = now,
            CreatedBy = actor,
            LastModified = now,
            LastModifiedBy = actor,
        };

        Context.TucCouriers.Add(courier);
        await Context.SaveChangesAsync();

        a.CourierId = courier.UccrId;
        a.CourierCode = code;
        a.CourierFleetId = dto.CourierFleetId;
        a.ModifiedDate = now;
        await Context.SaveChangesAsync();

        return await GetById(id, messageId);
    }

    // Auto-assigns a courier code: first-initial + surname, uppercased and
    // stripped to alphanumerics; a numeric suffix is appended on collision.
    private async Task<string> GenerateCourierCode(CourierApplicant a)
    {
        var first = (a.FirstName ?? string.Empty).Trim();
        var sur = (a.Surname ?? string.Empty).Trim();
        var baseCode = new string(
            ((first.Length > 0 ? first[..1] : string.Empty) + sur)
            .Where(char.IsLetterOrDigit).ToArray())
            .ToUpperInvariant();
        if (baseCode.Length == 0) baseCode = "COURIER";
        if (baseCode.Length > 16) baseCode = baseCode[..16];

        var taken = (await Context.TucCouriers.AsNoTracking()
                .Where(c => c.Code != null && c.Code.StartsWith(baseCode))
                .Select(c => c.Code!)
                .ToListAsync())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (!taken.Contains(baseCode)) return baseCode;
        for (var i = 2; ; i++)
        {
            var candidate = baseCode + i;
            if (!taken.Contains(candidate)) return candidate;
        }
    }

    private static NpApplicantResponse FailApplicant(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new() { Message = message } },
    };

    private static NpApplicantsResponse FailApplicants(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new() { Message = message } },
    };

    private static NpPipelineSummaryResponse FailSummary(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new() { Message = message } },
    };

    public async Task<NpPipelineSummaryResponse> GetPipelineSummary(Guid messageId)
    {
        if (!(await featureResolver.ResolveAsync()).CanManageApplicants)
            return FailSummary(messageId, FeatureGateDeniedMessage);

        // Only the flags are needed to derive the stage.
        var flags = await Context.CourierApplicants.AsNoTracking()
            .Select(a => new { a.CourierId, a.TrainingCompleted, a.DeclarationAgree, a.EmailVerified, a.RejectDate })
            .ToListAsync();

        var counts = flags
            .Where(f => f.RejectDate == null)   // rejected applicants are not on the pipeline
            .GroupBy(f => DerivePipelineStage(new CourierApplicant
            {
                CourierId = f.CourierId,
                TrainingCompleted = f.TrainingCompleted,
                DeclarationAgree = f.DeclarationAgree,
                EmailVerified = f.EmailVerified,
            }))
            .Select(g => new NpPipelineSummaryDto { StageName = g.Key, Count = g.Count() })
            .ToList();

        return new NpPipelineSummaryResponse(messageId) { Success = true, Summary = counts };
    }

    // Materialises the full DTO list — derives the stage and joins document
    // types to the applicant's uploads.
    private async Task<List<NpApplicantDto>> BuildDtos(List<CourierApplicant> rows)
    {
        if (rows.Count == 0) return [];

        var docTypes = await Context.CourierApplicantDocuments.AsNoTracking()
            .Where(d => d.Active)
            .OrderBy(d => d.Name)
            .ToListAsync();

        var ids = rows.Select(r => r.Id).ToList();
        var uploads = await Context.CourierApplicantUploads.AsNoTracking()
            .Where(u => ids.Contains(u.ApplicantId))
            .ToListAsync();
        var uploadsByApplicant = uploads
            .GroupBy(u => u.ApplicantId)
            .ToDictionary(g => g.Key, g => g.ToList());

        return rows.Select(a => MapToDto(a, docTypes, uploadsByApplicant.GetValueOrDefault(a.Id) ?? [])).ToList();
    }

    private static NpApplicantDto MapToDto(
        CourierApplicant a,
        List<CourierApplicantDocument> docTypes,
        List<CourierApplicantUpload> uploads)
    {
        var documents = docTypes.Select(dt =>
        {
            var upload = uploads.FirstOrDefault(u => u.DocumentId == dt.Id);
            return new NpApplicantDocumentDto
            {
                DocumentTypeName = dt.Name ?? string.Empty,
                Category = string.Empty,   // legacy CourierApplicantDocument has no category
                Mandatory = dt.Mandatory,
                Status = upload is not null ? "uploaded" : "missing",
                FileName = upload?.FileName ?? string.Empty,
                UploadedDate = upload?.Created,
            };
        }).ToList();

        return new NpApplicantDto
        {
            Id = a.Id,
            RegionId = a.RegionId,
            Email = a.Email ?? string.Empty,
            FirstName = a.FirstName ?? string.Empty,
            LastName = a.Surname ?? string.Empty,
            Phone = a.Phone ?? a.Mobile ?? string.Empty,
            Address = a.Address ?? a.AddressLine1 ?? string.Empty,
            City = a.City ?? string.Empty,
            State = a.State ?? string.Empty,
            Postcode = a.PostCode ?? string.Empty,
            VehicleType = a.VehicleType ?? string.Empty,
            VehicleMake = a.VehicleMake ?? string.Empty,
            VehicleModel = a.VehicleModel ?? string.Empty,
            VehicleYear = a.VehicleYear,
            VehiclePlate = a.VehicleRegistrationNo ?? string.Empty,
            BankAccountName = a.BankAccountName ?? string.Empty,
            BankAccountNumber = a.BankAccountNo ?? string.Empty,
            BankBsb = a.BankBsb ?? string.Empty,
            NextOfKinName = a.NextOfKin ?? string.Empty,
            NextOfKinPhone = a.NextOfKinPhone ?? string.Empty,
            NextOfKinRelationship = a.NextOfKinRelationship ?? string.Empty,
            PipelineStage = DerivePipelineStage(a),
            DeclarationSigned = a.DeclarationAgree,
            DeclarationSignedDate = a.DeclarationDate,
            RejectedDate = a.RejectDate,
            RejectedReason = a.RejectReason ?? string.Empty,
            ApprovedAsCourierId = a.CourierId,
            CreatedDate = a.Created,
            ModifiedDate = a.ModifiedDate,
            Notes = a.Notes ?? string.Empty,
            Documents = documents,
        };
    }
}
