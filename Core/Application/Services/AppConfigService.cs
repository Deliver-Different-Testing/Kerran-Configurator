using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AdminManager.Core.Application.Dtos.AppConfig;
using AdminManager.Core.Application.Dtos.Common;
using AdminManager.Core.Application.Dtos.MobileConfig;
using AdminManager.Core.Application.Utilities;
using AdminManager.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;

namespace AdminManager.Core.Application.Services
{
    public class AppConfigService(IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseService(contextFactory)
    {
        public async Task<AppConfigsResponse> Search(AppConfigSearchRequest request)
        {
            var query = Context.AppConfigs.AsQueryable();

            if (!string.IsNullOrWhiteSpace(request.Category))
                query = query.Where(c => c.Category == request.Category);

            if (!string.IsNullOrWhiteSpace(request.SearchText))
                query = query.Where(c => EF.Functions.Like(
                    c.ConfigKey + " " + c.Description, $"%{request.SearchText}%"));

            return new AppConfigsResponse(request.MessageId)
            {
                Success = true,
                Configs = await query
                    .OrderBy(c => c.Category).ThenBy(c => c.ConfigKey)
                    .Select(c => MapToDto(c))
                    .ToListAsync()
            };
        }

        public async Task<AppConfigResponse> Get(IdRequest request)
        {
            var response = new AppConfigResponse(request.MessageId);

            var config = await Context.AppConfigs.FindAsync(request.Id);
            if (config == null)
                return ResponseUtility.AddMessageAndReturnResponse(response, "App config not found.");

            response.Config = MapToDto(config);
            response.Success = true;
            return response;
        }

        public async Task<AppConfigResponse> GetByKey(string key, Guid messageId)
        {
            var response = new AppConfigResponse(messageId);

            var config = await Context.AppConfigs.FirstOrDefaultAsync(c => c.ConfigKey == key);
            if (config == null)
                return ResponseUtility.AddMessageAndReturnResponse(response, "App config not found.");

            response.Config = MapToDto(config);
            response.Success = true;
            return response;
        }

        public async Task<AppConfigsResponse> Get(Guid messageId)
        {
            return new AppConfigsResponse(messageId)
            {
                Success = true,
                Configs = await Context.AppConfigs
                    .OrderBy(c => c.Category).ThenBy(c => c.ConfigKey)
                    .Select(c => MapToDto(c))
                    .ToListAsync()
            };
        }

        public async Task<AppConfigResponse> Create(AppConfigCreateRequest request)
        {
            var response = new AppConfigResponse(request.MessageId);

            if (await Context.AppConfigs.AnyAsync(c => c.ConfigKey == request.ConfigKey))
                return ResponseUtility.AddMessageAndReturnResponse(response, "A config with this key already exists.");

            var config = new Domain.Despatch.AppConfig
            {
                ConfigKey = request.ConfigKey,
                ConfigValue = request.ConfigValue,
                DataType = request.DataType,
                Category = request.Category,
                Description = request.Description,
                IsActive = true,
                Created = DateTime.UtcNow,
                CreatedBy = "admin" // TODO: pull from HttpContext session
            };

            Context.AppConfigs.Add(config);
            await Context.SaveChangesAsync();

            response.Config = MapToDto(config);
            response.Success = true;
            return response;
        }

        public async Task<AppConfigResponse> Update(AppConfigUpdateRequest request)
        {
            var response = new AppConfigResponse(request.MessageId);

            var config = await Context.AppConfigs.FindAsync(request.Id);
            if (config == null)
                return ResponseUtility.AddMessageAndReturnResponse(response, "App config not found.");

            if (await Context.AppConfigs.AnyAsync(c => c.ConfigKey == request.ConfigKey && c.Id != request.Id))
                return ResponseUtility.AddMessageAndReturnResponse(response, "A config with this key already exists.");

            config.ConfigKey = request.ConfigKey;
            config.ConfigValue = request.ConfigValue;
            config.DataType = request.DataType;
            config.Category = request.Category;
            config.Description = request.Description;
            config.LastModified = DateTime.UtcNow;
            config.LastModifiedBy = "admin"; // TODO: pull from HttpContext session

            await Context.SaveChangesAsync();

            response.Config = MapToDto(config);
            response.Success = true;
            return response;
        }

        public async Task<BaseResponse> Delete(IdRequest request)
        {
            var response = new BaseResponse(request.MessageId);

            var config = await Context.AppConfigs.FindAsync(request.Id);
            if (config == null)
                return ResponseUtility.AddMessageAndReturnResponse(response, "App config not found.");

            Context.AppConfigs.Remove(config);
            await Context.SaveChangesAsync();

            response.Success = true;
            return response;
        }

        /// <summary>
        /// Builds the mobile config response: feature flags + branding + support tasks.
        /// Called by DF Drive app at login.
        /// </summary>
        public async Task<MobileConfigResponse> GetMobileConfig(Guid messageId)
        {
            var response = new MobileConfigResponse(messageId);

            // Feature flags
            var featureConfigs = await Context.AppConfigs
                .Where(c => c.Category == "feature" && c.IsActive)
                .ToListAsync();

            foreach (var fc in featureConfigs)
            {
                // Strip "feature." prefix for the mobile key
                var key = fc.ConfigKey.StartsWith("feature.")
                    ? fc.ConfigKey["feature.".Length..]
                    : fc.ConfigKey;
                response.Features[key] = string.Equals(fc.ConfigValue, "true", StringComparison.OrdinalIgnoreCase);
            }

            // Branding
            var brandingConfigs = await Context.AppConfigs
                .Where(c => c.Category == "branding" && c.IsActive)
                .ToListAsync();

            foreach (var bc in brandingConfigs)
            {
                var key = bc.ConfigKey.StartsWith("branding.")
                    ? bc.ConfigKey["branding.".Length..]
                    : bc.ConfigKey;
                response.Branding[key] = bc.ConfigValue ?? "";
            }

            // Support tasks — event types in the "App Support" group
            var supportGroup = await Context.TucEventTypeGroups
                .FirstOrDefaultAsync(g => g.Name == "App Support" && g.IsActive);

            if (supportGroup != null)
            {
                response.SupportTasks = await Context.TucEventTypeEventTypeGroups
                    .Where(m => m.EventTypeGroupId == supportGroup.Id && m.IsActive)
                    .OrderBy(m => m.Sequence)
                    .Select(m => new MobileTaskDto
                    {
                        EventTypeId = m.EventTypeId,
                        Name = m.EventType.UcetName ?? ""
                    })
                    .ToListAsync();
            }

            response.Success = true;
            return response;
        }

        private static AppConfigDto MapToDto(Domain.Despatch.AppConfig c) => new()
        {
            Id = c.Id,
            ConfigKey = c.ConfigKey,
            ConfigValue = c.ConfigValue,
            DataType = c.DataType,
            Category = c.Category,
            Description = c.Description,
            IsActive = c.IsActive,
            Created = c.Created,
            CreatedBy = c.CreatedBy,
            LastModified = c.LastModified,
            LastModifiedBy = c.LastModifiedBy
        };
    }
}
