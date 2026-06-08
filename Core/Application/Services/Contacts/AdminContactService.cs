using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Authorization;
using DfrntDriveConfigurator.Core.Application.Dtos.Contacts;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Services.Permissions;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Contacts;

// Unified Permissions §8.1 — DF-Admin multi-lane Team & Users. Lists/edits
// contacts across lanes (Tenant Staff 4 / Network Partner 3 / DF Admin 5),
// never Customers (2). Reuses the Np* DTO shapes + the RolePermission resolver
// + tblContactAudit + the ClientTypeLadder (§B escalation guard on mutations).
public class AdminContactService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IRolePermissionResolver rolePermissionResolver,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    private static readonly int[] LaneAll = { 3, 4, 5 };   // NP, Tenant, DFAdmin (never Customer 2)

    private static int[] LaneTypes(string lane) => lane?.ToLowerInvariant() switch
    {
        "tenant" => new[] { 4 },
        "np" => new[] { 3 },
        "dfadmin" => new[] { 5 },
        _ => LaneAll,
    };

    private int CallerClientType =>
        int.TryParse(httpContextAccessor.HttpContext?.User.FindFirst("ClientTypeId")?.Value, out var v) ? v : 0;

    private bool ActorIsDfAdmin => CallerClientType == 5;

    private string Actor =>
        httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
        ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
        ?? "configurator";

    // ── List ─────────────────────────────────────────────────────────────
    public async Task<List<NpUserDto>> GetAllAsync(string lane)
    {
        var types = LaneTypes(lane);
        var rows = await Context.TucClientContacts.AsNoTracking()
            .Include(cc => cc.UcctClient)
            .Where(cc => cc.UcctClient != null && types.Contains(cc.UcctClient.ClientTypeId))
            .OrderByDescending(cc => cc.LastAccessed)
            .ThenBy(cc => cc.UcctSurname).ThenBy(cc => cc.UcctFirstname)
            .ToListAsync();

        var ids = rows.Select(r => r.UcctId).ToList();
        var junction = await Context.TblContactContactRoles.AsNoTracking()
            .Where(j => ids.Contains(j.ClientContactId))
            .Join(Context.TblContactRoles.AsNoTracking(), j => j.ContactRoleId, r => r.ContactRoleId,
                  (j, r) => new { j.ClientContactId, r.ContactRoleId, r.Name })
            .ToListAsync();
        var byContact = junction.GroupBy(x => x.ClientContactId)
            .ToDictionary(g => g.Key, g => g.Select(x => new NpRoleRef { Id = x.ContactRoleId, Name = x.Name }).ToList());

        var primaryIds = rows.Where(r => !byContact.ContainsKey(r.UcctId) && r.ContactRoleId != null)
            .Select(r => r.ContactRoleId!.Value).Distinct().ToList();
        var primaryNames = primaryIds.Count == 0 ? new Dictionary<int, string>()
            : await Context.TblContactRoles.AsNoTracking().Where(r => primaryIds.Contains(r.ContactRoleId))
                .ToDictionaryAsync(r => r.ContactRoleId, r => r.Name);

        return rows.Select(cc => new NpUserDto
        {
            Id = cc.UcctId.ToString(),
            Name = FullName(cc),
            Email = cc.UserName ?? cc.UcctEmail ?? string.Empty,
            ClientName = cc.UcctClient?.UcclName ?? string.Empty,
            Roles = byContact.TryGetValue(cc.UcctId, out var rs) ? rs
                : (cc.ContactRoleId is int pid && primaryNames.TryGetValue(pid, out var pn)
                    ? new List<NpRoleRef> { new() { Id = pid, Name = pn } } : new List<NpRoleRef>()),
            Status = cc.Active ? "active" : "inactive",
            LastLogin = FormatRelative(cc.LastAccessed),
        }).ToList();
    }

    // ── Detail ────────────────────────────────────────────────────────────
    public async Task<NpUserDetailDto?> GetDetailAsync(int contactId)
    {
        var cc = await Context.TucClientContacts.AsNoTracking()
            .Include(c => c.UcctClient)
            .FirstOrDefaultAsync(c => c.UcctId == contactId);
        if (cc?.UcctClient is null || !LaneAll.Contains(cc.UcctClient.ClientTypeId)) return null;

        var roleIds = await Context.TblContactContactRoles.AsNoTracking()
            .Where(j => j.ClientContactId == contactId).Select(j => j.ContactRoleId).ToListAsync();
        if (roleIds.Count == 0 && cc.ContactRoleId is int pid) roleIds.Add(pid);

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

    public Task<Dictionary<string, byte>> ResolveLevels(int contactId) =>
        rolePermissionResolver.ResolveAccessLevelsForContactAsync(contactId);

    public async Task<List<NpResolvedTile>> GetResolvedPermissionsAsync(int contactId)
    {
        var levels = await rolePermissionResolver.ResolveAccessLevelsForContactAsync(contactId);
        var perms = await Context.Permissions.AsNoTracking()
            .OrderBy(p => p.SortOrder).ThenBy(p => p.PermissionKey)
            .Select(p => new { p.PermissionKey, p.DisplayName, p.ParentKey, p.Tier }).ToListAsync();
        byte Lvl(string k) => levels.TryGetValue(k, out var v) ? v : (byte)0;
        return perms.Where(p => p.Tier == 1).Select(t => new NpResolvedTile
        {
            Key = t.PermissionKey, DisplayName = t.DisplayName, Level = Lvl(t.PermissionKey),
            Items = perms.Where(c => c.ParentKey == t.PermissionKey)
                .Select(c => new NpResolvedPerm { Key = c.PermissionKey, DisplayName = c.DisplayName, Level = Lvl(c.PermissionKey) }).ToList(),
        }).ToList();
    }

    public async Task<List<NpContactAuditDto>> GetHistoryAsync(int contactId)
    {
        var viewerIsDf = ActorIsDfAdmin;
        var rows = await Context.TblContactAudits.AsNoTracking()
            .Where(a => a.ClientContactId == contactId)
            .OrderByDescending(a => a.ChangedAt).ThenByDescending(a => a.AuditId)
            .Select(a => new { a.ChangedAt, a.FieldName, a.OldValue, a.NewValue, a.ChangedBy, a.ChangedByIsDfAdmin })
            .ToListAsync();
        return rows.Select(a => new NpContactAuditDto
        {
            ChangedAt = a.ChangedAt, Field = a.FieldName,
            OldValue = a.OldValue ?? string.Empty, NewValue = a.NewValue ?? string.Empty,
            ChangedBy = (!viewerIsDf && a.ChangedByIsDfAdmin) ? "DFAdmin" : a.ChangedBy,
        }).ToList();
    }

    // ── Resolved Data Scope inspector (RESOLVED-DATA-SCOPE §7) ──────────────
    // DF-admin-only view of a TARGET contact's effective data boundary. It runs
    // the same ScopeDecider the production list/picker filters use (§8), so it
    // can never disagree with them. Inputs are derived from the contact's DB row
    // (the live session derives the identical decision from the Hub login
    // claims). Returns ("forbidden") for non-DF callers, (null) for not-found.
    public async Task<(ResolvedDataScopeDto? dto, string? error)> GetResolvedDataScopeAsync(int contactId)
    {
        if (!ActorIsDfAdmin) return (null, "forbidden");

        var cc = await Context.TucClientContacts.AsNoTracking()
            .Include(c => c.UcctClient)
            .FirstOrDefaultAsync(c => c.UcctId == contactId);
        if (cc?.UcctClient is null || !LaneAll.Contains(cc.UcctClient.ClientTypeId)) return (null, null);

        var client = cc.UcctClient;
        var clientTypeId = client.ClientTypeId;

        // Derive the scope inputs from DB truth for this target contact. The live
        // resolver gates NP scope on the Hub Master.User IsNetworkPartner claim,
        // and NP users sit on a NetworkPartner-type client (ClientTypeId=3, per
        // the A1 resolution) — so ClientTypeId=3 is the faithful DB proxy. An
        // incidental tucClient.NpAgentId on a Tenant (4) client is therefore
        // ignored, exactly as the live resolver ignores it for non-NP callers.
        // The NpAgentId itself comes straight from tucClient.NpAgentId — the same
        // value production filters would use once NP scope applies.
        var isNetworkPartner = clientTypeId == ScopeDecider.NetworkPartnerClientType;
        var decision = ScopeDecider.Decide(new ScopeInputs(clientTypeId, isNetworkPartner, cc.UcctClientId, client.NpAgentId));

        var clientTypeName = await Context.ClientTypes.AsNoTracking()
            .Where(t => t.Id == clientTypeId).Select(t => t.Name).FirstOrDefaultAsync()
            ?? $"ClientType {clientTypeId}";

        string? npAgentName = null;
        if (decision.NpAgentId is int agentId)
            npAgentName = await Context.TucAgents.AsNoTracking()
                .Where(a => a.UcagId == agentId).Select(a => a.UcagName).FirstOrDefaultAsync();

        var displayName = FullName(cc);
        var summary = decision.Kind switch
        {
            ScopeKind.Platform => "DF Admin — platform-wide scope",
            ScopeKind.Tenant => $"Tenant Staff — tenant-wide within {client.UcclName}",
            ScopeKind.Np => $"NP Admin — restricted to {npAgentName ?? $"agent {decision.NpAgentId}"}",
            _ => "No resolved scope — deny by default",
        };

        // Honest trace: lead with how the inputs were derived, then the decision.
        var rules = new List<string>
        {
            "Inputs derived from the target contact's DB row: ClientTypeId, IsNetworkPartner≈(ClientTypeId=3), " +
            "NpAgentId=tucClient.NpAgentId. The live session derives the same decision from the Hub login claims " +
            "(ClientTypeId / IsNetworkPartner / NpAgentId).",
        };
        rules.AddRange(decision.Rules);

        return (new ResolvedDataScopeDto
        {
            ContactId = cc.UcctId,
            DisplayName = displayName,
            ResolvedClientTypeId = clientTypeId,
            ResolvedClientTypeName = clientTypeName,
            ScopeKind = decision.Kind.ToString(),
            Summary = summary,
            HomeClientId = cc.UcctClientId,
            HomeClientName = client.UcclName,
            TenantClientId = null,          // tenant boundary = the tenant DB; no discrete id in this schema
            TenantClientName = null,
            NpAgentId = decision.NpAgentId,
            NpAgentName = npAgentName,
            CustomerClientId = null,        // not modelled by the current resolver
            CourierId = null,               // not modelled by the current resolver
            CanSeeDfAdmin = decision.CanSeeDfAdmin,
            CanCrossTenant = decision.CanCrossTenant,
            CanSeeChildClientsOnly = null,  // not modelled
            IsInheritedFromParentClient = null, // not modelled
            ResolutionSource = decision.ResolutionSource,
            Rules = rules,
            NotModelled = new List<string>
            {
                "ScopeKind Customer / Courier (the configurator resolver never emits these)",
                "TenantClientId (tenant boundary is the tenant database, not a row)",
                "CanSeeChildClientsOnly", "IsInheritedFromParentClient",
                "CustomerClientId", "CourierId",
            },
        }, null);
    }

    // ── Lookups ───────────────────────────────────────────────────────────
    public async Task<List<NpRoleOptionDto>> GetAssignableRolesAsync(int clientTypeId) =>
        await Context.TblContactRoles.AsNoTracking()
            .Where(r => r.IsActive && r.TblRoleClientTypes.Any(t => t.ClientTypeId == clientTypeId))
            .OrderBy(r => r.Name)
            .Select(r => new NpRoleOptionDto { Id = r.ContactRoleId, Name = r.Name, Description = r.Description ?? string.Empty })
            .ToListAsync();

    public async Task<List<NpRelationshipTypeDto>> GetRelationshipTypesAsync() =>
        await Context.TblRelationshipTypes.AsNoTracking().OrderBy(t => t.RelationshipTypeId)
            .Select(t => new NpRelationshipTypeDto { Id = t.RelationshipTypeId, Name = t.Name }).ToListAsync();

    public async Task<List<object>> GetClientsAsync(string lane)
    {
        var types = LaneTypes(lane);
        return await Context.TucClients.AsNoTracking()
            .Where(c => c.UcclActive && types.Contains(c.ClientTypeId))
            .OrderBy(c => c.UcclName)
            .Select(c => (object)new { id = c.UcclId, name = c.UcclName, clientTypeId = c.ClientTypeId })
            .ToListAsync();
    }

    // ── Create / Update (ladder-guarded) ───────────────────────────────────
    public async Task<(NpUserDetailDto? detail, string? error)> CreateAsync(AdminContactCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email)) return (null, "Email is required.");
        var client = await Context.TucClients.FirstOrDefaultAsync(c => c.UcclId == dto.ClientId);
        if (client is null || !LaneAll.Contains(client.ClientTypeId)) return (null, "Invalid target client.");

        // §B ladder — caller must out-rank the target client's ClientType + every role tag.
        if (!ClientTypeLadder.CanWriteClientType(CallerClientType, client.ClientTypeId))
            return (null, ClientTypeLadder.ForbiddenCode);

        var email = dto.Email.Trim();
        if (await Context.TucClientContacts.AnyAsync(c => c.UcctEmail == email || c.UserName == email))
            return (null, $"A contact with email '{email}' already exists.");

        var now = DateTime.UtcNow;
        var contact = new TucClientContact
        {
            UcctClientId = dto.ClientId, UcctEmail = email, UserName = email,
            UcctFirstname = Truncate(dto.FirstName?.Trim() ?? string.Empty, 50),
            UcctSurname = Truncate(dto.LastName?.Trim() ?? string.Empty, 50),
            UcctJobTitle = NullIfBlank(dto.JobTitle), UcctMobile = NullIfBlank(dto.Mobile),
            RelationshipTypeId = dto.RelationshipTypeId, HasEmail = true, ValidatedEmail = false,
            Active = true, AllowCookieLogin = true, StaffId = null,
            Created = now, CreatedBy = Actor, LastModified = now, LastModifiedBy = Actor,
        };
        Context.TucClientContacts.Add(contact);
        await Context.SaveChangesAsync();

        var (_, err) = await ApplyRolesAsync(contact, client.ClientTypeId, dto.RoleIds);
        if (err is not null) return (null, err);
        Context.TblContactAudits.Add(Audit(contact.UcctId, "Created", null, FullName(contact)));
        await Context.SaveChangesAsync();
        return (await GetDetailAsync(contact.UcctId), null);
    }

    public async Task<(NpUserDetailDto? detail, string? error)> UpdateAsync(int contactId, AdminContactUpdateDto dto)
    {
        var contact = await Context.TucClientContacts.Include(c => c.UcctClient)
            .FirstOrDefaultAsync(c => c.UcctId == contactId);
        if (contact?.UcctClient is null || !LaneAll.Contains(contact.UcctClient.ClientTypeId))
            return (null, "Contact not found.");

        // §B ladder — caller must out-rank the current client's ClientType.
        if (!ClientTypeLadder.CanWriteClientType(CallerClientType, contact.UcctClient.ClientTypeId))
            return (null, ClientTypeLadder.ForbiddenCode);

        var targetClientTypeId = contact.UcctClient.ClientTypeId;
        // Move to a different client (§B row 4) — ladder-check the target.
        if (dto.ClientId is int newClientId && newClientId != contact.UcctClientId)
        {
            var target = await Context.TucClients.FirstOrDefaultAsync(c => c.UcclId == newClientId);
            if (target is null || !LaneAll.Contains(target.ClientTypeId)) return (null, "Invalid target client.");
            if (!ClientTypeLadder.CanWriteClientType(CallerClientType, target.ClientTypeId)) return (null, ClientTypeLadder.ForbiddenCode);
            contact.UcctClientId = newClientId;
            targetClientTypeId = target.ClientTypeId;
        }

        var before = new ContactSnapshot(
            contact.UcctFirstname ?? "", contact.UcctSurname ?? "", contact.UserName ?? "",
            contact.UcctJobTitle ?? "", contact.UcctMobile ?? "", contact.UcctDirectDial ?? "",
            contact.UcctNotes ?? "", contact.RelationshipTypeId, contact.Active);
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
        contact.LastModifiedBy = Actor;

        var (newRoleIds, err) = await ApplyRolesAsync(contact, targetClientTypeId, dto.RoleIds);
        if (err is not null) return (null, err);
        await WriteAuditDiffAsync(contact, before, oldRoleIds, newRoleIds);
        await Context.SaveChangesAsync();
        return (await GetDetailAsync(contact.UcctId), null);
    }

    // ── Role assignment (ladder + junction diff + primary) — no audit ───────
    private async Task<(List<int> desired, string? error)> ApplyRolesAsync(TucClientContact contact, int clientTypeId, List<int>? roleIds)
    {
        var requested = (roleIds ?? new List<int>()).Where(id => id > 0).Distinct().ToList();
        // Assignable = roles tagged for the contact's ClientType. §B ladder:
        // every requested role's max ClientType tag must be at/below the caller.
        var roleTags = await Context.TblContactRoles
            .Where(r => requested.Contains(r.ContactRoleId))
            .Select(r => new
            {
                r.ContactRoleId,
                IsAssignable = r.IsActive && r.TblRoleClientTypes.Any(t => t.ClientTypeId == clientTypeId),
                MaxTag = r.TblRoleClientTypes.Max(t => (int?)t.ClientTypeId) ?? 0,
            })
            .ToListAsync();
        foreach (var rt in roleTags)
            if (!ClientTypeLadder.CanWriteClientType(CallerClientType, rt.MaxTag))
                return (new List<int>(), ClientTypeLadder.ForbiddenCode);
        var desired = roleTags.Where(rt => rt.IsAssignable).Select(rt => rt.ContactRoleId).ToList();

        var existing = await Context.TblContactContactRoles.Where(j => j.ClientContactId == contact.UcctId).ToListAsync();
        var existingIds = existing.Select(j => j.ContactRoleId).ToHashSet();
        foreach (var gone in existing.Where(j => !desired.Contains(j.ContactRoleId))) Context.TblContactContactRoles.Remove(gone);
        foreach (var add in desired.Where(id => !existingIds.Contains(id))) Context.TblContactContactRoles.Add(new TblContactContactRole { ClientContactId = contact.UcctId, ContactRoleId = add });
        contact.ContactRoleId = desired.Count > 0 ? desired[0] : null;
        return (desired, null);
    }

    // ── Audit ───────────────────────────────────────────────────────────────
    private sealed record ContactSnapshot(string FirstName, string LastName, string Email, string JobTitle,
        string Mobile, string DirectDial, string Notes, int? RelId, bool Active);

    private TblContactAudit Audit(int contactId, string field, string? oldV, string? newV) => new()
    {
        ClientContactId = contactId, FieldName = field,
        OldValue = oldV is null ? null : Truncate(oldV, 400), NewValue = newV is null ? null : Truncate(newV, 400),
        ChangedBy = Actor, ChangedByIsDfAdmin = ActorIsDfAdmin, ChangedAt = DateTime.UtcNow,
    };

    private async Task WriteAuditDiffAsync(TucClientContact after, ContactSnapshot before, List<int> oldRoleIds, List<int> newRoleIds)
    {
        void F(string n, string o, string v) { if (!string.Equals(o ?? "", v ?? "", StringComparison.Ordinal)) Context.TblContactAudits.Add(Audit(after.UcctId, n, o, v)); }
        F("First Name", before.FirstName, after.UcctFirstname ?? "");
        F("Last Name", before.LastName, after.UcctSurname ?? "");
        F("Email", before.Email, after.UserName ?? "");
        F("Job Title", before.JobTitle, after.UcctJobTitle ?? "");
        F("Mobile", before.Mobile, after.UcctMobile ?? "");
        F("Direct Dial", before.DirectDial, after.UcctDirectDial ?? "");
        F("Notes", before.Notes, after.UcctNotes ?? "");
        F("Status", before.Active ? "Active" : "Inactive", after.Active ? "Active" : "Inactive");
        var relIds = new[] { before.RelId, after.RelationshipTypeId }.Where(x => x != null).Select(x => x!.Value).Distinct().ToList();
        var relNames = relIds.Count == 0 ? new Dictionary<int, string>()
            : await Context.TblRelationshipTypes.Where(t => relIds.Contains(t.RelationshipTypeId)).ToDictionaryAsync(t => t.RelationshipTypeId, t => t.Name);
        string Rel(int? id) => id is int v && relNames.TryGetValue(v, out var n) ? n : "None";
        F("Relationship Type", Rel(before.RelId), Rel(after.RelationshipTypeId));

        if (!oldRoleIds.OrderBy(x => x).SequenceEqual(newRoleIds.OrderBy(x => x)))
        {
            var ids = oldRoleIds.Concat(newRoleIds).Distinct().ToList();
            var names = ids.Count == 0 ? new Dictionary<int, string>()
                : await Context.TblContactRoles.Where(r => ids.Contains(r.ContactRoleId)).ToDictionaryAsync(r => r.ContactRoleId, r => r.Name);
            string Csv(List<int> x) => x.Count == 0 ? "(none)" : string.Join(", ", x.Select(i => names.GetValueOrDefault(i, $"#{i}")).OrderBy(n => n));
            Context.TblContactAudits.Add(Audit(after.UcctId, "Roles", Csv(oldRoleIds), Csv(newRoleIds)));
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    private static string FullName(TucClientContact cc)
    {
        var n = $"{cc.UcctFirstname} {cc.UcctSurname}".Trim();
        return string.IsNullOrEmpty(n) ? (cc.UserName ?? cc.UcctEmail ?? "Unnamed") : n;
    }
    private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
    private static string Truncate(string s, int max) => string.IsNullOrEmpty(s) ? string.Empty : (s.Length <= max ? s : s[..max]);
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
