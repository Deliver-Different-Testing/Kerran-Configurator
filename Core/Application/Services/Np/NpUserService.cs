using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Common;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Phase 5+28b §B.2 — switched source from tblUser to tucClientContact so
// newly-invited users (who haven't yet been linked to a staff identity)
// appear in the team list with status="Pending invite". Role lives on
// tucClientContact.ContactRoleId, NOT tblUser.UserGroupId — the previous
// UpdateAsync was conflating "NpAdmin" with "DF Admin" (UserGroupId=1),
// which would have let an NP user accidentally elevate themselves to
// platform-admin via the Edit dropdown. Fixed: role goes only to
// ContactRoleId; UserGroupId is never touched from this surface.
public class NpUserService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    INpScopeResolver scopeResolver,
    INpUserInviteService npUserInviteService,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    // ── Role name ↔ ContactRoleId mapping (matches NpRole enum) ────────
    private const int RoleIdAdmin      = 1;
    private const int RoleIdDispatcher = 2;
    private const int RoleIdReadOnly   = 3;

    private static int? MapRoleNameToId(string? roleName) => (roleName ?? string.Empty).Trim() switch
    {
        "Admin"      => RoleIdAdmin,
        "Dispatcher" => RoleIdDispatcher,
        "Read-Only"  => RoleIdReadOnly,
        ""           => null,
        _            => null,
    };

    private static string MapRoleIdToName(int? roleId) => roleId switch
    {
        RoleIdAdmin      => "Admin",
        RoleIdDispatcher => "Dispatcher",
        RoleIdReadOnly   => "Read-Only",
        _                => "Dispatcher",  // safest default for unknown / null
    };

    public async Task<NpUsersResponse> GetAll(Guid messageId)
    {
        // Source: tucClientContact (not tblUser). Filter via the
        //   tucClientContact.UcctClientId → tucClient.NpAgentId
        // chain. Admins bypass; NP users with no linkage get empty.
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return new NpUsersResponse(messageId) { Success = true, Users = [] };
        }

        var query = Context.TucClientContacts.AsNoTracking()
            .Where(cc => cc.UcctClient != null);

        if (!scope.IsAdmin)
        {
            query = query.Where(cc => cc.UcctClient!.NpAgentId == scope.NpAgentId!.Value);
        }

        var rows = await query
            .OrderByDescending(cc => cc.LastAccessed)
            .ThenBy(cc => cc.UcctSurname)
            .ThenBy(cc => cc.UcctFirstname)
            .ToListAsync();

        var users = rows.Select(MapToDto).ToList();

        return new NpUsersResponse(messageId)
        {
            Success = true,
            Users = users,
        };
    }

    // Phase 5+28b §B.2 — Add User from the NP team page. Creates a
    // tucClientContact under the caller's tucClient + dispatches the Hub
    // invite cascade. Does NOT create a tucStaff/tblUser bridge — the user
    // can log in via Hub identity + tucClientContact.UserName=email, and
    // they appear in the list immediately because GetAll sources from
    // tucClientContact. Their tblUser linkage (StaffID) lights up later
    // through a separate provisioning slice if/when ops needs the legacy
    // staff-identity machinery.
    public async Task<NpUserResponse> CreateAsync(NpUserCreateDto dto, Guid messageId)
    {
        if (string.IsNullOrWhiteSpace(dto.Email))
            return Fail(messageId, "Email is required.");
        if (string.IsNullOrWhiteSpace(dto.Name))
            return Fail(messageId, "Full name is required.");

        var contactRoleId = MapRoleNameToId(dto.Role);
        if (contactRoleId is null)
            return Fail(messageId, $"Unknown role '{dto.Role}'. Use Admin / Dispatcher / Read-Only.");

        // Resolve the caller's tucClient — that's the parent for the new
        // tucClientContact row. ClientID claim is the canonical source
        // (Hub-emitted at login from FetchUserByUsername). DF Admins
        // adding users to a tenant they don't belong to need to do so via
        // the tenant-level surface (separate slice).
        var clientClaim = httpContextAccessor.HttpContext?.User.FindFirst("ClientID")?.Value;
        if (!int.TryParse(clientClaim, out var clientId) || clientId <= 0)
            return Fail(messageId, "ClientID claim missing — can't resolve your NP. Re-login or contact a DF Admin.");

        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
            return Fail(messageId, "Your account has no NP linkage — can't add team members.");

        var email = dto.Email.Trim();

        // Uniqueness check across both UcctEmail and UserName — Hub login
        // uses UserName as the key, but we should also block dup emails so
        // ops don't end up with two contacts that look identical in the list.
        var emailTaken = await Context.TucClientContacts.AsNoTracking()
            .AnyAsync(cc => cc.UcctEmail == email || cc.UserName == email);
        if (emailTaken)
            return Fail(messageId, $"A contact with email '{email}' already exists in this tenant.");

        var (firstname, surname) = SplitContactName(dto.Name);
        var actor = ResolveActor();
        var now = DateTime.UtcNow;

        var contact = new TucClientContact
        {
            UcctClientId = clientId,
            UcctEmail = email,
            UserName = email,                  // Hub login key — must match Master.User.Email
            UcctFirstname = firstname,
            UcctSurname = surname,
            ContactRoleId = contactRoleId,
            HasEmail = true,
            ValidatedEmail = false,
            Active = true,
            AllowCookieLogin = true,           // required for shared-cookie flow
            StaffId = null,                    // no DF staff linkage yet
            Created = now,
            CreatedBy = actor,
            LastModified = now,
            LastModifiedBy = actor,
        };

        Context.TucClientContacts.Add(contact);
        await Context.SaveChangesAsync();

        // Hub invite cascade — non-atomic; tenant row stays committed if
        // Hub step fails (per brief corrections #2 — surface partial state,
        // don't roll back).
        var invite = await npUserInviteService.InviteAsync(email);

        var response = new NpUserResponse(messageId)
        {
            Success = true,
            User = MapToDto(contact),
        };

        if (invite.FullySucceeded)
        {
            response.Messages.Add(new MessageDto
            {
                Message = $"Invite sent to {email}. They'll receive an email to set their password."
            });
        }
        else if (invite.PartialSuccess)
        {
            response.Messages.Add(new MessageDto
            {
                Message = $"User added (Hub id {invite.HubUserId}) but the invite email did not send. Re-issue the invite once the email path is back."
            });
        }
        else
        {
            // Failure didn't undo the tenant insert — surface as a
            // warning so the operator knows to provision Hub manually.
            response.Messages.Add(new MessageDto
            {
                Message = invite.FailureMessage ?? "User added to your team but the Hub invite cascade failed — provision the Hub user manually."
            });
        }

        return response;
    }

    public async Task<NpUserResponse> UpdateAsync(int contactId, NpUserUpdateDto dto, Guid messageId)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return Fail(messageId, "No NP scope configured for this user.");
        }

        var contact = await Context.TucClientContacts
            .Include(cc => cc.UcctClient)
            .FirstOrDefaultAsync(cc => cc.UcctId == contactId);
        if (contact is null)
            return Fail(messageId, "User not found.");

        // Scope guard — NP users can only edit contacts within their own NP.
        if (!scope.IsAdmin && contact.UcctClient?.NpAgentId != scope.NpAgentId)
            return Fail(messageId, "User not found or outside your scope.");

        var roleId = MapRoleNameToId(dto.Role);
        if (roleId is null)
            return Fail(messageId, $"Unknown role '{dto.Role}'. Use Admin / Dispatcher / Read-Only.");

        // Apply name change to BOTH the tucClientContact split and the
        // linked tblUser.FullName (if a staff bridge exists). Role goes
        // ONLY to ContactRoleId — never tblUser.UserGroupId, which is the
        // platform-wide DF Admin flag and must not be settable from this
        // surface.
        var (firstname, surname) = SplitContactName(dto.Name);
        contact.UcctFirstname = firstname;
        contact.UcctSurname = surname;
        contact.ContactRoleId = roleId;
        contact.Active = string.Equals(dto.Status, "active", StringComparison.OrdinalIgnoreCase);

        var actor = ResolveActor();
        contact.LastModified = DateTime.UtcNow;
        contact.LastModifiedBy = actor;

        if (contact.StaffId.HasValue)
        {
            var tblUser = await Context.TblUsers.FirstOrDefaultAsync(u => u.StaffId == contact.StaffId);
            if (tblUser is not null)
            {
                tblUser.FullName = dto.Name;
                tblUser.Active = contact.Active;
                tblUser.LastModified = DateTime.UtcNow;
                tblUser.LastModifiedBy = actor;
            }
        }

        await Context.SaveChangesAsync();

        return new NpUserResponse(messageId)
        {
            Success = true,
            User = MapToDto(contact),
        };
    }

    private static (string firstname, string surname) SplitContactName(string fullName)
    {
        var name = (fullName ?? string.Empty).Trim();
        if (name.Length == 0) return (string.Empty, "Contact");
        var lastSpace = name.LastIndexOf(' ');
        if (lastSpace < 0) return (Truncate(name, 50), string.Empty);
        return (Truncate(name[..lastSpace].Trim(), 50), Truncate(name[(lastSpace + 1)..].Trim(), 50));
    }

    private static string Truncate(string s, int max) =>
        string.IsNullOrEmpty(s) ? string.Empty : (s.Length <= max ? s : s[..max]);

    private string ResolveActor() =>
        httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
        ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
        ?? "system";

    private static NpUserResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
    };

    private static NpUserDto MapToDto(TucClientContact cc)
    {
        var fullName = $"{cc.UcctFirstname} {cc.UcctSurname}".Trim();
        if (string.IsNullOrEmpty(fullName)) fullName = cc.UserName ?? cc.UcctEmail ?? "Unnamed";
        return new NpUserDto
        {
            // Id is now UcctId (was tblUser.StaffId). Frontend sees a string;
            // the UpdateAsync path-param parses it back to int.
            Id = cc.UcctId.ToString(),
            Name = fullName,
            Email = cc.UserName ?? cc.UcctEmail ?? string.Empty,
            Role = MapRoleIdToName(cc.ContactRoleId),
            Status = cc.Active ? "active" : "inactive",
            LastLogin = FormatRelative(cc.LastAccessed),
        };
    }

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
