using System;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Document Types — tenant-wide compliance/training document configuration
// (DocumentTypes table, migration 030). NOT NP-scoped: document types are
// shared tenant settings, so every NP user and admin sees the same set.
// Deactivate is a soft delete (IsActive = false) — ComplianceProfileRequirements
// may reference a type, so rows are never hard-deleted from here.
public class NpDocumentTypeService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseService(contextFactory)
{
    public async Task<NpDocumentTypesResponse> GetAll(Guid messageId)
    {
        var rows = await Context.DocumentTypes.AsNoTracking()
            .OrderBy(d => d.SortOrder)
            .ThenBy(d => d.Name)
            .Select(ProjectToDto)
            .ToListAsync();

        return new NpDocumentTypesResponse(messageId) { Success = true, DocumentTypes = rows };
    }

    public async Task<NpDocumentTypeResponse> CreateAsync(NpDocumentTypeUpsertDto dto, Guid messageId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return Fail(messageId, "Document type name is required.");

        var entity = new DocumentType { CreatedDate = DateTime.UtcNow };
        ApplyUpsert(entity, dto);

        Context.DocumentTypes.Add(entity);
        await Context.SaveChangesAsync();

        return await ReadOne(entity.Id, messageId);
    }

    public async Task<NpDocumentTypeResponse> UpdateAsync(int id, NpDocumentTypeUpsertDto dto, Guid messageId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return Fail(messageId, "Document type name is required.");

        var entity = await Context.DocumentTypes.FirstOrDefaultAsync(d => d.Id == id);
        if (entity is null)
            return Fail(messageId, "Document type not found.");

        ApplyUpsert(entity, dto);
        entity.ModifiedDate = DateTime.UtcNow;
        await Context.SaveChangesAsync();

        return await ReadOne(id, messageId);
    }

    public async Task<NpDocumentTypeResponse> DeactivateAsync(int id, Guid messageId)
    {
        var entity = await Context.DocumentTypes.FirstOrDefaultAsync(d => d.Id == id);
        if (entity is null)
            return Fail(messageId, "Document type not found.");

        entity.IsActive = false;
        entity.ModifiedDate = DateTime.UtcNow;
        await Context.SaveChangesAsync();

        return await ReadOne(id, messageId);
    }

    private async Task<NpDocumentTypeResponse> ReadOne(int id, Guid messageId)
    {
        var read = await Context.DocumentTypes.AsNoTracking()
            .Where(d => d.Id == id)
            .Select(ProjectToDto)
            .FirstOrDefaultAsync();

        return new NpDocumentTypeResponse(messageId) { Success = true, DocumentType = read };
    }

    private static NpDocumentTypeResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new() { Message = message } },
    };

    private static void ApplyUpsert(DocumentType e, NpDocumentTypeUpsertDto dto)
    {
        e.Name = dto.Name.Trim();
        e.Instructions = dto.Instructions;
        e.Category = string.IsNullOrWhiteSpace(dto.Category) ? "Other" : dto.Category;
        e.Mandatory = dto.Mandatory;
        e.IsActive = dto.Active;
        e.HasExpiry = dto.HasExpiry;
        e.ExpiryWarningDays = dto.ExpiryWarningDays;
        e.BlockOnExpiry = dto.BlockOnExpiry;
        e.AppliesTo = string.IsNullOrWhiteSpace(dto.AppliesTo) ? "Both" : dto.AppliesTo;
        e.SortOrder = dto.SortOrder;
        e.Purpose = string.IsNullOrWhiteSpace(dto.Purpose) ? "Compliance" : dto.Purpose;
        // Training-purpose fields — only meaningful when Purpose == "Training",
        // but stored regardless; the UI gates them on purpose.
        e.ContentUrl = dto.ContentUrl;
        e.EstimatedMinutes = dto.EstimatedMinutes;
        e.QuizRequired = dto.QuizRequired;
    }

    private static readonly Expression<Func<DocumentType, NpDocumentTypeDto>> ProjectToDto = d => new NpDocumentTypeDto
    {
        Id = d.Id,
        Name = d.Name ?? string.Empty,
        Instructions = d.Instructions ?? string.Empty,
        Category = d.Category ?? "Other",
        Mandatory = d.Mandatory,
        Active = d.IsActive,
        HasExpiry = d.HasExpiry,
        ExpiryWarningDays = d.ExpiryWarningDays,
        BlockOnExpiry = d.BlockOnExpiry,
        AppliesTo = d.AppliesTo ?? "Both",
        SortOrder = d.SortOrder,
        Purpose = d.Purpose ?? "Compliance",
        ContentUrl = d.ContentUrl ?? string.Empty,
        EstimatedMinutes = d.EstimatedMinutes,
        QuizRequired = d.QuizRequired,
        HasTemplate = d.HasTemplate,
        TemplateFileName = d.TemplateFileName ?? string.Empty,
        TemplateMimeType = d.TemplateMimeType ?? string.Empty,
        CreatedDate = d.CreatedDate,
        ModifiedDate = d.ModifiedDate,
    };
}
