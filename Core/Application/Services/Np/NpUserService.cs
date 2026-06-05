using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Common;
using DfrntDriveConfigurator.Core.Application.Services.Permissions;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Unified Permissions §8.1 — NP Users list + 3-tab Contact modal. Roles are
// REAL ContactRoleIds (multi-role via tblContactContactRole), resolved by name
// from the assignable-roles lookup — NOT the legacy hardcoded 1/2/3 NpRole
// mapping (which mis-assigned on collided tenants). CRM label lives on
// RelationshipTypeId, never ContactRoleId.
public class NpUserService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    INpScopeResolver scopeResolver,
    INpUserInviteService npUserInviteService,
    IRolePermissionResolver rolePermissionResolver,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    // NP contacts sit on NetworkPartner (ClientTypeId=3) clients (A1: NP Agents
    // are ClientType 3 + NpAgentId, not a separate type). Assignable roles are
    // those tagged for ClientType 3.
    private const int NetworkPartnerClientTypeId = 3;

    // ── List ───────────────────────────────────────────────────────────
    public async Task<NpUsersResponse> GetAll(Guid messageId)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
            return new NpUsersResponse(messageId) { Success = true, Users = [] };

        var query = Context.TucClientContacts.AsNoTracking()
            .Include(cc => cc.UcctClient)
            .Where(cc => cc.UcctClient != null);
        if (!scope.IsAdmin)
            query = query.Where(cc => cc.UcctClient!.NpAgentId == scope.NpAgentId!.Value);

        var rows = await query
            .OrderByDescending(cc => cc.LastAccessed)
            .ThenBy(cc => cc.UcctSurname).ThenBy(cc => cc.UcctFirstname)
            .ToListAsync();

        var ids = rows.Select(r => r.UcctId).ToList();

        // Stacked roles per contact (junction → names).
        var junction = await Context.TblContactContactRoles.AsNoTracking()
            .Where(j => ids.Contains(j.ClientContactId))
            .Join(Context.TblContactRoles.AsNoTracking(),
                  j => j.ContactRoleId, r => r.ContactRoleId,
                  (j, r) => new { j.ClientContactId, r.ContactRoleId, r.Name })
            .ToListAsync();
        var byContact = junction
            .GroupBy(x => x.ClientContactId)
            .ToDictionary(g => g.Key, g => g.Select(x => new NpRoleRef { Id = x.ContactRoleId, Name = x.Name }).ToList());

        // Fallback for contacts with a primary ContactRoleId but no junction row
        // (legacy single-role assignment before the modal rebuild).
        var primaryIds = rows
            .Where(r => !byContact.ContainsKey(r.UcctId) && r.ContactRoleId != null)
            .Select(r => r.ContactRoleId!.Value).Distinct().ToList();
        var primaryNames = primaryIds.Count == 0
            ? new Dictionary<int, string>()
            : await Context.TblContactRoles.AsNoTracking()
                .Where(r => primaryIds.Contains(r.ContactRoleId))
                .ToDictionaryAsync(r => r.ContactRoleId, r => r.Name);

        var users = rows.Select(cc =>
        {
            var roles = byContact.TryGetValue(cc.UcctId, out var rs)
                ? rs
                : (cc.ContactRoleId is int pid && primaryNames.TryGetValue(pid, out var pn)
                    ? new List<NpRoleRef> { new() { Id = pid, Name = pn } }
                    : new List<NpRoleRef>());
            return new NpUserDto
            {
                Id = cc.UcctId.ToString(),
                Name = FullName(cc),
                Email = cc.UserName ?? cc.UcctEmail ?? string.Empty,
                ClientName = cc.UcctClient?.UcclName ?? string.Empty,
                Roles = roles,
                Status = cc.Active ? "active" : "inactive",
                LastLogin = FormatRelative(cc.LastAccessed),
            };
        }).ToList();

        return new NpUsersResponse(messageId) { Success = true, Users = users };
    }

    // ── Detail (modal load) ──────────────────────────────────────────────
    public async Task<NpUserDetailDto?> GetDetailAsync(int contactId)
    {
        var scope = await scopeResolver.ResolveAsync();
        var cc = await Context.TucClientContacts.AsNoTracking()
            .Include(c => c.UcctClient)
            .FirstOrDefaultAsync(c => c.UcctId == contactId);
        if (cc is null) return null;
        if (!scope.IsAdmin && cc.UcctClient?.NpAgentId != scope.NpAgentId) return null;

        var roleIds = await Context.TblContactContactRoles.AsNoTracking()
            .Where(j => j.ClientContactId == contactId)
            .Select(j => j.ContactRoleId)
            .ToListAsync();
        if (roleIds.Count == 0 && cc.ContactRoleId is int pid)
            roleIds.Add(pid);   // legacy single-role fallback

        return new NpUserDetailDto
        {
            Id = cc.UcctId,
            FirstName = cc.UcctFirstname ?? string.Empty,
            LastName = cc.UcctSurname ?? string.Empty,
            Email = cc.UserName ?? cc.UcctEmail ?? string.Empty,
            JobTitle = cc.UcctJobTitle ?? string.Empty,
            Mobile = cc.UcctMobile ?? string.Empty,
            DirectDial = cc.UcctDirectDial ?? string.Empty,
            Notes = cc.UcctNotes ?? string.Empty,
            RelationshipTypeId = cc.RelationshipTypeId,
            RoleIds = roleIds,
            Status = cc.Active ? "active" : "inactive",
            ClientId = cc.UcctClientId,
            ClientName = cc.UcctClient?.UcclName ?? string.Empty,
            ClientTypeId = cc.UcctClient?.ClientTypeId ?? 0,
        };
    }

    // ── Resolved permissions (Tab 2) ─────────────────────────────────────
    public async Task<List<NpResolvedTile>> GetResolvedPermissionsAsync(int contactId)
    {
        var levels = await rolePermissionResolver.ResolveAccessLevelsForContactAsync(contactId);

        var perms = await Context.Permissions.AsNoTracking()
            .OrderBy(p => p.SortOrder).ThenBy(p => p.PermissionKey)
            .Select(p => new { p.PermissionKey, p.DisplayName, p.ParentKey, p.Tier })
            .ToListAsync();

        byte Lvl(string k) => levels.TryGetValue(k, out var v) ? v : (byte)0;

        return perms.Where(p => p.Tier == 1).Select(t => new NpResolvedTile
        {
            Key = t.PermissionKey,
            DisplayName = t.DisplayName,
            Level = Lvl(t.PermissionKey),
            Items = perms.Where(c => c.ParentKey == t.PermissionKey)
                .Select(c => new NpResolvedPerm { Key = c.PermissionKey, DisplayName = c.DisplayName, Level = Lvl(c.PermissionKey) })
                .ToList(),
        }).ToList();
    }

    // ── Lookups ───────────────────────────────────────────────────────────
    public async Task<List<NpRoleOptionDto>> GetAssignableRolesAsync() =>
        await Context.TblContactRoles.AsNoTracking()
            .Where(r => r.IsActive && r.TblRoleClientTypes.Any(t => t.ClientTypeId == NetworkPartnerClientTypeId))
            .OrderBy(r => r.Name)
            .Select(r => new NpRoleOptionDto { Id = r.ContactRoleId, Name = r.Name, Description = r.Description ?? string.Empty })
            .ToListAsync();

    public async Task<List<NpRelationshipTypeDto>> GetRelationshipTypesAsync() =>
        await Context.TblRelationshipTypes.AsNoTracking()
            .OrderBy(t => t.RelationshipTypeId)
            .Select(t => new NpRelationshipTypeDto { Id = t.RelationshipTypeId, Name = t.Name })
            .ToListAsync();

    // ── Create ─────────────────────────────────────────────────────────────
    public async Task<NpUserResponse> CreateAsync(NpUserCreateDto dto, Guid messageId)
    {
        if (string.IsNullOrWhiteSpace(dto.Email)) return Fail(messageId, "Email is required.");
        if (string.IsNullOrWhiteSpace(dto.FirstName) && string.IsNullOrWhiteSpace(dto.LastName))
            return Fail(messageId, "First or last name is required.");

        var clientClaim = httpContextAccessor.HttpContext?.User.FindFirst("ClientID")?.Value;
        if (!int.TryParse(clientClaim, out var clientId) || clientId <= 0)
            return Fail(messageId, "ClientID claim missing — can't resolve your NP. Re-login or contact a DF Admin.");

        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
            return Fail(messageId, "Your account has no NP linkage — can't add team members.");

        var email = dto.Email.Trim();
        var taken = await Context.TucClientContacts.AsNoTracking()
            .AnyAsync(cc => cc.UcctEmail == email || cc.UserName == email);
        if (taken) return Fail(messageId, $"A contact with email '{email}' already exists in this tenant.");

        var actor = ResolveActor();
        var now = DateTime.UtcNow;
        var contact = new TucClientContact
        {
            UcctClientId = clientId,
            UcctEmail = email,
            UserName = email,
            UcctFirstname = Truncate(dto.FirstName?.Trim() ?? string.Empty, 50),
            UcctSurname = Truncate(dto.LastName?.Trim() ?? string.Empty, 50),
            UcctJobTitle = NullIfBlank(dto.JobTitle),
            UcctMobile = NullIfBlank(dto.Mobile),
            RelationshipTypeId = dto.RelationshipTypeId,
            HasEmail = true,
            ValidatedEmail = false,
            Active = true,
            AllowCookieLogin = true,
            StaffId = null,
            Created = now,
            CreatedBy = actor,
            LastModified = now,
            LastModifiedBy = actor,
        };
        Context.TucClientContacts.Add(contact);
        await Context.SaveChangesAsync();           // assigns UcctId

        await ApplyRolesAsync(contact, dto.RoleIds);
        Context.TblContactAudits.Add(new TblContactAudit
        {
            ClientContactId = contact.UcctId, FieldName = "Created",
            OldValue = null, NewValue = FullName(contact),
            ChangedBy = actor, ChangedByIsDfAdmin = ActorIsDfAdmin, ChangedAt = DateTime.UtcNow,
        });
        await Context.SaveChangesAsync();

        var invite = await npUserInviteService.InviteAsync(email);
        var response = new NpUserResponse(messageId) { Success = true, User = await GetDetailAsync(contact.UcctId) };
        response.Messages.Add(new MessageDto { Message = InviteMessage(invite, email) });
        return response;
    }

    // ── Update ─────────────────────────────────────────────────────────────
    public async Task<NpUserResponse> UpdateAsync(int contactId, NpUserUpdateDto dto, Guid messageId)
    {
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin && scope.NpAgentId is null)
            return Fail(messageId, "No NP scope configured for this user.");

        var contact = await Context.TucClientContacts
            .Include(cc => cc.UcctClient)
            .FirstOrDefaultAsync(cc => cc.UcctId == contactId);
        if (contact is null) return Fail(messageId, "User not found.");
        if (!scope.IsAdmin && contact.UcctClient?.NpAgentId != scope.NpAgentId)
            return Fail(messageId, "User not found or outside your scope.");

        var actor = ResolveActor();

        // Snapshot for the audit diff (§8.1 Tab 3) — captured BEFORE mutation.
        var before = new ContactSnapshot(
            contact.UcctFirstname ?? string.Empty,
            contact.UcctSurname ?? string.Empty,
            contact.UserName ?? string.Empty,
            contact.UcctJobTitle ?? string.Empty,
            contact.UcctMobile ?? string.Empty,
            contact.UcctDirectDial ?? string.Empty,
            contact.UcctNotes ?? string.Empty,
            contact.RelationshipTypeId,
            contact.Active);
        var oldRoleIds = await Context.TblContactContactRoles
            .Where(j => j.ClientContactId == contactId).Select(j => j.ContactRoleId).ToListAsync();

        contact.UcctFirstname = Truncate(dto.FirstName?.Trim() ?? string.Empty, 50);
        contact.UcctSurname = Truncate(dto.LastName?.Trim() ?? string.Empty, 50);
        contact.UserName = string.IsNullOrWhiteSpace(dto.Email) ? contact.UserName : dto.Email.Trim();
        contact.UcctJobTitle = NullIfBlank(dto.JobTitle);
        contact.UcctMobile = NullIfBlank(dto.Mobile);
        contact.UcctDirectDial = NullIfBlank(dto.DirectDial);
        contact.UcctNotes = NullIfBlank(dto.Notes);
        contact.RelationshipTypeId = dto.RelationshipTypeId;
        contact.Active = string.Equals(dto.Status, "active", StringComparison.OrdinalIgnoreCase);
        contact.LastModified = DateTime.UtcNow;
        contact.LastModifiedBy = actor;

        var newRoleIds = await ApplyRolesAsync(contact, dto.RoleIds);
        await WriteAuditDiffAsync(contactId, actor, before, contact, oldRoleIds, newRoleIds);

        // Keep a linked tblUser's name/active in sync (legacy staff bridge).
        if (contact.StaffId.HasValue)
        {
            var tblUser = await Context.TblUsers.FirstOrDefaultAsync(u => u.StaffId == contact.StaffId);
            if (tblUser is not null)
            {
                tblUser.FullName = $"{contact.UcctFirstname} {contact.UcctSurname}".Trim();
                tblUser.Active = contact.Active;
                tblUser.LastModified = DateTime.UtcNow;
                tblUser.LastModifiedBy = actor;
            }
        }

        await Context.SaveChangesAsync();
        return new NpUserResponse(messageId) { Success = true, User = await GetDetailAsync(contact.UcctId) };
    }

    // ── Role assignment helper (junction diff + primary) ────────────────────
    // Validates the requested ids against the assignable NP role set, writes
    // the tblContactContactRole junction (the stacking source the resolver
    // reads), and keeps the single ContactRoleId as the PRIMARY role (first
    // selected) so Hub's RoleId/NpRoleId claim + the legacy list still work.
    private async Task<List<int>> ApplyRolesAsync(TucClientContact contact, List<int>? roleIds)
    {
        var requested = (roleIds ?? new List<int>()).Where(id => id > 0).Distinct().ToList();
        var assignable = await Context.TblContactRoles
            .Where(r => r.IsActive && r.TblRoleClientTypes.Any(t => t.ClientTypeId == NetworkPartnerClientTypeId))
            .Select(r => r.ContactRoleId)
            .ToListAsync();
        var desired = requested.Where(assignable.Contains).ToList();

        var existing = await Context.TblContactContactRoles
            .Where(j => j.ClientContactId == contact.UcctId)
            .ToListAsync();
        var existingIds = existing.Select(j => j.ContactRoleId).ToHashSet();

        foreach (var gone in existing.Where(j => !desired.Contains(j.ContactRoleId)))
            Context.TblContactContactRoles.Remove(gone);
        foreach (var add in desired.Where(id => !existingIds.Contains(id)))
            Context.TblContactContactRoles.Add(new TblContactContactRole { ClientContactId = contact.UcctId, ContactRoleId = add });

        contact.ContactRoleId = desired.Count > 0 ? desired[0] : null;
        return desired;
    }

    // ── History (Tab 3) ─────────────────────────────────────────────────────
    private sealed record ContactSnapshot(
        string FirstName, string LastName, string Email, string JobTitle,
        string Mobile, string DirectDial, string Notes, int? RelId, bool Active);

    private bool ActorIsDfAdmin =>
        httpContextAccessor.HttpContext?.User.FindFirst("ClientTypeId")?.Value == "5";

    // Compares the before-snapshot to the saved contact + role sets and queues
    // one tblContactAudit row per changed field. Caller saves.
    private async Task WriteAuditDiffAsync(
        int contactId, string actor, ContactSnapshot before, TucClientContact after,
        List<int> oldRoleIds, List<int> newRoleIds)
    {
        var isDf = ActorIsDfAdmin;
        void Field(string name, string oldV, string newV)
        {
            if (!string.Equals(oldV ?? string.Empty, newV ?? string.Empty, StringComparison.Ordinal))
                Context.TblContactAudits.Add(new TblContactAudit
                {
                    ClientContactId = contactId, FieldName = name,
                    OldValue = Truncate(oldV ?? string.Empty, 400), NewValue = Truncate(newV ?? string.Empty, 400),
                    ChangedBy = actor, ChangedByIsDfAdmin = isDf, ChangedAt = DateTime.UtcNow,
                });
        }

        Field("First Name", before.FirstName, after.UcctFirstname ?? string.Empty);
        Field("Last Name", before.LastName, after.UcctSurname ?? string.Empty);
        Field("Email", before.Email, after.UserName ?? string.Empty);
        Field("Job Title", before.JobTitle, after.UcctJobTitle ?? string.Empty);
        Field("Mobile", before.Mobile, after.UcctMobile ?? string.Empty);
        Field("Direct Dial", before.DirectDial, after.UcctDirectDial ?? string.Empty);
        Field("Notes", before.Notes, after.UcctNotes ?? string.Empty);
        Field("Status", before.Active ? "Active" : "Inactive", after.Active ? "Active" : "Inactive");

        // Relationship Type + Roles need name lookups.
        var relIds = new[] { before.RelId, after.RelationshipTypeId }.Where(x => x is not null).Select(x => x!.Value).Distinct().ToList();
        var relNames = relIds.Count == 0 ? new Dictionary<int, string>()
            : await Context.TblRelationshipTypes.Where(t => relIds.Contains(t.RelationshipTypeId)).ToDictionaryAsync(t => t.RelationshipTypeId, t => t.Name);
        string Rel(int? id) => id is int v && relNames.TryGetValue(v, out var n) ? n : "None";
        Field("Relationship Type", Rel(before.RelId), Rel(after.RelationshipTypeId));

        if (!oldRoleIds.OrderBy(x => x).SequenceEqual(newRoleIds.OrderBy(x => x)))
        {
            var roleIds = oldRoleIds.Concat(newRoleIds).Distinct().ToList();
            var roleNames = roleIds.Count == 0 ? new Dictionary<int, string>()
                : await Context.TblContactRoles.Where(r => roleIds.Contains(r.ContactRoleId)).ToDictionaryAsync(r => r.ContactRoleId, r => r.Name);
            string Csv(List<int> ids) => ids.Count == 0 ? "(none)" : string.Join(", ", ids.Select(i => roleNames.GetValueOrDefault(i, $"#{i}")).OrderBy(n => n));
            Field("Roles", Csv(oldRoleIds), Csv(newRoleIds));
        }
    }

    public async Task<List<NpContactAuditDto>> GetHistoryAsync(int contactId)
    {
        var viewerIsDf = ActorIsDfAdmin;
        var rows = await Context.TblContactAudits.AsNoTracking()
            .Where(a => a.ClientContactId == contactId)
            .OrderByDescending(a => a.ChangedAt).ThenByDescending(a => a.AuditId)
            .Select(a => new { a.ChangedAt, a.FieldName, a.OldValue, a.NewValue, a.ChangedBy, a.ChangedByIsDfAdmin })
            .ToListAsync();

        // Addendum actor-masking: non-DF viewers see "DFAdmin" for DF-authored rows.
        return rows.Select(a => new NpContactAuditDto
        {
            ChangedAt = a.ChangedAt,
            Field = a.FieldName,
            OldValue = a.OldValue ?? string.Empty,
            NewValue = a.NewValue ?? string.Empty,
            ChangedBy = (!viewerIsDf && a.ChangedByIsDfAdmin) ? "DFAdmin" : a.ChangedBy,
        }).ToList();
    }

    // ── Helpers ─────────────────────────────────────────────────────────────
    private static string FullName(TucClientContact cc)
    {
        var n = $"{cc.UcctFirstname} {cc.UcctSurname}".Trim();
        return string.IsNullOrEmpty(n) ? (cc.UserName ?? cc.UcctEmail ?? "Unnamed") : n;
    }

    private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
    private static string Truncate(string s, int max) => string.IsNullOrEmpty(s) ? string.Empty : (s.Length <= max ? s : s[..max]);

    private string ResolveActor() =>
        httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
        ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
        ?? "system";

    private static string InviteMessage(NpInviteResult invite, string email)
    {
        if (invite.FullySucceeded)
            return $"Invite sent to {email}. They'll receive an email to set their password.";
        if (invite.PartialSuccess)
            return $"User added (Hub id {invite.HubUserId}) but the invite email did not send. Re-issue the invite once the email path is back.";
        return invite.FailureMessage ?? "User added to your team but the Hub invite cascade failed — provision the Hub user manually.";
    }

    private static NpUserResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
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
