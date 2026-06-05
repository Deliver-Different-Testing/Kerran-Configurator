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

        // Phase 5+27.2 — first-time NP transition (non-NP agent upgraded by
        // ticking IsNetworkPartner) needs to fire the full §A cascade,
        // mirroring CreateAsync. Detect via "no existing TucClients" — once
        // the cascade lands, future edits route through the propagation
        // loop instead. Pre-flight the email collision the same way Create
        // does so an upgrade with a duplicate email fails fast rather than
        // half-committing name/address changes.
        var isFirstTimeNpUpgrade = dto.IsNetworkPartner && agent.TucClients.Count == 0;
        if (isFirstTimeNpUpgrade && !string.IsNullOrWhiteSpace(dto.ContactEmail)
            && await IsContactEmailTakenAsync(dto.ContactEmail))
        {
            return Fail(messageId, $"Contact email \"{dto.ContactEmail}\" is already in use on another tucClientContact.");
        }

        var actor = ResolveActor();
        var now = DateTime.UtcNow;
        ApplyUpdate(agent, dto);
        await ApplyCoverageAreas(agent, dto, actor);

        var warnings = new List<string>();

        // First-time NP upgrade: build the cascade rows now. Same template-
        // clone + UcclCode generation + ClientTypeId default + optional
        // TucClientContact as CreateAsync uses.
        if (isFirstTimeNpUpgrade)
        {
            var template = await ResolveTemplateClientAsync();
            if (template is null)
            {
                // Soft-fail: name/address/coverage changes still go through;
                // operator sees a clear warning explaining why the cascade
                // didn't fire so they can fix tenant data + re-edit.
                warnings.Add("Agent upgraded to Network Partner but no TucClient row was created — no existing active tucClient rows on this tenant to inherit required-FK defaults from. Resolve at the tenant DB level + re-edit the agent to retry.");
            }
            else
            {
                var clientCode = await GenerateClientCodeAsync(dto.Name);
                var clientTypeId = dto.ClientTypeId ?? 3;
                await AddNpClientCascadeRows(agent, dto, template, clientCode, clientTypeId, actor, now, warnings);
            }
        }

        // Propagate identity fields to linked TucClient rows. For the just-
        // cascaded client this is a no-op (BuildNpClient already set the
        // same values from dto), so the redundancy is harmless. For pre-
        // existing NPs this is the canonical name/address-edit path.
        var contactAddedToExistingClient = false;
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

            // ContactEmail newly populated on an EXISTING NP client with no
            // contact yet → create the primary contact now. Skipped on the
            // first-time-upgrade path because AddNpClientCascadeRows already
            // handled it. Pre-existing contacts are not mutated here — that
            // lives on the §B per-user surface (Phase 5+28).
            if (!isFirstTimeNpUpgrade
                && client.TucClientContacts.Count == 0
                && !string.IsNullOrWhiteSpace(dto.ContactEmail))
            {
                if (await IsContactEmailTakenAsync(dto.ContactEmail))
                {
                    warnings.Add($"Primary contact not created — email \"{dto.ContactEmail}\" is already in use on another tucClientContact.");
                }
                else
                {
                    client.TucClientContacts.Add(BuildPrimaryContact(dto, actor, now, await ResolveNpAdminRoleIdAsync()));
                    contactAddedToExistingClient = true;
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

        // Hub invite fires for any newly-landed tucClientContact in this
        // transaction — whether from the first-time-cascade path or from
        // the existing-client contact-add path. Cross-DB call stays non-
        // atomic per §B.1 corrections; partial failures land as warnings.
        if ((isFirstTimeNpUpgrade || contactAddedToExistingClient)
            && !string.IsNullOrWhiteSpace(dto.ContactEmail))
        {
            await FireHubInviteAsync(dto.ContactEmail!, warnings);
        }

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
        await ApplyCoverageAreas(agent, dto, actor);

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
            await AddNpClientCascadeRows(agent, dto, template, clientCode, clientTypeId, actor, now, warnings);
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
            await FireHubInviteAsync(dto.ContactEmail!, warnings);
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

    // Shared TucClient + optional TucClientContact attach. Used by both
    // CreateAsync (brand-new NP agent) and UpdateAsync (existing agent
    // upgraded to NP). Caller must have already verified the dto is for an
    // NP, a template tucClient row exists, and any ContactEmail collision
    // check (CreateAsync fails fast, UpdateAsync also fails fast on first-
    // time upgrade — both before this helper is invoked). EF resolves the
    // generated UcagId / UcclId into the FKs during the caller's
    // SaveChangesAsync. Warns when ContactEmail is empty so the operator
    // knows no portal-login contact was created.
    private async Task AddNpClientCascadeRows(
        TucAgent agent,
        TenantAgentUpsertDto dto,
        TucClient template,
        string clientCode,
        int clientTypeId,
        string actor,
        DateTime now,
        List<string> warnings)
    {
        var client = BuildNpClient(dto, clientCode, clientTypeId, template, actor, now);
        agent.TucClients.Add(client);

        if (!string.IsNullOrWhiteSpace(dto.ContactEmail))
        {
            client.TucClientContacts.Add(BuildPrimaryContact(dto, actor, now, await ResolveNpAdminRoleIdAsync()));
        }
        else
        {
            warnings.Add("Network Partner created with no contact email — no login contact was created. Add a user on the NP team page (or re-edit the NP with a Contact Email) to issue a portal invite.");
        }
    }

    // Hub invite cascade — calls Hub's POST /api/admin/users via
    // NpUserInviteService and maps the three outcome states (fully succeeded,
    // partial success with Hub user but no email, complete failure) into
    // appropriate warning messages. Cross-DB call is non-atomic so partial
    // states surface to the operator rather than rolling back tenant rows.
    private async Task FireHubInviteAsync(string email, List<string> warnings)
    {
        var invite = await npUserInviteService.InviteAsync(email);
        if (invite.FullySucceeded)
        {
            warnings.Add($"Hub user provisioned and invite email sent to {email}. They can set their password from that email and log in.");
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
    private static TucClientContact BuildPrimaryContact(TenantAgentUpsertDto dto, string actor, DateTime now, int? primaryRoleId)
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
            // Phase 5+27.2 — Steve's §B.1: "Default role: NpAdmin — the first
            // user for an NP gets the admin role automatically." primaryRoleId
            // is the REAL NpAdmin ContactRoleId resolved BY NAME by the caller
            // (ResolveNpAdminRoleIdAsync) — NOT a hardcoded 1. On tenants where
            // legacy AdminManager seeded CRM labels first, NpAdmin is at 6/7/8,
            // and the old hardcoded 1 assigned "Decision Maker" instead (the
            // §3.6 collision). The resolver reads ContactRoleId via the Hub
            // NpRoleId/RoleId claim, so the single primary role is sufficient
            // (no junction row needed at cascade time).
            ContactRoleId = primaryRoleId,
            Created = now,
            CreatedBy = actor,
            LastModified = now,
            LastModifiedBy = actor,
        };
    }

    // Resolves the real NpAdmin ContactRoleId by NAME (it is at 6/7/8 on
    // collided tenants, not 1). Null if absent — contact is then role-less
    // (deny-by-default) rather than mis-assigned.
    private async Task<int?> ResolveNpAdminRoleIdAsync() =>
        await Context.TblContactRoles.AsNoTracking()
            .Where(r => r.Name == "NpAdmin" && r.IsActive)
            .Select(r => (int?)r.ContactRoleId)
            .FirstOrDefaultAsync();

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

    // Reconciles the AgentCoverageArea parent rows against the desired set
    // on the DTO: drops rows no longer wanted, adds rows that are new.
    // Case-insensitive + de-duped so a careless caller can't create
    // "Chicago" twice. Works for both create (empty starting collection)
    // and update (collection loaded via Include).
    //
    // Phase 5+29a §C — also resolves NEW parent rows' city names to their
    // ZipPolygon ids via ZipPolygonCity and inserts AgentCoverageAreaZipcode
    // child rows in the same SaveChanges. Stale parents cascade-delete
    // their children via the FK_AgentCoverageAreaZipcode_AgentCoverageArea
    // ON DELETE CASCADE constraint (no extra cleanup needed here). Soft-fail
    // when a city doesn't resolve (not in the ZipPolygonCity seed): the
    // parent still saves with zero children; the DTO surfaces the state via
    // HasZipMapping=false so the UI can render a "no zips mapped" badge.
    //
    // Existing parents whose names are unchanged get NO child backfill on
    // edit — we don't know if the operator wants their pre-§C parents
    // re-resolved. Operator can trigger a backfill by removing + re-adding
    // the chip (drops + recreates the parent, resolves on the new row).
    private async Task ApplyCoverageAreas(TucAgent agent, TenantAgentUpsertDto dto, string actor)
    {
        var desired = (dto.CoverageAreas ?? Enumerable.Empty<string>())
            .Select(s => (s ?? string.Empty).Trim())
            .Where(s => s.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        // Delete parents no longer wanted via the DbSet — RemoveRange marks
        // them Deleted directly. Removing them from agent.AgentCoverageAreas
        // instead would make EF try to null the non-nullable AgentId FK
        // ("relationship severed"), since the scaffolded FK has no
        // cascade-delete configured.
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
        var now = DateTime.UtcNow;
        foreach (var name in desired.Where(d => !existing.Contains(d)))
        {
            var parent = new AgentCoverageArea
            {
                AreaName = name,
                CreatedDate = now,
                CreatedBy = actor,
            };
            agent.AgentCoverageAreas.Add(parent);

            // Resolve city → zips via ZipPolygonCity. Distinct so a city
            // mapped to the same zip from multiple variants (USPS preferred
            // + alt-spelling rows) doesn't double-count. State disambiguator
            // is not exposed on the chip input yet — 5+29b adds it; for now
            // any state row matching the city name contributes.
            var zipIds = await Context.ZipPolygonCities.AsNoTracking()
                .Where(c => c.CityName == name)
                .Select(c => c.ZipPolygonId)
                .Distinct()
                .ToListAsync();
            foreach (var zipPolygonId in zipIds)
            {
                parent.AgentCoverageAreaZipcodes.Add(new AgentCoverageAreaZipcode
                {
                    ZipPolygonId = zipPolygonId,
                    CreatedDate = now,
                    CreatedBy = actor,
                });
            }
            // Empty zipIds → parent saves with no children. DTO surfaces
            // ZipCount=0 / HasZipMapping=false. Operator sees the chip but
            // downstream zip-based filtering gets nothing from this city
            // until the seed is updated.
        }
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
            .Select(ca => new TenantAgentCoverageAreaDto
            {
                AreaName = ca.AreaName,
                ZipCount = ca.AgentCoverageAreaZipcodes.Count(),
            })
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
