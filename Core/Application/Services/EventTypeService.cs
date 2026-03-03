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
    public async Task<EventTypesResponse> GetAll(Guid messageId)
    {
        var types = await Context.TucEventTypes
            .OrderBy(e => e.UcetName)
            .Select(e => new EventTypeItemDto { Id = e.UcetId, Name = e.UcetName ?? "" })
            .ToListAsync();

        return new EventTypesResponse(messageId) { Success = true, EventTypes = types };
    }

    public async Task<EventTypesResponse> Search(SearchRequest request)
    {
        var query = Context.TucEventTypes.AsQueryable();

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
                    IsActive = m.IsActive
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
                IsActive = x.Mapping.IsActive
            })
            .ToListAsync();

        return new EventTypeGroupMappingsResponse(messageId) { Success = true, Mappings = mappings };
    }

    public async Task<BaseResponse> AddEventTypeGroup(int eventTypeId, int eventTypeGroupId, int sequence, Guid messageId)
    {
        var response = new BaseResponse(messageId);

        var existing = await Context.TucEventTypeEventTypeGroups
            .FirstOrDefaultAsync(m => m.EventTypeId == eventTypeId && m.EventTypeGroupId == eventTypeGroupId);

        if (existing != null)
        {
            existing.IsActive = true;
            existing.Sequence = sequence;
        }
        else
        {
            Context.TucEventTypeEventTypeGroups.Add(new TucEventTypeEventTypeGroup
            {
                EventTypeId = eventTypeId,
                EventTypeGroupId = eventTypeGroupId,
                Sequence = sequence,
                IsActive = true
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
}
