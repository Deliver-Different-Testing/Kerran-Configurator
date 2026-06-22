using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Utilities;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services;

public class EventTypeService(IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseService(contextFactory)
{
    public async Task<EventTypesResponse> GetAll(Guid messageId, string? group = null)
    {
        var query = Context.TucEventTypes.AsQueryable();

        if (!string.IsNullOrWhiteSpace(group))
            query = query.Where(e => e.UcetGroup == group);

        var types = await query
            .OrderBy(e => e.UcetName)
            .Select(e => new EventTypeItemDto { Id = e.UcetId, Name = e.UcetName ?? "" })
            .ToListAsync();

        return new EventTypesResponse(messageId) { Success = true, EventTypes = types };
    }

    public async Task<EventTypesResponse> Search(SearchRequest request, string? group = null)
    {
        var query = Context.TucEventTypes.AsQueryable();

        if (!string.IsNullOrWhiteSpace(group))
            query = query.Where(e => e.UcetGroup == group);

        if (!string.IsNullOrWhiteSpace(request.SearchText))
            query = query.Where(e => EF.Functions.Like(e.UcetName, $"%{request.SearchText}%"));

        var types = await query
            .OrderBy(e => e.UcetName)
            .Select(e => new EventTypeItemDto { Id = e.UcetId, Name = e.UcetName ?? "" })
            .ToListAsync();

        return new EventTypesResponse(request.MessageId) { Success = true, EventTypes = types };
    }

    public async Task<EventTypeGroupMappingsResponse> GetEventTypeGroups(int eventTypeId, Guid messageId)
    {
        var mappings = await Context.TucEventTypeEventTypeGroups
            .Include(m => m.EventType)
            .Where(m => m.EventTypeId == eventTypeId)
            .Join(Context.TucEventTypeGroups,
                m => m.EventTypeGroupId,
                g => g.Id,
                (m, g) => new EventTypeGroupMappingItemDto
                {
                    Id = m.Id,
                    EventTypeId = m.EventTypeId,
                    EventTypeGroupId = m.EventTypeGroupId,
                    EventTypeName = m.EventType.UcetName ?? "",
                    GroupName = g.Name ?? "",
                    Sequence = m.Sequence,
                    IsActive = m.IsActive,
                    Kind = m.Kind ?? "form",
                    Url = m.Url,
                    DisplayName = m.DisplayName,
                    Description = m.Description,
                    Icon = m.Icon,
                    Color = m.Color
                })
            .ToListAsync();

        return new EventTypeGroupMappingsResponse(messageId) { Success = true, Mappings = mappings };
    }

    public async Task<EventTypeGroupMappingsResponse> GetEventTypesByGroup(string groupName, Guid messageId)
    {
        var mappings = await Context.TucEventTypeEventTypeGroups
            .Include(m => m.EventType)
            .Join(Context.TucEventTypeGroups,
                m => m.EventTypeGroupId,
                g => g.Id,
                (m, g) => new { Mapping = m, Group = g })
            .Where(x => x.Group.Name == groupName)
            .OrderBy(x => x.Mapping.Sequence)
            .Select(x => new EventTypeGroupMappingItemDto
            {
                Id = x.Mapping.Id,
                EventTypeId = x.Mapping.EventTypeId,
                EventTypeGroupId = x.Mapping.EventTypeGroupId,
                EventTypeName = x.Mapping.EventType.UcetName ?? "",
                GroupName = x.Group.Name ?? "",
                Sequence = x.Mapping.Sequence,
                IsActive = x.Mapping.IsActive,
                Kind = x.Mapping.Kind ?? "form",
                Url = x.Mapping.Url,
                DisplayName = x.Mapping.DisplayName,
                Description = x.Mapping.Description,
                Icon = x.Mapping.Icon,
                Color = x.Mapping.Color
            })
            .ToListAsync();

        return new EventTypeGroupMappingsResponse(messageId) { Success = true, Mappings = mappings };
    }

    public async Task<BaseResponse> AddEventTypeGroup(int eventTypeId, AddEventTypeGroupRequest request, Guid messageId)
    {
        var response = new BaseResponse(messageId);

        var existing = await Context.TucEventTypeEventTypeGroups
            .FirstOrDefaultAsync(m => m.EventTypeId == eventTypeId && m.EventTypeGroupId == request.EventTypeGroupId);

        if (existing != null)
        {
            existing.IsActive = true;
            existing.Sequence = request.Sequence;
            existing.Kind = request.Kind;
            existing.Url = request.Url;
            existing.DisplayName = request.DisplayName;
            existing.Description = request.Description;
            existing.Icon = request.Icon;
            existing.Color = request.Color;
        }
        else
        {
            Context.TucEventTypeEventTypeGroups.Add(new TucEventTypeEventTypeGroup
            {
                EventTypeId = eventTypeId,
                EventTypeGroupId = request.EventTypeGroupId,
                Sequence = request.Sequence,
                IsActive = true,
                Kind = request.Kind,
                Url = request.Url,
                DisplayName = request.DisplayName,
                Description = request.Description,
                Icon = request.Icon,
                Color = request.Color
            });
        }

        await Context.SaveChangesAsync();
        response.Success = true;
        return response;
    }

    public async Task<BaseResponse> DeleteEventTypeGroup(int eventTypeId, int mappingId, Guid messageId)
    {
        var response = new BaseResponse(messageId);

        var mapping = await Context.TucEventTypeEventTypeGroups
            .FirstOrDefaultAsync(m => m.Id == mappingId && m.EventTypeId == eventTypeId);

        if (mapping == null)
            return ResponseUtility.AddMessageAndReturnResponse(response, "Mapping not found.");

        Context.TucEventTypeEventTypeGroups.Remove(mapping);
        await Context.SaveChangesAsync();

        response.Success = true;
        return response;
    }

    // ── §14: tucEventType catalogue CRUD (e.g. the 'CE' courier-comms types) ──

    public async Task<EventTypeCatalogResponse> GetCatalog(Guid messageId, string? group = null)
    {
        var query = Context.TucEventTypes.AsQueryable();
        if (!string.IsNullOrWhiteSpace(group))
            query = query.Where(e => e.UcetGroup == group);

        var items = await query
            .OrderBy(e => e.UcetGroup).ThenBy(e => e.UcetName)
            .Select(e => new EventTypeCatalogItemDto { Id = e.UcetId, Name = e.UcetName ?? "", Group = e.UcetGroup ?? "" })
            .ToListAsync();

        return new EventTypeCatalogResponse(messageId) { Success = true, Items = items };
    }

    public async Task<EventTypeCatalogItemResponse> CreateCatalogItem(string name, string group, Guid messageId)
    {
        var response = new EventTypeCatalogItemResponse(messageId);
        if (string.IsNullOrWhiteSpace(name)) return ResponseUtility.AddMessageAndReturnResponse(response, "Name is required.");
        if (string.IsNullOrWhiteSpace(group)) return ResponseUtility.AddMessageAndReturnResponse(response, "Group is required.");

        var et = new TucEventType { UcetName = name.Trim(), UcetGroup = group.Trim() };
        Context.TucEventTypes.Add(et);
        await Context.SaveChangesAsync();

        response.Success = true;
        response.Item = new EventTypeCatalogItemDto { Id = et.UcetId, Name = et.UcetName ?? "", Group = et.UcetGroup ?? "" };
        return response;
    }

    public async Task<EventTypeCatalogItemResponse> UpdateCatalogItem(int id, string name, string group, Guid messageId)
    {
        var response = new EventTypeCatalogItemResponse(messageId);
        if (string.IsNullOrWhiteSpace(name)) return ResponseUtility.AddMessageAndReturnResponse(response, "Name is required.");
        if (string.IsNullOrWhiteSpace(group)) return ResponseUtility.AddMessageAndReturnResponse(response, "Group is required.");

        var et = await Context.TucEventTypes.FirstOrDefaultAsync(e => e.UcetId == id);
        if (et == null) return ResponseUtility.AddMessageAndReturnResponse(response, "Event type not found.");

        et.UcetName = name.Trim();
        et.UcetGroup = group.Trim();
        await Context.SaveChangesAsync();

        response.Success = true;
        response.Item = new EventTypeCatalogItemDto { Id = et.UcetId, Name = et.UcetName ?? "", Group = et.UcetGroup ?? "" };
        return response;
    }
}

// DTOs
public class EventTypeItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

public class EventTypesResponse : BaseResponse
{
    public EventTypesResponse(Guid messageId) : base(messageId) { }
    public List<EventTypeItemDto> EventTypes { get; set; } = [];
}

public class EventTypeGroupMappingItemDto
{
    public int Id { get; set; }
    public int EventTypeId { get; set; }
    public int EventTypeGroupId { get; set; }
    public string EventTypeName { get; set; } = "";
    public string GroupName { get; set; } = "";
    public int Sequence { get; set; }
    public bool IsActive { get; set; }
    public string Kind { get; set; } = "form";
    public string? Url { get; set; }
    public string? DisplayName { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
}

public class EventTypeGroupMappingsResponse : BaseResponse
{
    public EventTypeGroupMappingsResponse(Guid messageId) : base(messageId) { }
    public List<EventTypeGroupMappingItemDto> Mappings { get; set; } = [];
}

public class AddEventTypeGroupRequest : BaseRequest
{
    public int EventTypeGroupId { get; set; }
    public int Sequence { get; set; }
    public string Kind { get; set; } = "form";
    public string? Url { get; set; }
    public string? DisplayName { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
}

// §14: tucEventType catalogue item (id + name + group code).
public class EventTypeCatalogItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Group { get; set; } = "";
}

public class EventTypeCatalogResponse : BaseResponse
{
    public EventTypeCatalogResponse(Guid messageId) : base(messageId) { }
    public List<EventTypeCatalogItemDto> Items { get; set; } = [];
}

public class EventTypeCatalogItemResponse : BaseResponse
{
    public EventTypeCatalogItemResponse(Guid messageId) : base(messageId) { }
    public EventTypeCatalogItemDto? Item { get; set; }
}

// §14: request body for create/update of a tucEventType catalogue row.
public class EventTypeCatalogRequest
{
    public string Name { get; set; } = "";
    public string Group { get; set; } = "";
}
