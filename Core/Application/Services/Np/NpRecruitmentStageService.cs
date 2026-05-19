using System;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Recruitment Stages — configurable courier-recruitment pipeline stages
// (RecruitmentStages table, migration 031). Tenant-wide config; not NP-scoped.
// Delete is a hard delete (stages are config; the Enabled flag is the soft
// toggle). SeedDefaults restores any missing standard stages, non-destructively.
public class NpRecruitmentStageService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseService(contextFactory)
{
    // The standard pipeline — matches the React ApplicantPipelineStage union.
    private static readonly (string Name, string Description)[] DefaultStages =
    [
        ("Registration",         "Applicant creates an account."),
        ("Email Verification",   "Applicant confirms their email address."),
        ("Profile",              "Applicant completes personal, vehicle and bank details."),
        ("Documentation",        "Applicant uploads the required documents."),
        ("Declaration/Contract", "Applicant signs the declaration / contract."),
        ("Training",             "Applicant completes onboarding training."),
        ("Approval",             "Application is reviewed and approved to courier."),
    ];

    public async Task<NpRecruitmentStagesResponse> GetAll(Guid messageId)
    {
        var rows = await Context.RecruitmentStages.AsNoTracking()
            .OrderBy(s => s.SortOrder)
            .ThenBy(s => s.StageName)
            .Select(ProjectToDto)
            .ToListAsync();

        return new NpRecruitmentStagesResponse(messageId) { Success = true, Stages = rows };
    }

    public async Task<NpRecruitmentStageResponse> CreateAsync(NpRecruitmentStageUpsertDto dto, Guid messageId)
    {
        if (string.IsNullOrWhiteSpace(dto.StageName))
            return Fail(messageId, "Stage name is required.");

        var entity = new RecruitmentStage { CreatedDate = DateTime.UtcNow };
        ApplyUpsert(entity, dto);
        Context.RecruitmentStages.Add(entity);
        await Context.SaveChangesAsync();

        return await ReadOne(entity.Id, messageId);
    }

    public async Task<NpRecruitmentStageResponse> UpdateAsync(int id, NpRecruitmentStageUpsertDto dto, Guid messageId)
    {
        if (string.IsNullOrWhiteSpace(dto.StageName))
            return Fail(messageId, "Stage name is required.");

        var entity = await Context.RecruitmentStages.FirstOrDefaultAsync(s => s.Id == id);
        if (entity is null)
            return Fail(messageId, "Recruitment stage not found.");

        ApplyUpsert(entity, dto);
        await Context.SaveChangesAsync();

        return await ReadOne(id, messageId);
    }

    public async Task<NpRecruitmentStageResponse> DeleteAsync(int id, Guid messageId)
    {
        var entity = await Context.RecruitmentStages.FirstOrDefaultAsync(s => s.Id == id);
        if (entity is null)
            return Fail(messageId, "Recruitment stage not found.");

        Context.RecruitmentStages.Remove(entity);
        await Context.SaveChangesAsync();

        return new NpRecruitmentStageResponse(messageId) { Success = true };
    }

    // Restores any standard stages that are missing (matched by name), without
    // touching stages that already exist — so edits/customisations survive.
    public async Task<NpRecruitmentStagesResponse> SeedDefaultsAsync(Guid messageId)
    {
        var existing = await Context.RecruitmentStages
            .Select(s => s.StageName)
            .ToListAsync();
        var have = existing
            .Where(n => n != null)
            .Select(n => n!.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        for (var i = 0; i < DefaultStages.Length; i++)
        {
            var (name, description) = DefaultStages[i];
            if (have.Contains(name)) continue;
            Context.RecruitmentStages.Add(new RecruitmentStage
            {
                StageName = name,
                Description = description,
                SortOrder = i + 1,
                Enabled = true,
                Mandatory = false,
                CreatedDate = DateTime.UtcNow,
            });
        }

        await Context.SaveChangesAsync();
        return await GetAll(messageId);
    }

    private async Task<NpRecruitmentStageResponse> ReadOne(int id, Guid messageId)
    {
        var read = await Context.RecruitmentStages.AsNoTracking()
            .Where(s => s.Id == id)
            .Select(ProjectToDto)
            .FirstOrDefaultAsync();

        return new NpRecruitmentStageResponse(messageId) { Success = true, Stage = read };
    }

    private static NpRecruitmentStageResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new() { Message = message } },
    };

    private static void ApplyUpsert(RecruitmentStage e, NpRecruitmentStageUpsertDto dto)
    {
        e.StageName = dto.StageName.Trim();
        e.SortOrder = dto.SortOrder;
        e.Enabled = dto.Enabled;
        e.Mandatory = dto.Mandatory;
        e.Description = dto.Description;
    }

    private static readonly Expression<Func<RecruitmentStage, NpRecruitmentStageDto>> ProjectToDto = s => new NpRecruitmentStageDto
    {
        Id = s.Id,
        StageName = s.StageName ?? string.Empty,
        SortOrder = s.SortOrder,
        Enabled = s.Enabled,
        Mandatory = s.Mandatory,
        Description = s.Description ?? string.Empty,
        CreatedDate = s.CreatedDate,
    };
}
