using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

public class NpUserService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    INpScopeResolver scopeResolver,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    public async Task<NpUsersResponse> GetAll(Guid messageId)
    {
        // tblUser has no NpAgentId. Filter via the
        //   tblUser.StaffId → tucClientContact.StaffId → tucClient.NpAgentId
        // chain. Admins bypass; NP users with no linkage get an empty list.
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return new NpUsersResponse(messageId) { Success = true, Users = [] };
        }

        var query = Context.TblUsers.AsNoTracking();

        if (!scope.IsAdmin)
        {
            var allowedStaffIds = Context.TucClientContacts
                .Where(cc => cc.StaffId != null
                          && cc.UcctClient != null
                          && cc.UcctClient.NpAgentId == scope.NpAgentId!.Value)
                .Select(cc => cc.StaffId!.Value);

            query = query.Where(u => u.StaffId != null && allowedStaffIds.Contains(u.StaffId.Value));
        }

        var rows = await query
            .OrderByDescending(u => u.LastAccessed)
            .ThenBy(u => u.FullName)
            .ToListAsync();

        var users = rows.Select(MapToDto).ToList();

        return new NpUsersResponse(messageId)
        {
            Success = true,
            Users = users,
        };
    }

    public async Task<NpUserResponse> UpdateAsync(int staffId, NpUserUpdateDto dto, Guid messageId)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return Fail(messageId, "No NP scope configured for this user.");
        }

        // Same NP-scope guard as the read path: NP user can only edit users
        // whose tucClientContact links to a tucClient with their NpAgentId.
        if (!scope.IsAdmin)
        {
            var withinScope = await Context.TucClientContacts
                .AnyAsync(cc => cc.StaffId == staffId
                             && cc.UcctClient != null
                             && cc.UcctClient.NpAgentId == scope.NpAgentId!.Value);
            if (!withinScope)
            {
                return Fail(messageId, "User not found or outside your scope.");
            }
        }

        var user = await Context.TblUsers.FirstOrDefaultAsync(u => u.StaffId == staffId);
        if (user is null)
        {
            return Fail(messageId, "User not found or outside your scope.");
        }

        ApplyUpdate(user, dto);

        var actor = httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
                    ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
                    ?? "system";
        user.LastModified = DateTime.UtcNow;
        user.LastModifiedBy = actor;

        await Context.SaveChangesAsync();

        return new NpUserResponse(messageId)
        {
            Success = true,
            User = MapToDto(user),
        };
    }

    // tblUser.UserName is the PRIMARY KEY in the schema — EF refuses to
    // modify it on a tracked entity, and AdminManager doesn't expose email
    // edits either (changing it would require a delete+create cascade across
    // tucClientContact, tucStaff, tblUser, tblClientContact, and Master.User).
    // So we deliberately do NOT touch UserName here. The DTO carries the
    // current Email but we treat it as informational only.
    //
    // Role inverse-map: "Admin" → UserGroupId=1, anything else → 7 (Dispatcher).
    // Schema has more UserGroupId values; Phase 5+5 surfaces only the binary
    // admin/non-admin split. Existing users with other ids keep them unless
    // the dropdown explicitly sets Admin or Dispatcher.
    private static void ApplyUpdate(TblUser u, NpUserUpdateDto dto)
    {
        u.FullName = dto.Name;
        u.UserGroupId = dto.Role == "Admin" ? 1 : 7;
        u.Active = string.Equals(dto.Status, "active", StringComparison.OrdinalIgnoreCase);
    }

    private static NpUserResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
    };

    private static NpUserDto MapToDto(TblUser u) => new()
    {
        // StaffId is the canonical identity; fall back to UserName for users
        // without one (e.g., legacy seeded rows).
        Id = u.StaffId?.ToString() ?? u.UserName ?? string.Empty,
        Name = u.FullName ?? string.Empty,
        Email = u.UserName ?? string.Empty,
        Role = u.UserGroupId == 1 ? "Admin" : "Dispatcher",
        Status = u.Active ? "active" : "inactive",
        LastLogin = FormatRelative(u.LastAccessed),
    };

    private static string FormatRelative(DateTime? dt)
    {
        if (dt is null) return "never";
        var span = DateTime.UtcNow - dt.Value;
        if (span.TotalMinutes < 1) return "just now";
        if (span.TotalMinutes < 60) return $"{(int)span.TotalMinutes} min ago";
        if (span.TotalHours < 24) return $"{(int)span.TotalHours} hours ago";
        if (span.TotalDays < 30) return $"{(int)span.TotalDays} days ago";
        return dt.Value.ToString("yyyy-MM-dd");
    }
}
