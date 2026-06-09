using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Application.Utilities;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using DfrntDriveConfigurator.Core.Domain.Master;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;
using System.Security.Claims;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

public class NpFleetService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    INpScopeResolver scopeResolver,
    MasterContext masterContext,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    public async Task<NpFleetCouriersResponse> GetAll(Guid messageId)
    {
        // Per-NP filtering: admins see all couriers in the tenant; NP users
        // see only couriers whose tucCourier.NpAgentId matches their scope.
        // NP users with no linkage get an empty list (defensive).
        var scope = await scopeResolver.ResolveAsync();

        var query = Context.TucCouriers.AsNoTracking();

        if (!scope.IsAdmin)
        {
            if (scope.NpAgentId is null)
            {
                return new NpFleetCouriersResponse(messageId)
                {
                    Success = true,
                    Couriers = [],
                };
            }
            query = query.Where(c => c.NpAgentId == scope.NpAgentId.Value);
        }

        var rows = await query
            .OrderByDescending(c => c.Active)
            .ThenBy(c => c.UccrSurname)
            .ThenBy(c => c.UccrName)
            .Select(ProjectToDto)
            .ToListAsync();

        await ApplyHasMobileLogin(rows);

        return new NpFleetCouriersResponse(messageId)
        {
            Success = true,
            Couriers = rows,
        };
    }

    // Sets HasMobileLogin on each row by looking up which emails have a
    // master-controller courier login. One IN query; tolerant of a master DB
    // read failure (leaves the flag null = "unknown" so the UI doesn't lie).
    private async Task ApplyHasMobileLogin(IReadOnlyCollection<NpFleetCourierDto> rows)
    {
        var emails = rows
            .Where(r => !string.IsNullOrWhiteSpace(r.Email))
            .Select(r => r.Email)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (emails.Count == 0) return;

        try
        {
            var withLogin = await masterContext.Users.AsNoTracking()
                .Where(u => u.IsCourier == true && emails.Contains(u.Email))
                .Select(u => u.Email)
                .ToListAsync();
            var set = new HashSet<string>(withLogin, StringComparer.OrdinalIgnoreCase);
            foreach (var r in rows)
            {
                r.HasMobileLogin = !string.IsNullOrWhiteSpace(r.Email) && set.Contains(r.Email);
            }
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Could not determine mobile-login status from the master-controller DB; leaving it unknown");
        }
    }

    public async Task<NpFleetCourierResponse> UpdateAsync(int id, NpFleetCourierUpdateDto dto, Guid messageId)
    {
        var scope = await scopeResolver.ResolveAsync();

        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return Fail(messageId, "No NP scope configured for this user.");
        }

        // Tracked load — we mutate this entity in-place.
        var query = Context.TucCouriers.AsQueryable();
        if (!scope.IsAdmin)
        {
            // NP users can only edit couriers within their NpAgentId scope.
            // The same Where() guards both "courier doesn't exist" and "courier
            // belongs to a different NP" — both surface as "not found", so an
            // NP user can't probe other NPs' courier IDs by edit attempts.
            query = query.Where(c => c.NpAgentId == scope.NpAgentId!.Value);
        }

        var courier = await query.FirstOrDefaultAsync(c => c.UccrId == id);
        if (courier is null)
        {
            return Fail(messageId, "Courier not found or outside your scope.");
        }

        // Captured before ApplyUpdate mutates it — used to keep the courier's
        // master-controller login email in sync if the email is changed here
        // (the login username IS the email; an un-migrated change breaks login).
        var originalEmail = courier.UccrEmail;

        // Master/Sub + NP relationship — resolved + validated server-side
        // (GARRY-NP-SUB-INHERIT-NP). Authoritative rule: a Sub INHERITS its
        // master's NpAgentId, so an admin-created/edited sub under an NP master
        // lands under that NP instead of Direct. CourierTypeId null = "unchanged"
        // (keep current); master falls back to the courier's existing master so
        // re-saving a sub's other fields doesn't require re-sending it.
        var rel = await ResolveRelationshipAsync(
            courierTypeId: dto.CourierTypeId ?? courier.CourierTypeId,
            masterCourierId: dto.MasterCourierId ?? courier.MasterCourierId,
            requestedNpAgentId: dto.NpAgentId,
            scope: scope,
            currentCourierId: courier.UccrId);
        if (!rel.Success)
            return Fail(messageId, rel.Error!);
        courier.CourierTypeId = rel.CourierTypeId;
        courier.MasterCourierId = rel.MasterCourierId;
        courier.NpAgentId = rel.NpAgentId;

        // Payment channel (Kerran): enum-validate only. The cross-field rules
        // (Invoice needs an Openforce/Xero downstream target) are enforced by
        // the settlement pre-flight (ValidateBatchAsync), not the editor.
        if (dto.PaymentMethod is { Length: > 0 } pm)
        {
            var method = pm.Trim();
            if (method is not ("Direct" or "Invoice" or "None"))
                return Fail(messageId, "Invalid Payment Method — must be Direct, Invoice or None.");
            courier.PaymentMethod = method;
        }

        ApplyUpdate(courier, dto);

        // Audit fields. Email claim is set by Hub at login (ClaimTypes.Name).
        var email = httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
                    ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
                    ?? "system";
        courier.LastModified = DateTime.UtcNow;
        courier.LastModifiedBy = email;

        await Context.SaveChangesAsync();

        // Keep the master-controller login email in sync with an email change.
        // Best-effort + logged: the courier edit (the primary action) has already
        // committed, and the fallback if this is skipped is "login still works
        // under the old email" — far less severe than the create path, which is
        // why this doesn't roll back. Provisioning a login for couriers that
        // never had one (self-heal) needs a password and is a separate slice.
        var newEmail = courier.UccrEmail;
        if (!string.IsNullOrWhiteSpace(originalEmail) &&
            !string.IsNullOrWhiteSpace(newEmail) &&
            !string.Equals(originalEmail, newEmail, StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var login = await masterContext.Users
                    .FirstOrDefaultAsync(u => u.Email == originalEmail && u.IsCourier == true);
                if (login is not null)
                {
                    var clash = await masterContext.Users.AsNoTracking().AnyAsync(u => u.Email == newEmail);
                    if (clash)
                    {
                        Log.Warning("Courier {Id} email changed to {Email} but a login already exists there; mobile login email not migrated", id, newEmail);
                    }
                    else
                    {
                        login.Email = newEmail;
                        await masterContext.SaveChangesAsync();
                    }
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to migrate master-controller login email for courier {Id}", id);
            }
        }

        // Re-project so the response shape exactly matches GetAll's read model.
        var read = await Context.TucCouriers.AsNoTracking()
            .Where(c => c.UccrId == id)
            .Select(ProjectToDto)
            .FirstOrDefaultAsync();
        if (read is not null) await ApplyHasMobileLogin(new[] { read }); // email may have changed

        return new NpFleetCourierResponse(messageId)
        {
            Success = true,
            Courier = read,
        };
    }

    public async Task<NpFleetCourierResponse> CreateAsync(NpFleetCourierCreateDto dto, Guid messageId)
    {
        var scope = await scopeResolver.ResolveAsync();

        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return Fail(messageId, "No NP scope configured for this user.");
        }

        var code = (dto.Code ?? string.Empty).Trim();
        var firstName = (dto.FirstName ?? string.Empty).Trim();
        var surName = (dto.SurName ?? string.Empty).Trim();
        var email = (dto.Email ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(code))
        {
            return Fail(messageId, "Courier code is required.");
        }

        if (string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(surName))
        {
            return Fail(messageId, "First name and surname are required.");
        }

        var password = dto.Password ?? string.Empty;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Fail(messageId, "Email is required — the courier signs in to the mobile app with it.");
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            return Fail(messageId, "Password is required — the courier needs it to sign in to the mobile app.");
        }

        // The master-controller login is bound to a tenant (marsapi resolves the
        // courier's Despatch DB via User.CurrentTenant). Without it the login row
        // would be unusable, so require the claim up front.
        var currentTenantIdClaim = httpContextAccessor.HttpContext?.User.FindFirst("CurrentTenantID")?.Value;
        if (!int.TryParse(currentTenantIdClaim, out var currentTenantId))
        {
            return Fail(messageId, "Could not determine the current tenant — cannot provision the courier's mobile login.");
        }

        // A master-controller login is keyed by email (unique across the whole
        // User table — couriers and contacts). Pre-check so a clash surfaces
        // cleanly instead of as a unique-index violation when we add the row.
        if (await masterContext.Users.AsNoTracking().AnyAsync(u => u.Email == email))
        {
            return Fail(messageId, $"A login already exists for \"{email}\". Use a different email.");
        }

        // Code, name and email pre-checks — tenant-wide. tucCourier has a
        // UNIQUE index on (uccrName, uccrSurname), so a name clash would
        // otherwise surface as a raw DbUpdateException; the explicit check
        // turns it into a clean message. Code/email aren't DB-unique but a
        // duplicate is almost always a mistake worth flagging.
        if (await Context.TucCouriers.AsNoTracking().AnyAsync(c => c.Code == code))
        {
            return Fail(messageId, $"Courier code \"{code}\" is already in use.");
        }

        if (await Context.TucCouriers.AsNoTracking()
                .AnyAsync(c => c.UccrName == firstName && c.UccrSurname == surName))
        {
            return Fail(messageId, $"A courier named \"{firstName} {surName}\" already exists.");
        }

        if (!string.IsNullOrWhiteSpace(email) &&
            await Context.TucCouriers.AsNoTracking().AnyAsync(c => c.UccrEmail == email))
        {
            return Fail(messageId, $"Courier email \"{email}\" is already in use.");
        }

        var userEmail = httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
                        ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
                        ?? "system";
        var now = DateTime.UtcNow;

        // Master/Sub + NP relationship (GARRY-NP-SUB-INHERIT-NP). A Sub inherits
        // its master's NpAgentId so it doesn't land as Direct; type null/0
        // defaults to Independent (1).
        var rel = await ResolveRelationshipAsync(
            courierTypeId: dto.CourierTypeId is int t && t > 0 ? t : 1,
            masterCourierId: dto.MasterCourierId,
            requestedNpAgentId: dto.NpAgentId,
            scope: scope,
            currentCourierId: null);
        if (!rel.Success)
            return Fail(messageId, rel.Error!);

        var courier = new TucCourier
        {
            Code = code,
            UccrName = firstName,
            UccrSurname = surName,
            UccrEmail = email,
            PersonalMobile = (dto.Mobile ?? string.Empty).Trim(),
            UccrVehicle = (dto.VehicleType ?? string.Empty).Trim(),
            UccrNotes = dto.Notes ?? string.Empty,

            // Role / master / inherited-or-explicit NP from the resolver.
            CourierTypeId = rel.CourierTypeId,
            MasterCourierId = rel.MasterCourierId,
            NpAgentId = rel.NpAgentId,
            // New couriers default to Direct payment (matches the DB default).
            PaymentMethod = "Direct",
            Active = true,

            // Plaintext on tucCourier for AdminManager parity (its Update path
            // re-hashes from here); the hashed copy goes to master-controller
            // below. Web-enabled so the tenant-side MARSWS_stpIsValidLogin gate
            // (called by marsapi after the password check) also passes.
            UccrPassword = password,
            UccrWebEnabled = true,

            Created = now,
            CreatedBy = userEmail,
            LastModified = now,
            LastModifiedBy = userEmail,
        };

        Context.TucCouriers.Add(courier);
        await Context.SaveChangesAsync();

        // Provision the master-controller login (IsCourier = 1) so the courier
        // can sign in to the mobile app. The two databases can't share a
        // transaction (separate servers/connections), so on failure we
        // compensate by removing the courier we just inserted — the operation is
        // all-or-nothing from the operator's view, and they can cleanly retry.
        // This is deliberately NOT AdminManager's swallow-and-return-success.
        try
        {
            var hashed = CourierPasswordHasher.SaltHashNewPassword(password);
            masterContext.Users.Add(new User
            {
                Email = email,
                Password = hashed.Hashed,
                Salt = hashed.Salt,
                CurrentTenantId = currentTenantId,
                IsCourier = true,
                IsLegacyHash = false,
            });
            await masterContext.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Failed to provision master-controller login for courier {Code}; rolling back tenant insert", code);
            try
            {
                Context.TucCouriers.Remove(courier);
                await Context.SaveChangesAsync();
            }
            catch (Exception rollbackEx)
            {
                Log.Error(rollbackEx, "Rollback of courier {Code} (id {Id}) failed after login-provisioning error", code, courier.UccrId);
                return Fail(messageId,
                    $"The courier was created but their mobile login could not be set up, and automatic cleanup failed. Please remove courier #{courier.UccrId} and try again.");
            }

            return Fail(messageId,
                "The courier's mobile login could not be set up, so no courier was created. Please try again.");
        }

        // Re-project so the response shape exactly matches GetAll's read model.
        var read = await Context.TucCouriers.AsNoTracking()
            .Where(c => c.UccrId == courier.UccrId)
            .Select(ProjectToDto)
            .FirstOrDefaultAsync();
        if (read is not null) read.HasMobileLogin = true; // just provisioned above

        return new NpFleetCourierResponse(messageId)
        {
            Success = true,
            Courier = read,
        };
    }

    // Set / reset the courier's mobile-app login password. Upserts the
    // master-controller User row: updates it if present, CREATES it if missing
    // (so this also provisions/heals couriers that never had a login — e.g.
    // those added before login provisioning existed). The login username is the
    // courier's email, so it must be set first.
    public async Task<NpFleetCourierResponse> ResetLoginAsync(int id, NpFleetCourierResetLoginDto dto, Guid messageId)
    {
        var scope = await scopeResolver.ResolveAsync();

        if (!scope.IsAdmin && scope.NpAgentId is null)
        {
            return Fail(messageId, "No NP scope configured for this user.");
        }

        var query = Context.TucCouriers.AsQueryable();
        if (!scope.IsAdmin)
        {
            query = query.Where(c => c.NpAgentId == scope.NpAgentId!.Value);
        }

        var courier = await query.FirstOrDefaultAsync(c => c.UccrId == id);
        if (courier is null)
        {
            return Fail(messageId, "Courier not found or outside your scope.");
        }

        var password = dto.Password ?? string.Empty;
        if (string.IsNullOrWhiteSpace(password))
        {
            return Fail(messageId, "Password is required.");
        }

        var courierEmail = (courier.UccrEmail ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(courierEmail))
        {
            return Fail(messageId, "This courier has no email address. Add an email on the Profile tab before setting a mobile-app password (it's their sign-in username).");
        }

        var currentTenantIdClaim = httpContextAccessor.HttpContext?.User.FindFirst("CurrentTenantID")?.Value;
        if (!int.TryParse(currentTenantIdClaim, out var currentTenantId))
        {
            return Fail(messageId, "Could not determine the current tenant — cannot set the courier's mobile login.");
        }

        // Tenant-side write first: web-enable (so the marsapi login's
        // MARSWS_stpIsValidLogin gate passes) and store the plaintext for
        // AdminManager parity. Both are benign + idempotent, so no rollback is
        // needed if the master write below fails — a retry just re-applies them.
        var actor = httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
                    ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
                    ?? "system";
        courier.UccrPassword = password;
        courier.UccrWebEnabled = true;
        courier.LastModified = DateTime.UtcNow;
        courier.LastModifiedBy = actor;
        await Context.SaveChangesAsync();

        try
        {
            var hashed = CourierPasswordHasher.SaltHashNewPassword(password);
            var login = await masterContext.Users
                .FirstOrDefaultAsync(u => u.Email == courierEmail && u.IsCourier == true);

            if (login is null)
            {
                // Provision / heal. Don't collide with a non-courier login on the
                // same email (the unique index spans the whole User table).
                var nonCourierClash = await masterContext.Users.AsNoTracking()
                    .AnyAsync(u => u.Email == courierEmail && (u.IsCourier == null || u.IsCourier == false));
                if (nonCourierClash)
                {
                    return Fail(messageId, $"A non-courier login already exists for \"{courierEmail}\", so a courier login can't be created for it.");
                }

                masterContext.Users.Add(new User
                {
                    Email = courierEmail,
                    Password = hashed.Hashed,
                    Salt = hashed.Salt,
                    CurrentTenantId = currentTenantId,
                    IsCourier = true,
                    IsLegacyHash = false,
                });
            }
            else
            {
                login.Password = hashed.Hashed;
                login.Salt = hashed.Salt;
                login.IsLegacyHash = false;
                login.CurrentTenantId ??= currentTenantId; // don't move an existing login to another tenant
            }

            await masterContext.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Failed to set master-controller login for courier {Id}", id);
            return Fail(messageId, "The mobile-app password could not be set. Please try again.");
        }

        var read = await Context.TucCouriers.AsNoTracking()
            .Where(c => c.UccrId == id)
            .Select(ProjectToDto)
            .FirstOrDefaultAsync();
        if (read is not null) read.HasMobileLogin = true; // just provisioned above

        return new NpFleetCourierResponse(messageId)
        {
            Success = true,
            Courier = read,
        };
    }

    private static NpFleetCourierResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new() { Message = message } },
    };

    // Resolves + validates the Master/Sub + Network-Partner relationship for a
    // create/update (GARRY-NP-SUB-INHERIT-NP). Returns the values to persist.
    //   • Sub (3): requires a master that exists, isn't itself, isn't a Sub —
    //     and INHERITS the master's NpAgentId (the headline fix).
    //   • Non-Master with attached subs: blocked (would orphan them).
    //   • Non-sub NP: admin/tenant may set NpAgentId explicitly; NP users are
    //     forced to their own scope.
    private async Task<(bool Success, string? Error, int CourierTypeId, int? MasterCourierId, int? NpAgentId)> ResolveRelationshipAsync(
        int courierTypeId, int? masterCourierId, int? requestedNpAgentId, NpScope scope, int? currentCourierId)
    {
        if (courierTypeId is < 1 or > 4)
            return (false, "Courier type is invalid.", 0, null, null);

        if (courierTypeId == 3)
        {
            if (masterCourierId is null)
                return (false, "A Sub courier must have a master courier assigned.", 0, null, null);
            if (currentCourierId.HasValue && masterCourierId.Value == currentCourierId.Value)
                return (false, "A courier cannot be their own master.", 0, null, null);

            var master = await Context.TucCouriers.AsNoTracking()
                .Where(c => c.UccrId == masterCourierId.Value)
                .Select(c => new { c.UccrId, c.CourierTypeId, c.NpAgentId })
                .FirstOrDefaultAsync();
            if (master is null)
                return (false, "Selected master courier was not found.", 0, null, null);
            if (master.CourierTypeId == 3)
                return (false, "A subcontractor cannot be used as a master courier.", 0, null, null);

            // INHERIT the master's NP — this is the rule the bug was missing.
            return (true, null, 3, master.UccrId, master.NpAgentId);
        }

        // Changing a courier that still has attached subs to anything other than
        // Master would orphan them.
        if (currentCourierId.HasValue && courierTypeId != 2)
        {
            var hasAttachedSubs = await Context.TucCouriers.AsNoTracking()
                .AnyAsync(c => c.MasterCourierId == currentCourierId.Value);
            if (hasAttachedSubs)
                return (false, "This courier still has attached subs. Reassign them before changing its type.", 0, null, null);
        }

        // Non-sub: NP users are forced to their own scope; admin/tenant set it
        // explicitly (null = Direct).
        var npAgentId = scope.IsAdmin ? requestedNpAgentId : scope.NpAgentId;
        return (true, null, courierTypeId, null, npAgentId);
    }

    private static void ApplyUpdate(TucCourier c, NpFleetCourierUpdateDto dto)
    {
        // Role / master / NP are resolved + assigned in UpdateAsync via
        // ResolveRelationshipAsync (Sub inherits the master's NP), so they're
        // intentionally not set here.

        // Profile
        c.UccrName = dto.FirstName;
        c.UccrSurname = dto.SurName;
        c.UccrEmail = dto.Email;
        c.UccrMobile = dto.Phone;
        c.PersonalMobile = dto.Mobile;
        c.UccrTel = dto.HomePhone;
        c.Gender = dto.Gender;
        c.UccrDob = dto.Dob;
        c.AddressLine1 = dto.Address;
        c.UccrDoctor = dto.Doctor;
        c.UccrDoctorPhone = dto.DoctorPhone;
        c.UccrKinName = dto.NextOfKin;
        c.UccrKinRelationship = dto.NokRelationship;
        c.UccrKinAdd = dto.NokAddress;
        c.UccrKinTel = dto.NokPhone;
        c.UccrStartDate = dto.StartDate;
        c.UccrFinishDate = dto.FinishDate;
        c.Active = dto.Active;

        // Vehicle
        c.UccrVehicle = dto.Vehicle;
        c.UccrVehicleMakeId = dto.MakeId;
        c.UccrVehicleModel = dto.Model;
        c.UccrVehicleYear = dto.Year;
        c.UccrReg = dto.Rego;
        c.LowEmissionVehicle = dto.LowEmission;
        c.MaxPallets = dto.MaxPallets;
        c.TareWeight = dto.TareWeight;
        c.MaxPayload = dto.MaxCarry;
        c.Rucweight = dto.RucWeight;
        c.Ruckms = dto.RucKms;
        c.Rucpayload = dto.RucPayload;
        c.Height = dto.Height;
        c.Width = dto.Width;
        c.Length = dto.Length;
        c.Wofexpiry = dto.InspectionExpiry;
        c.RegistrationExpiry = dto.RegoExpiry;

        // Licensing
        c.UccrDlno = dto.DlNo;
        c.DriversLicenseExpiry = dto.DlExpiry;
        c.UccrDangerousGoods = dto.DangerousGoods ? (byte)1 : (byte)0;
        c.DglicenseExpiry = dto.DgExpiry;
        c.HeavyTransportEndorcement = dto.Hte;
        c.OpenForceNumber = dto.TslNo;

        // Insurance
        c.UccrPolicyNo = dto.PolicyNo;
        c.UccrInsuranceId = dto.InsuranceCoId;
        c.UccrCarrierLiabilityId = dto.CarrierLiabId;
        c.UccrPublicLiabilityId = dto.PublicLiabId;
        c.CommercialInsurance = dto.CommercialIns;

        // Financial
        c.UccrGst = dto.TaxId;
        c.WithholdingTaxPercentage = dto.Wht;
        c.UccrBankAccountNo = dto.BankAcct;
        c.UccrPercentage = dto.PayPct;
        c.BonusPercentage = dto.BonusPct;
        c.SubContractorPercentage = dto.SubContractorPercentage;
        c.SubContractorFuelPercentage = dto.SubContractorFuelPercentage;
        c.SubContractorBonusPercentage = dto.SubContractorBonusPercentage;
        c.PaydayFileRegistration = dto.PaydayReg;
        c.UccrContractDate = dto.ContractSigned;
        c.UccrSecurityDate = dto.SecurityCheck;

        // Device & settings
        c.DeviceAdmin = dto.DeviceAdmin;
        c.VodafoneNetwork = dto.Vodafone;
        c.SendJobsViaSms = dto.SmsJob;
        c.SendAlertSms = dto.SmsAlert;
        c.UccrWebEnabled = dto.WebEnabled;
        c.AutoDespatch = dto.AutoDispatch;
        c.UccrShowClientPh = dto.ShowClientPhone;
        c.DisplayWeb = dto.DisplayWeb;
        c.Podreqd = dto.PodRequired;
        c.ExpectedStartTime = dto.StartTime;
        c.ExpectedEndTime = dto.EndTime;

        // Notes
        c.UccrNotes = dto.Notes;
    }

    // Shared projection — used by both GetAll and the post-update read so the
    // shapes can never drift.
    private static readonly Expression<Func<TucCourier, NpFleetCourierDto>> ProjectToDto = c => new NpFleetCourierDto
    {
        // Identity / links
        Id = c.UccrId,
        Code = c.Code ?? string.Empty,
        MasterCourierId = c.MasterCourierId,
        CourierTypeId = c.CourierTypeId,
        NpAgentId = c.NpAgentId,
        NpAgentName = c.NpAgent != null ? (c.NpAgent.UcagName ?? string.Empty) : string.Empty,
        PaymentMethod = c.PaymentMethod ?? "Direct",

        // Profile
        FirstName = c.UccrName ?? string.Empty,
        SurName = c.UccrSurname ?? string.Empty,
        Email = c.UccrEmail ?? string.Empty,
        Phone = c.UccrMobile ?? string.Empty,
        Mobile = c.PersonalMobile ?? string.Empty,
        HomePhone = c.UccrTel ?? string.Empty,
        Gender = c.Gender,
        Dob = c.UccrDob,
        Address = c.AddressLine1 ?? c.UccrAddress ?? string.Empty,
        Doctor = c.UccrDoctor ?? string.Empty,
        DoctorPhone = c.UccrDoctorPhone ?? string.Empty,
        NextOfKin = c.UccrKinName ?? string.Empty,
        NokRelationship = c.UccrKinRelationship ?? string.Empty,
        NokAddress = c.UccrKinAdd ?? string.Empty,
        NokPhone = c.UccrKinTel ?? string.Empty,
        StartDate = c.UccrStartDate,
        FinishDate = c.UccrFinishDate,
        Active = c.Active,

        // Vehicle
        Vehicle = c.UccrVehicle ?? string.Empty,
        MakeId = c.UccrVehicleMakeId,
        Make = c.UccrVehicleMake != null ? (c.UccrVehicleMake.UcvmName ?? string.Empty) : string.Empty,
        Model = c.UccrVehicleModel ?? string.Empty,
        Year = c.UccrVehicleYear,
        Rego = c.UccrReg ?? string.Empty,
        LowEmission = c.LowEmissionVehicle ?? false,
        MaxPallets = c.MaxPallets,
        TareWeight = c.TareWeight,
        MaxCarry = c.MaxPayload,
        RucWeight = c.Rucweight,
        RucKms = c.Ruckms,
        RucPayload = c.Rucpayload,
        Height = c.Height,
        Width = c.Width,
        Length = c.Length,
        InspectionExpiry = c.Wofexpiry,
        RegoExpiry = c.RegistrationExpiry,

        // Licensing
        DlNo = c.UccrDlno ?? string.Empty,
        DlExpiry = c.DriversLicenseExpiry,
        DangerousGoods = c.UccrDangerousGoods != 0,
        DgExpiry = c.DglicenseExpiry,
        Hte = c.HeavyTransportEndorcement ?? false,
        TslNo = c.OpenForceNumber ?? string.Empty,

        // Insurance — three FKs all into tucInsuranceCompany via nav properties.
        PolicyNo = c.UccrPolicyNo ?? string.Empty,
        InsuranceCoId = c.UccrInsuranceId,
        InsuranceCo = c.UccrInsurance != null ? (c.UccrInsurance.UcicName ?? string.Empty) : string.Empty,
        CarrierLiabId = c.UccrCarrierLiabilityId,
        CarrierLiabCompany = c.UccrCarrierLiability != null ? (c.UccrCarrierLiability.UcicName ?? string.Empty) : string.Empty,
        PublicLiabId = c.UccrPublicLiabilityId,
        PublicLiabCompany = c.UccrPublicLiability != null ? (c.UccrPublicLiability.UcicName ?? string.Empty) : string.Empty,
        CommercialIns = c.CommercialInsurance ?? false,

        // Financial
        TaxId = c.UccrGst ?? string.Empty,
        Wht = c.WithholdingTaxPercentage,
        BankAcct = c.UccrBankAccountNo ?? string.Empty,
        PayPct = c.UccrPercentage,
        BonusPct = c.BonusPercentage,
        SubContractorPercentage = c.SubContractorPercentage,
        SubContractorFuelPercentage = c.SubContractorFuelPercentage,
        SubContractorBonusPercentage = c.SubContractorBonusPercentage,
        PaydayReg = c.PaydayFileRegistration ?? false,
        ContractSigned = c.UccrContractDate,
        SecurityCheck = c.UccrSecurityDate,

        // Device & settings
        DeviceAdmin = c.DeviceAdmin ?? false,
        Vodafone = c.VodafoneNetwork,
        SmsJob = c.SendJobsViaSms,
        SmsAlert = c.SendAlertSms,
        WebEnabled = c.UccrWebEnabled,
        AutoDispatch = c.AutoDespatch,
        ShowClientPhone = c.UccrShowClientPh,
        DisplayWeb = c.DisplayWeb,
        PodRequired = c.Podreqd ?? false,
        StartTime = c.ExpectedStartTime,
        EndTime = c.ExpectedEndTime,

        // Notes & audit
        Notes = c.UccrNotes ?? string.Empty,
        Created = c.Created,
        CreatedBy = c.CreatedBy ?? string.Empty,
        Modified = c.LastModified,
        ModifiedBy = c.LastModifiedBy ?? string.Empty,
    };
}
