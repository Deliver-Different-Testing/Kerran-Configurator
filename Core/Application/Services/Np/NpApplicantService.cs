using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Recruitment pipeline — read side. Applicants are the legacy courierportal
// CourierApplicant table. pipelineStage is DERIVED from the legacy flags
// (the legacy model is flag-based, not stage-based — see migration 031).
// Tenant-wide; not NP-scoped. Mutating actions (advance / approve / reject)
// are a later slice.
public class NpApplicantService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseService(contextFactory)
{
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
        var rows = await Context.CourierApplicants.AsNoTracking()
            .OrderByDescending(a => a.Created)
            .ToListAsync();

        var applicants = await BuildDtos(rows);
        return new NpApplicantsResponse(messageId) { Success = true, Applicants = applicants };
    }

    public async Task<NpApplicantResponse> GetById(int id, Guid messageId)
    {
        var row = await Context.CourierApplicants.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id);
        if (row is null)
            return new NpApplicantResponse(messageId)
            {
                Success = false,
                Messages = { new() { Message = "Applicant not found." } },
            };

        var dtos = await BuildDtos([row]);
        return new NpApplicantResponse(messageId) { Success = true, Applicant = dtos.FirstOrDefault() };
    }

    public async Task<NpPipelineSummaryResponse> GetPipelineSummary(Guid messageId)
    {
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
