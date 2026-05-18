using System;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Compliance Profiles — document-requirement templates (ComplianceProfiles +
// ComplianceProfileRequirements + ComplianceProfileClient, migration 030).
// Tenant-wide configuration; not NP-scoped. Deactivate is a soft delete.
public class NpComplianceProfileService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseService(contextFactory)
{
    public async Task<NpComplianceProfilesResponse> GetAll(Guid messageId)
    {
        var rows = await Context.ComplianceProfiles.AsNoTracking()
            .OrderBy(p => p.Name)
            .Select(ProjectToDto)
            .ToListAsync();

        return new NpComplianceProfilesResponse(messageId) { Success = true, Profiles = rows };
    }

    public async Task<NpComplianceProfileResponse> CreateAsync(NpComplianceProfileUpsertDto dto, Guid messageId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return Fail(messageId, "Profile name is required.");

        var profile = new ComplianceProfile { Created = DateTime.UtcNow };
        ApplyScalars(profile, dto);
        Context.ComplianceProfiles.Add(profile);

        // Children added to the tracked nav collections — EF stamps the FK
        // once the profile gets its identity on SaveChanges.
        SyncRequirements(profile, dto);
        SyncClients(profile, dto);
        await Context.SaveChangesAsync();

        return await ReadOne(profile.Id, messageId);
    }

    public async Task<NpComplianceProfileResponse> UpdateAsync(int id, NpComplianceProfileUpsertDto dto, Guid messageId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return Fail(messageId, "Profile name is required.");

        var profile = await Context.ComplianceProfiles
            .Include(p => p.ComplianceProfileRequirements)
            .Include(p => p.ComplianceProfileClients)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (profile is null)
            return Fail(messageId, "Compliance profile not found.");

        ApplyScalars(profile, dto);
        profile.Modified = DateTime.UtcNow;
        SyncRequirements(profile, dto);
        SyncClients(profile, dto);
        await Context.SaveChangesAsync();

        return await ReadOne(id, messageId);
    }

    public async Task<NpComplianceProfileResponse> DeactivateAsync(int id, Guid messageId)
    {
        var profile = await Context.ComplianceProfiles.FirstOrDefaultAsync(p => p.Id == id);
        if (profile is null)
            return Fail(messageId, "Compliance profile not found.");

        profile.IsActive = false;
        profile.Modified = DateTime.UtcNow;
        await Context.SaveChangesAsync();

        return await ReadOne(id, messageId);
    }

    private async Task<NpComplianceProfileResponse> ReadOne(int id, Guid messageId)
    {
        var read = await Context.ComplianceProfiles.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(ProjectToDto)
            .FirstOrDefaultAsync();

        return new NpComplianceProfileResponse(messageId) { Success = true, Profile = read };
    }

    private static void ApplyScalars(ComplianceProfile p, NpComplianceProfileUpsertDto dto)
    {
        p.Name = dto.Name.Trim();
        p.Description = dto.Description;
        p.IsDefault = dto.IsDefault;
        p.IsActive = dto.Active;
    }

    // Reconcile requirement rows, keyed by DocumentTypeId (a profile holds at
    // most one requirement per document type). RemoveRange for deletes — see
    // the AgentCoverageArea note: removing from the nav collection makes EF
    // try to null the non-nullable FK.
    private void SyncRequirements(ComplianceProfile profile, NpComplianceProfileUpsertDto dto)
    {
        var desired = (dto.Requirements ?? Enumerable.Empty<NpComplianceRequirementUpsertDto>())
            .Where(r => r.DocumentTypeId > 0)
            .GroupBy(r => r.DocumentTypeId)
            .Select(g => g.First())
            .ToList();
        var desiredIds = desired.Select(r => r.DocumentTypeId).ToHashSet();

        var stale = profile.ComplianceProfileRequirements
            .Where(r => !desiredIds.Contains(r.DocumentTypeId))
            .ToList();
        if (stale.Count > 0)
            Context.ComplianceProfileRequirements.RemoveRange(stale);

        foreach (var d in desired)
        {
            // A stale row never matches here — its DocumentTypeId is not in desiredIds.
            var existing = profile.ComplianceProfileRequirements
                .FirstOrDefault(r => r.DocumentTypeId == d.DocumentTypeId);
            if (existing is not null)
            {
                existing.Mandatory = d.Mandatory;
                existing.SortOrder = d.SortOrder;
                existing.QuizRequired = d.QuizRequired;
                existing.QuizId = d.QuizId;
            }
            else
            {
                profile.ComplianceProfileRequirements.Add(new ComplianceProfileRequirement
                {
                    DocumentTypeId = d.DocumentTypeId,
                    Mandatory = d.Mandatory,
                    SortOrder = d.SortOrder,
                    QuizRequired = d.QuizRequired,
                    QuizId = d.QuizId,
                });
            }
        }
    }

    // Reconcile client-name tags (case-insensitive, de-duped).
    private void SyncClients(ComplianceProfile profile, NpComplianceProfileUpsertDto dto)
    {
        var desired = (dto.ClientNames ?? Enumerable.Empty<string>())
            .Select(s => (s ?? string.Empty).Trim())
            .Where(s => s.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var stale = profile.ComplianceProfileClients
            .Where(c => !desired.Contains(c.ClientName, StringComparer.OrdinalIgnoreCase))
            .ToList();
        if (stale.Count > 0)
            Context.ComplianceProfileClients.RemoveRange(stale);

        var existing = profile.ComplianceProfileClients
            .Select(c => c.ClientName)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var name in desired.Where(n => !existing.Contains(n)))
            profile.ComplianceProfileClients.Add(new ComplianceProfileClient { ClientName = name });
    }

    private static NpComplianceProfileResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new() { Message = message } },
    };

    private static readonly Expression<Func<ComplianceProfile, NpComplianceProfileDto>> ProjectToDto = p => new NpComplianceProfileDto
    {
        Id = p.Id,
        Name = p.Name ?? string.Empty,
        Description = p.Description ?? string.Empty,
        IsDefault = p.IsDefault,
        Active = p.IsActive,
        CreatedDate = p.Created,
        ModifiedDate = p.Modified,
        ClientNames = p.ComplianceProfileClients
            .OrderBy(c => c.ClientName)
            .Select(c => c.ClientName)
            .ToList(),
        Requirements = p.ComplianceProfileRequirements
            .OrderBy(r => r.SortOrder)
            .Select(r => new NpComplianceRequirementDto
            {
                Id = r.Id,
                ProfileId = r.ProfileId,
                DocumentTypeId = r.DocumentTypeId,
                DocumentTypeName = r.DocumentType.Name ?? string.Empty,
                Purpose = r.DocumentType.Purpose ?? "Compliance",
                Mandatory = r.Mandatory,
                SortOrder = r.SortOrder,
                QuizRequired = r.QuizRequired,
                QuizId = r.QuizId,
            })
            .ToList(),
    };
}
