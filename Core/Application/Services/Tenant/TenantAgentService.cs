using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Application.Services.Common;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Tenant;

public class TenantAgentService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IHttpContextAccessor httpContextAccessor,
    INpUserInviteService npUserInviteService) : BaseService(contextFactory)
{
    public async Task<TenantAgentsResponse> GetAll(Guid messageId)
    {
        // EF translates the navigation-property accesses into LEFT JOINs on
        // tucSuburb / tucAgentStatus / tucAgentRanking. Null-coalescing keeps
        // missing FKs (e.g. an agent with StatusId=null) from throwing.
        var rows = await Context.TucAgents
            .AsNoTracking()
            .OrderByDescending(a => a.IsNetworkPartner)   // NPs first
            .ThenBy(a => a.UcagName)
            .Select(ProjectToDto)
            .ToListAsync();

        return new TenantAgentsResponse(messageId)
        {
            Success = true,
            Agents = rows,
        };
    }

    public async Task<TenantAgentResponse> UpdateAsync(int id, TenantAgentUpsertDto dto, Guid messageId)
    {
        // Include the coverage rows so ApplyCoverageAreas can reconcile them,
        // and the linked NP TucClient (with its primary contact) so identity
        // edits propagate without a second round-trip. Phase 5+27 only mirrors
        // name + address + phone — billing / rate / type fields stay under the
        // operator's direct DB control. An un-tick of IsNetworkPartner does
        // NOT auto-sever NpAgentId on the client; see warning below.
        var agent = await Context.TucAgents
            .Include(a => a.AgentCoverageAreas)
            .Include(a => a.TucClients)
                .ThenInclude(c => c.TucClientContacts)
            .FirstOrDefaultAsync(a => a.UcagId == id);
        if (agent is null)
        {
            return Fail(messageId, "Agent not found.");
        }

        var actor = ResolveActor();
        var now = DateTime.UtcNow;
        ApplyUpdate(agent, dto);
        ApplyCoverageAreas(agent, dto, actor);

        // Propagate identity fields to the linked NP TucClient row if one
        // exists. There is exactly one per NP-flagged agent (the cascade in
        // CreateAsync enforces 1:1), but the collection nav can carry more in
        // pathological cases — iterate defensively.
        var warnings = new List<string>();
        foreach (var client in agent.TucClients)
        {
            client.UcclName = Truncate(dto.Name, 75);
            client.UcclLegalName = Truncate(dto.Name, 150);
            client.UcclAddress = dto.AddressLine1 ?? string.Empty;
            client.UcclPostCode = dto.PostCode ?? string.Empty;
            client.UcclPhone = dto.Phone ?? string.Empty;
            // §A.1: propagate ClientTypeId change. Null DTO value leaves the
            // existing client.ClientTypeId untouched (callers pre-dating the
            // picker keep the original value).
            if (dto.ClientTypeId is int newType && client.ClientTypeId != newType)
            {
                client.ClientTypeId = newType;
            }
            client.LastModified = now;
            client.LastModifiedBy = actor;

            // ContactEmail newly populated and no contact exists yet → create
            // the primary contact now. Pre-existing contacts are NOT mutated
            // here — that lives on the §B per-user surface (Phase 5+28).
            if (!string.IsNullOrWhiteSpace(dto.ContactEmail) &&
                client.TucClientContacts.Count == 0)
            {
                if (await IsContactEmailTakenAsync(dto.ContactEmail))
                {
                    warnings.Add($"Primary contact not created — email \"{dto.ContactEmail}\" is already in use on another tucClientContact.");
                }
                else
                {
                    client.TucClientContacts.Add(BuildPrimaryContact(dto, actor, now));
                }
            }
        }

        if (!dto.IsNetworkPartner && agent.TucClients.Count > 0)
        {
            // Un-ticking IsNetworkPartner on an agent that already has a linked
            // TucClient is an edge case (downgrade-from-NP). v1 leaves the
            // tucClient.NpAgentId link intact and surfaces a warning — the
            // operator decides whether to repoint or delete the client row.
            warnings.Add($"Agent has {agent.TucClients.Count} linked TucClient row(s) but IsNetworkPartner is now false — NP linkage left in place. Repoint or remove the client row manually if intended.");
        }

        agent.LastModified = now;
        agent.LastModifiedBy = actor;

        await Context.SaveChangesAsync();

        var read = await Context.TucAgents.AsNoTracking()
            .Where(a => a.UcagId == id)
            .Select(ProjectToDto)
            .FirstOrDefaultAsync();

        var response = new TenantAgentResponse(messageId)
        {
            Success = true,
            Agent = read,
        };
        foreach (var w in warnings)
            response.Messages.Add(new MessageDto { Message = w });
        return response;
    }

    public async Task<TenantAgentResponse> CreateAsync(TenantAgentUpsertDto dto, Guid messageId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return Fail(messageId, "Name is required.");
        }

        // Pre-flight: NPs with a populated ContactEmail need that email to be
        // unique across tucClientContact. If it's not, bail before any insert
        // — the alternative (atomic rollback after the SaveChangesAsync throws)
        // is the same outcome with a noisier error path.
        if (dto.IsNetworkPartner && !string.IsNullOrWhiteSpace(dto.ContactEmail)
            && await IsContactEmailTakenAsync(dto.ContactEmail))
        {
            return Fail(messageId, $"Contact email \"{dto.ContactEmail}\" is already in use on another tucClientContact.");
        }

        var actor = ResolveActor();
        var now = DateTime.UtcNow;
        var agent = new TucAgent
        {
            // UcagSuburbId is `int` (NOT NULL) with a non-nullable FK to
            // tucSuburb — sending 0 fails the FK constraint. Steve's brief
            // §C suggests dropping this "while you're in there" but that
            // assumes the column is/becomes nullable; it's not today. Leave
            // the 152 default until Coverage-Areas-as-source-of-truth lands
            // (Phase 5+29) and either nulls this column or wires a picker.
            UcagSuburbId = 152,
            UcagAddress = string.Empty,
            UcagFax = string.Empty,
            UcagAltPhone = string.Empty,
            UcagAltFax = string.Empty,
            UcagNotes = string.Empty,
            CreatedBy = actor,
            LastModifiedBy = actor,
            Created = now,
            LastModified = now,
            Notes = string.Empty,
        };
        ApplyUpdate(agent, dto);
        ApplyCoverageAreas(agent, dto, actor);

        var warnings = new List<string>();

        // NP cascade: TucClient (always) + TucClientContact (if ContactEmail
        // present) attached via navigation collections so EF resolves the
        // generated UcagId / UcclId into the FKs during the single
        // SaveChangesAsync below. No orphan state possible at this layer.
        // §A.1 (Phase 5+27.1) will replace the hardcoded ClientTypeId=3 with
        // an operator-selectable value.
        if (dto.IsNetworkPartner)
        {
            var template = await ResolveTemplateClientAsync();
            if (template is null)
            {
                return Fail(messageId, "Cannot create NP — no existing active tucClient rows on this tenant DB to inherit required-FK defaults from (SiteId, BillingType, etc.). The tenant needs at least one active tucClient row before NPs can be created via this cascade.");
            }
            var clientCode = await GenerateClientCodeAsync(dto.Name);
            // ClientTypeId defaults to 3 (NetworkPartner) when caller doesn't
            // send one — preserves backward compatibility for §A callers
            // pre-dating the §A.1 picker. Operator can override to any other
            // seeded ClientType via the picker (rare but allowed).
            var clientTypeId = dto.ClientTypeId ?? 3;
            var client = BuildNpClient(dto, clientCode, clientTypeId, template, actor, now);
            agent.TucClients.Add(client);

            if (!string.IsNullOrWhiteSpace(dto.ContactEmail))
            {
                client.TucClientContacts.Add(BuildPrimaryContact(dto, actor, now));
            }
            else
            {
                warnings.Add("Network Partner created with no contact email — no login contact was created. Add a user on the NP team page (or re-edit the NP with a Contact Email) to issue a portal invite.");
            }
        }

        Context.TucAgents.Add(agent);
        await Context.SaveChangesAsync();

        // Phase 5+28a §B.1 — Hub invite cascade. Fires only when the §A
        // cascade just wrote a tucClientContact (NP + ContactEmail set).
        // Cross-DB call is non-atomic: tenant rows stay committed if the
        // Hub step fails (per brief corrections #2 — surface, don't roll
        // back). Failures land as warnings in TenantAgentResponse.Messages
        // so the operator sees them in the UI and can retry / fix in Hub.
        if (dto.IsNetworkPartner && !string.IsNullOrWhiteSpace(dto.ContactEmail))
        {
            var invite = await npUserInviteService.InviteAsync(dto.ContactEmail!);
            if (invite.FullySucceeded)
            {
                warnings.Add($"Hub user provisioned and invite email sent to {dto.ContactEmail}. They can set their password from that email and log in.");
            }
            else if (invite.PartialSuccess)
            {
                warnings.Add($"Hub user provisioned (id {invite.HubUserId}) but the invite email did NOT send. The contact will need a manual password-reset invite — see Hub admin for next step.");
            }
            else
            {
                warnings.Add(invite.FailureMessage ?? "Hub invite cascade failed — provision the Hub user manually.");
            }
        }

        var read = await Context.TucAgents.AsNoTracking()
            .Where(a => a.UcagId == agent.UcagId)
            .Select(ProjectToDto)
            .FirstOrDefaultAsync();

        var response = new TenantAgentResponse(messageId)
        {
            Success = true,
            Agent = read,
        };
        foreach (var w in warnings)
            response.Messages.Add(new MessageDto { Message = w });
        return response;
    }

    // ─── NP cascade helpers (Phase 5+27 §A) ───────────────────────────────

    // Builds the TucClient row for an NP. Atomic-cascade-friendly — does NOT
    // set NpAgentId; the caller attaches via agent.TucClients.Add(client) so
    // EF resolves the generated UcagId into the FK on SaveChangesAsync.
    //
    // Template-clone strategy: the legacy tucClient table has FKs at the DB
    // layer that EF doesn't model as navigations (BillingType / Site / etc.)
    // and there's no way to enumerate them from C#. Rather than chase each
    // FK violation one error at a time, we inherit the FK values from an
    // existing active tucClient row on the tenant — whatever values that
    // row uses are proven-working on this tenant. NP-specific columns
    // (identity / address / type / audit) override; everything else is
    // pulled from the template so newly-added schema FKs land here
    // automatically when this method is re-touched.
    //
    // ClientTypeId resolved by caller — defaults to 3 (NetworkPartner) when
    // dto.ClientTypeId is null. §A.1 (Phase 5+27.1) wired the operator-driven
    // picker; any of the seeded ClientType values (1 Internal / 2 Customer /
    // 3 NetworkPartner) is accepted.
    private static TucClient BuildNpClient(TenantAgentUpsertDto dto, string code, int clientTypeId, TucClient template, string actor, DateTime now) => new()
    {
        // ── NP-specific (override template) ──────────────────────────────
        UcclName = Truncate(dto.Name, 75),
        UcclLegalName = Truncate(dto.Name, 150),
        UcclCode = code,
        ClientTypeId = clientTypeId,
        UcclAddress = dto.AddressLine1 ?? string.Empty,
        UcclPostCode = dto.PostCode ?? string.Empty,
        UcclPhone = dto.Phone ?? string.Empty,
        UcclActive = true,
        Created = now,
        CreatedBy = actor,
        LastModified = now,
        LastModifiedBy = actor,

        // ── Inherit from template (covers DB-only FKs EF doesn't model) ─
        SiteId = template.SiteId,
        UcclBillingType = template.UcclBillingType,
        UcclSuburbId = template.UcclSuburbId,
        Smsname = template.Smsname ?? string.Empty,   // required string
        UcclGroupId = template.UcclGroupId,
        UcclAverageDailyGroup = template.UcclAverageDailyGroup,
        StartingWeightExcess = template.StartingWeightExcess,
        AlertLatePickUp = template.AlertLatePickUp,
        AlertLateDelivery = template.AlertLateDelivery,
        PpdgraceDays = template.PpdgraceDays,
    };

    // Picks a tucClient row on the tenant to inherit required-FK defaults
    // from. Active rows preferred (active clients carry the production
    // FK / rate-code values the tenant actually uses); falls back to any
    // row if no active client exists; returns null on completely-empty
    // tucClient so the caller can surface a clear "tenant misconfigured"
    // error instead of an opaque FK-violation stack trace.
    private async Task<TucClient?> ResolveTemplateClientAsync()
    {
        var active = await Context.TucClients.AsNoTracking()
            .Where(c => c.UcclActive)
            .OrderBy(c => c.UcclId)
            .FirstOrDefaultAsync();
        if (active != null) return active;

        return await Context.TucClients.AsNoTracking()
            .OrderBy(c => c.UcclId)
            .FirstOrDefaultAsync();
    }

    // Splits dto.ContactName into firstname/surname (last space-delimited
    // token = surname; everything before = firstname). Empty ContactName
    // produces empty firstname + dto.Name fragment as surname so the row is
    // recognisable in tucClientContact lists. Email uniqueness is the
    // caller's responsibility — pre-checked in CreateAsync.
    //
    // UserName = UcctEmail per AdminManager.CreateContact convention
    // (UserSetupService.cs:148 uses UserName as the canonical login key).
    // Hub's full login auth process requires UserName populated; EF's
    // IsRequired metadata doesn't mark it, so our local validation never
    // catches a missing UserName but Hub login fails. Set both fields to
    // the same value so the column-of-truth question stays moot.
    private static TucClientContact BuildPrimaryContact(TenantAgentUpsertDto dto, string actor, DateTime now)
    {
        var (firstname, surname) = SplitContactName(dto.ContactName, dto.Name);
        var email = (dto.ContactEmail ?? string.Empty).Trim();
        return new TucClientContact
        {
            UcctEmail = email,
            UserName = email,                  // required for Hub login auth
            UcctFirstname = firstname,
            UcctSurname = surname,
            UcctMobile = dto.Phone ?? string.Empty,
            HasEmail = true,
            ValidatedEmail = false,
            Active = true,
            AllowCookieLogin = true,           // required for Hub shared-cookie auth
            StaffId = null,                     // NP user — no DF staff linkage
            Created = now,
            CreatedBy = actor,
            LastModified = now,
            LastModifiedBy = actor,
        };
    }

    // Splits a "Firstname Surname" string into the two components for
    // tucClientContact.UcctFirstname / UcctSurname.
    //
    //   "Jane Smith"          → ("Jane", "Smith")
    //   "Mary Jane Smith"     → ("Mary Jane", "Smith")     (surname = last token,
    //                                                       everything before = firstname)
    //   "Gaz"                 → ("Gaz", "")                (single token = firstname,
    //                                                       NOT surname — was a bug in
    //                                                       Phase 5+27 §A initial cut)
    //   "" / null             → ("Contact", agentName)     (defensive fallback so the
    //                                                       row is still recognisable
    //                                                       in tucClientContact lists)
    //
    // Uses last-space split because Western names typically have one surname
    // and any number of given/middle names — splitting on first space would
    // mis-classify "Mary Jane" as firstname=Mary, surname="Jane Smith".
    private static (string firstname, string surname) SplitContactName(string? contactName, string agentName)
    {
        var name = (contactName ?? string.Empty).Trim();
        if (name.Length == 0)
            return ("Contact", Truncate(agentName ?? string.Empty, 50));

        var lastSpace = name.LastIndexOf(' ');
        if (lastSpace < 0)
            return (Truncate(name, 50), string.Empty);
        return (Truncate(name[..lastSpace].Trim(), 50), Truncate(name[(lastSpace + 1)..].Trim(), 50));
    }

    // Mirrors NpApplicantService.GenerateCourierCode: first 6 alphanumeric
    // chars of the agent name, uppercased; numeric suffix on collision.
    // Scoped tenant-wide (no NP context needed — code is globally unique
    // within the tenant DB).
    private async Task<string> GenerateClientCodeAsync(string agentName)
    {
        var baseCode = new string((agentName ?? string.Empty)
                .Where(char.IsLetterOrDigit).ToArray())
            .ToUpperInvariant();
        if (baseCode.Length == 0) baseCode = "NPCLIENT";
        if (baseCode.Length > 16) baseCode = baseCode[..16];

        var taken = (await Context.TucClients.AsNoTracking()
                .Where(c => c.UcclCode != null && c.UcclCode.StartsWith(baseCode))
                .Select(c => c.UcclCode!)
                .ToListAsync())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (!taken.Contains(baseCode)) return baseCode;
        for (var i = 2; ; i++)
        {
            var candidate = baseCode + i;
            if (candidate.Length > 50) candidate = candidate[..50];
            if (!taken.Contains(candidate)) return candidate;
        }
    }

    private Task<bool> IsContactEmailTakenAsync(string email) =>
        Context.TucClientContacts.AsNoTracking()
            .AnyAsync(c => c.UcctEmail != null && c.UcctEmail == email);

    private static string Truncate(string? s, int maxLength)
    {
        if (string.IsNullOrEmpty(s)) return string.Empty;
        return s.Length <= maxLength ? s : s[..maxLength];
    }

    private static void ApplyUpdate(TucAgent a, TenantAgentUpsertDto dto)
    {
        a.UcagName = dto.Name;
        a.UcagPhone = dto.Phone;
        a.AddressLine1 = dto.AddressLine1;
        a.PostCode = dto.PostCode;
        a.StatusId = dto.StatusId;
        a.RankingId = dto.RankingId;
        a.IsNetworkPartner = dto.IsNetworkPartner;
        a.NpPortalEnabled = dto.NpPortalEnabled;
        a.NpTier = dto.NpTier;
        a.Notes = dto.Notes;

        // Pass-4 fields (migration 029).
        a.Association = dto.Association;
        a.AssociationMemberId = dto.AssociationMemberId;
        a.ContactName = dto.ContactName;
        a.ContactEmail = dto.ContactEmail;
        a.DefaultCourierPayPercent = dto.DefaultCourierPayPercent;
    }

    // Reconciles the AgentCoverageArea child rows against the desired set on
    // the DTO: drops rows no longer wanted, adds rows that are new.
    // Case-insensitive + de-duped so a careless caller can't create "Chicago"
    // twice. Works for both create (empty starting collection) and update
    // (collection loaded via Include).
    private void ApplyCoverageAreas(TucAgent agent, TenantAgentUpsertDto dto, string actor)
    {
        var desired = (dto.CoverageAreas ?? Enumerable.Empty<string>())
            .Select(s => (s ?? string.Empty).Trim())
            .Where(s => s.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        // Delete rows no longer wanted via the DbSet — RemoveRange marks them
        // Deleted directly. Removing them from agent.AgentCoverageAreas instead
        // would make EF try to null the non-nullable AgentId FK ("relationship
        // severed"), since the scaffolded FK has no cascade-delete configured.
        var stale = agent.AgentCoverageAreas
            .Where(ca => !desired.Contains(ca.AreaName, StringComparer.OrdinalIgnoreCase))
            .ToList();
        if (stale.Count > 0)
            Context.AgentCoverageAreas.RemoveRange(stale);

        // Add rows not already present. Stale rows linger in the collection
        // but their names are (by definition) absent from `desired`, so they
        // never block a re-add.
        var existing = agent.AgentCoverageAreas
            .Select(ca => ca.AreaName)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var name in desired.Where(d => !existing.Contains(d)))
            agent.AgentCoverageAreas.Add(new AgentCoverageArea
            {
                AreaName = name,
                CreatedDate = DateTime.UtcNow,
                CreatedBy = actor,
            });
    }

    private string ResolveActor() =>
        httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
        ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
        ?? "system";

    private static TenantAgentResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
    };

    // Shared projection — used by GetAll and the post-mutation read so the
    // shapes never drift between read and write paths.
    private static readonly Expression<Func<TucAgent, TenantAgentDto>> ProjectToDto = a => new TenantAgentDto
    {
        Id = a.UcagId,
        Name = a.UcagName ?? string.Empty,
        Phone = a.UcagPhone ?? string.Empty,
        AddressLine1 = a.AddressLine1 ?? a.UcagAddress ?? string.Empty,
        City = a.UcagSuburb != null ? (a.UcagSuburb.City ?? a.UcagSuburb.UcsuName ?? string.Empty) : string.Empty,
        State = a.AddressLine6 ?? string.Empty,
        PostCode = a.PostCode ?? string.Empty,
        StatusId = a.StatusId,
        StatusName = a.Status != null ? (a.Status.AgentStatusName ?? string.Empty) : string.Empty,
        RankingId = a.RankingId,
        RankingName = a.Ranking != null ? (a.Ranking.AgentRankingName ?? string.Empty) : string.Empty,
        IsNetworkPartner = a.IsNetworkPartner,
        NpPortalEnabled = a.NpPortalEnabled,
        NpTier = a.NpTier,
        Notes = a.Notes ?? a.UcagNotes ?? string.Empty,
        Association = a.Association ?? string.Empty,
        AssociationMemberId = a.AssociationMemberId ?? string.Empty,
        ContactName = a.ContactName ?? string.Empty,
        ContactEmail = a.ContactEmail ?? string.Empty,
        DefaultCourierPayPercent = a.DefaultCourierPayPercent,
        CoverageAreas = a.AgentCoverageAreas
            .OrderBy(ca => ca.AreaName)
            .Select(ca => ca.AreaName)
            .ToList(),
        // §A.1 — surfaces the linked TucClient.ClientTypeId for the picker.
        // Picks the lowest-Id active client where multiple linkages exist
        // (1:1 by §A construction, but defensive ordering doesn't hurt).
        ClientTypeId = a.TucClients
            .Where(c => c.UcclActive)
            .OrderBy(c => c.UcclId)
            .Select(c => (int?)c.ClientTypeId)
            .FirstOrDefault(),
        Created = a.Created,
        LastModified = a.LastModified,
    };
}
