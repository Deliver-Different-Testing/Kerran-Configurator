using System;
using System.IO;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Common;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Document Types — tenant-wide compliance/training document configuration
// (DocumentTypes table, migration 030). NOT NP-scoped: document types are
// shared tenant settings, so every NP user and admin sees the same set.
// Deactivate is a soft delete (IsActive = false) — ComplianceProfileRequirements
// may reference a type, so rows are never hard-deleted from here.
//
// Template upload/download: a DocumentType can carry a blank template file
// (e.g. a fillable inspection form) stored in S3. Reuses the same
// compliance-uploads bucket as courier documents (via IS3StorageService),
// under key prefix tenant-{tenantId}/templates/doctype-{id}/{uuid}.{ext}.
public class NpDocumentTypeService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IS3StorageService storage,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
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

    // ─── TEMPLATE upload / download / remove ─────────────────────────────

    public async Task<NpDocumentTypeResponse> UploadTemplateAsync(
        int id, Stream content, string fileName, string contentType, long length, Guid messageId, CancellationToken ct = default)
    {
        if (content is null || length <= 0)        return Fail(messageId, "Empty template upload.");
        if (string.IsNullOrWhiteSpace(fileName))   return Fail(messageId, "FileName is required.");
        if (string.IsNullOrWhiteSpace(contentType)) contentType = "application/octet-stream";

        var entity = await Context.DocumentTypes.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (entity is null) return Fail(messageId, "Document type not found.");

        var oldKey = entity.TemplateS3key;  // capture for cleanup if replacing

        var tenantId = ResolveTenantId();
        var ext = NormaliseExtension(Path.GetExtension(fileName));
        var key = $"tenant-{tenantId}/templates/doctype-{id}/{Guid.NewGuid():N}{ext}";

        try
        {
            await storage.PutAsync(content, key, contentType, ct);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "S3 PUT failed for document-type {Id} template upload (key {Key})", id, key);
            return Fail(messageId, "Upload to storage failed. The template was not saved.");
        }

        entity.HasTemplate = true;
        entity.TemplateFileName = fileName;
        entity.TemplateMimeType = contentType;
        entity.TemplateS3key = key;
        entity.ModifiedDate = DateTime.UtcNow;

        try
        {
            await Context.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "DB update failed after template S3 PUT — compensating delete of {Key}", key);
            try { await storage.DeleteAsync(key, ct); } catch (Exception cleanupEx) { Log.Warning(cleanupEx, "Compensating S3 DELETE failed for {Key}", key); }
            return Fail(messageId, "Could not save template metadata.");
        }

        // Replaced an existing template — best-effort delete of the old object.
        if (!string.IsNullOrEmpty(oldKey) && oldKey != key)
        {
            try { await storage.DeleteAsync(oldKey, ct); }
            catch (Exception ex) { Log.Warning(ex, "Failed to delete superseded template object {Key} (orphan left in bucket)", oldKey); }
        }

        return await ReadOne(id, messageId);
    }

    public async Task<TemplateDownloadResult?> GetTemplateForDownloadAsync(int id, CancellationToken ct = default)
    {
        var entity = await Context.DocumentTypes.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id, ct);
        if (entity is null || !entity.HasTemplate || string.IsNullOrEmpty(entity.TemplateS3key)) return null;

        var s3 = await storage.GetAsync(entity.TemplateS3key, ct);
        if (s3 is null)
        {
            Log.Warning("S3 template object missing for DocumentType {Id} (key {Key})", id, entity.TemplateS3key);
            return null;
        }

        return new TemplateDownloadResult(
            s3.Content,
            string.IsNullOrEmpty(entity.TemplateMimeType) ? "application/octet-stream" : entity.TemplateMimeType,
            string.IsNullOrEmpty(entity.TemplateFileName) ? $"template-{id}" : entity.TemplateFileName);
    }

    public async Task<NpDocumentTypeResponse> RemoveTemplateAsync(int id, Guid messageId, CancellationToken ct = default)
    {
        var entity = await Context.DocumentTypes.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (entity is null) return Fail(messageId, "Document type not found.");

        var key = entity.TemplateS3key;

        entity.HasTemplate = false;
        entity.TemplateFileName = null;
        entity.TemplateMimeType = null;
        entity.TemplateS3key = null;
        entity.ModifiedDate = DateTime.UtcNow;
        await Context.SaveChangesAsync(ct);

        if (!string.IsNullOrEmpty(key))
        {
            try { await storage.DeleteAsync(key, ct); }
            catch (Exception ex) { Log.Warning(ex, "Failed to delete template object {Key} on remove (orphan left in bucket)", key); }
        }

        return await ReadOne(id, messageId);
    }

    private string ResolveTenantId() =>
        httpContextAccessor.HttpContext?.User.FindFirst("CurrentTenantID")?.Value ?? "unknown";

    private static string NormaliseExtension(string? ext)
    {
        if (string.IsNullOrWhiteSpace(ext)) return string.Empty;
        ext = ext.Trim();
        if (!ext.StartsWith(".")) ext = "." + ext;
        var clean = new string(ext.Where(c => c == '.' || char.IsLetterOrDigit(c)).ToArray());
        return clean.Length > 10 ? clean.Substring(0, 10) : clean;
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
        e.ReviewCriteria = dto.ReviewCriteria;
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
        ReviewCriteria = d.ReviewCriteria ?? string.Empty,
        HasTemplate = d.HasTemplate,
        TemplateFileName = d.TemplateFileName ?? string.Empty,
        TemplateMimeType = d.TemplateMimeType ?? string.Empty,
        CreatedDate = d.CreatedDate,
        ModifiedDate = d.ModifiedDate,
    };
}

/// <summary>
/// Output of <see cref="NpDocumentTypeService.GetTemplateForDownloadAsync"/>.
/// Content is the live S3 response stream; ASP.NET Core's File() helper
/// disposes it after streaming.
/// </summary>
public sealed record TemplateDownloadResult(Stream Content, string ContentType, string FileName);
