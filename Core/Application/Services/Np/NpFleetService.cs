using System;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

public class NpFleetService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    INpScopeResolver scopeResolver,
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

        return new NpFleetCouriersResponse(messageId)
        {
            Success = true,
            Couriers = rows,
        };
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

        ApplyUpdate(courier, dto);

        // Audit fields. Email claim is set by Hub at login (ClaimTypes.Name).
        var email = httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
                    ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
                    ?? "system";
        courier.LastModified = DateTime.UtcNow;
        courier.LastModifiedBy = email;

        await Context.SaveChangesAsync();

        // Re-project so the response shape exactly matches GetAll's read model.
        var read = await Context.TucCouriers.AsNoTracking()
            .Where(c => c.UccrId == id)
            .Select(ProjectToDto)
            .FirstOrDefaultAsync();

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

        var courier = new TucCourier
        {
            Code = code,
            UccrName = firstName,
            UccrSurname = surName,
            UccrEmail = email,
            PersonalMobile = (dto.Mobile ?? string.Empty).Trim(),
            UccrVehicle = (dto.VehicleType ?? string.Empty).Trim(),
            UccrNotes = dto.Notes ?? string.Empty,

            // Quick-add couriers are standalone Master couriers (CourierType
            // 2). A Sub courier (type 3) would need a master assigned, which
            // the lean quick-add form doesn't capture.
            CourierTypeId = 2,
            Active = true,

            // NP users' new couriers belong to their own NP scope; couriers
            // created by an admin stay unassigned (NpAgentId null) until an
            // NP picks them up.
            NpAgentId = scope.IsAdmin ? null : scope.NpAgentId,

            Created = now,
            CreatedBy = userEmail,
            LastModified = now,
            LastModifiedBy = userEmail,
        };

        Context.TucCouriers.Add(courier);
        await Context.SaveChangesAsync();

        // Re-project so the response shape exactly matches GetAll's read model.
        var read = await Context.TucCouriers.AsNoTracking()
            .Where(c => c.UccrId == courier.UccrId)
            .Select(ProjectToDto)
            .FirstOrDefaultAsync();

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

    private static void ApplyUpdate(TucCourier c, NpFleetCourierUpdateDto dto)
    {
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
