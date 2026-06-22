using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Portal;
using DfrntDriveConfigurator.Core.Application.Utilities;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using DfrntDriveConfigurator.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Portal;

// Thrown for applicant-facing validation failures; the controller maps it to a
// 400 with { message }. Keeps the service free of MVC types.
public class PortalException(string message) : Exception(message);

// Courier Portal Phase 1 — applicant self-service write side.
//
// Reuses the legacy CourierApplicant table (already scaffolded; the NP-side
// recruitment pipeline reads/manages it via NpApplicantService). This service
// adds register / verify / login / refresh / resume. Auth is the signed-token
// pattern (PortalSessionTokenService), NOT JWT. Passwords are hashed with the
// shared CourierPasswordHasher into the new PasswordHash/PasswordSalt columns
// (migration 044) — the legacy plaintext Password column is left null.
//
// All DB access goes through the context factory, which resolves the tenant via
// the OverrideTenantIdItemsKey stamped by PortalRequestFilter.
public class PortalApplicantService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    PortalSessionTokenService tokenService,
    IPortalTenantContext portalTenant,
    AppSettings appSettings)
{
    private const int MaxVerificationAttempts = 5;

    public async Task<PortalRegisterResultDto> RegisterAsync(PortalRegisterDto dto, string baseUrl, CancellationToken ct)
    {
        var email = (dto.Email ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(dto.FirstName)) throw new PortalException("First name is required.");
        if (string.IsNullOrWhiteSpace(dto.LastName)) throw new PortalException("Last name is required.");
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) throw new PortalException("A valid email is required.");
        if (string.IsNullOrWhiteSpace(dto.Mobile)) throw new PortalException("Mobile number is required.");
        if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 6)
            throw new PortalException("Password must be at least 6 characters.");

        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        var emailLower = email.ToLower();
        var applicantExists = await ctx.CourierApplicants
            .AnyAsync(a => a.Email != null && a.Email.ToLower() == emailLower, ct);
        if (applicantExists) throw new PortalException("An application with this email already exists. Try signing in instead.");

        var courierExists = await ctx.TucCouriers
            .AnyAsync(c => c.UccrEmail != null && c.UccrEmail.ToLower() == emailLower, ct);
        if (courierExists) throw new PortalException("An account with this email already exists. Try signing in instead.");

        var salted = CourierPasswordHasher.SaltHashNewPassword(dto.Password);
        var code = GenerateVerificationCode();
        var now = DateTime.UtcNow;

        var applicant = new CourierApplicant
        {
            Created = now,
            ModifiedDate = now,
            FirstName = dto.FirstName.Trim(),
            Surname = dto.LastName.Trim(),
            Email = email,
            Mobile = dto.Mobile.Trim(),
            VehicleType = dto.VehicleType?.Trim(),
            EmailVerified = false,
            EmailVerificationCode = code,
            EmailVerificationAttempts = 0,
            // New portal authenticates via the hash columns; legacy plaintext
            // Password is left null (migration 044 made it nullable).
            PasswordHash = salted.Hashed,
            PasswordSalt = salted.Salt,
        };

        ctx.CourierApplicants.Add(applicant);
        await ctx.SaveChangesAsync(ct);

        await QueueVerificationEmailAsync(ctx, applicant, code, baseUrl, ct);

        return new PortalRegisterResultDto { Email = applicant.Email, EmailVerified = false };
    }

    public async Task<PortalSessionDto> VerifyEmailAsync(PortalVerifyEmailDto dto, CancellationToken ct)
    {
        var email = (dto.Email ?? string.Empty).Trim().ToLower();
        var code = (dto.Code ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code))
            throw new PortalException("Email and verification code are required.");

        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var applicant = await ctx.CourierApplicants
            .FirstOrDefaultAsync(a => a.Email != null && a.Email.ToLower() == email, ct);
        if (applicant == null) throw new PortalException("No application found for that email.");

        // Already verified — treat as idempotent success and re-issue a session.
        if (!applicant.EmailVerified)
        {
            if (applicant.EmailVerificationAttempts >= MaxVerificationAttempts)
                throw new PortalException("Too many incorrect attempts. Please contact support to reset your application.");

            if (!string.Equals(applicant.EmailVerificationCode, code, StringComparison.Ordinal))
            {
                applicant.EmailVerificationAttempts += 1;
                applicant.ModifiedDate = DateTime.UtcNow;
                await ctx.SaveChangesAsync(ct);
                throw new PortalException("Incorrect verification code.");
            }

            applicant.EmailVerified = true;
            applicant.ModifiedDate = DateTime.UtcNow;
            await ctx.SaveChangesAsync(ct);
        }

        return BuildSession(applicant);
    }

    public async Task<PortalSessionDto> LoginAsync(PortalLoginDto dto, CancellationToken ct)
    {
        var email = (dto.Email ?? string.Empty).Trim().ToLower();
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(dto.Password))
            throw new PortalException("Email and password are required.");

        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var applicant = await ctx.CourierApplicants
            .FirstOrDefaultAsync(a => a.Email != null && a.Email.ToLower() == email, ct);

        // Uniform "invalid credentials" — don't leak which part failed. Legacy
        // courierportal applicants (plaintext Password, no PasswordHash) cannot
        // sign in here; they use the legacy portal during cutover.
        if (applicant == null || string.IsNullOrEmpty(applicant.PasswordHash) || string.IsNullOrEmpty(applicant.PasswordSalt))
            throw new PortalException("Invalid email or password.");

        if (!applicant.EmailVerified)
            throw new PortalException("Please verify your email before signing in.");

        if (applicant.CourierId.HasValue)
            throw new PortalException("This application has already been approved. Please use the courier portal to sign in.");

        var attempt = CourierPasswordHasher.HashPassword(dto.Password, applicant.PasswordSalt);
        if (!string.Equals(attempt, applicant.PasswordHash, StringComparison.Ordinal))
            throw new PortalException("Invalid email or password.");

        return BuildSession(applicant);
    }

    // Re-issue a fresh token from a still-valid one. Caller passes the token in
    // the body (it may be close to expiry but not yet expired).
    public async Task<PortalSessionDto> RefreshAsync(string token, CancellationToken ct)
    {
        var decoded = tokenService.TryRead(token);
        if (decoded == null) throw new PortalException("Session expired. Please sign in again.");

        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var applicant = await ctx.CourierApplicants.FirstOrDefaultAsync(a => a.Id == decoded.Value.ApplicantId, ct);
        if (applicant == null) throw new PortalException("Session expired. Please sign in again.");

        return BuildSession(applicant);
    }

    public async Task<PortalApplicantDto> GetMeAsync(int applicantId, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var applicant = await ctx.CourierApplicants.FirstOrDefaultAsync(a => a.Id == applicantId, ct);
        if (applicant == null) throw new PortalException("Application not found.");
        return MapToDto(applicant);
    }

    public async Task<PortalApplicantDto> SaveProgressAsync(int applicantId, PortalProgressDto dto, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var applicant = await ctx.CourierApplicants.FirstOrDefaultAsync(a => a.Id == applicantId, ct);
        if (applicant == null) throw new PortalException("Application not found.");

        applicant.AddressLine1 = dto.AddressLine1;
        applicant.City = dto.City;
        applicant.State = dto.State;
        applicant.PostCode = dto.PostCode;
        applicant.DriversLicenceNo = dto.DriversLicenceNo;
        applicant.VehicleType = dto.VehicleType;
        applicant.VehicleMake = dto.VehicleMake;
        applicant.VehicleModel = dto.VehicleModel;
        applicant.VehicleYear = dto.VehicleYear;
        applicant.VehicleRegistrationNo = dto.VehicleRegistrationNo;
        applicant.BankAccountName = dto.BankAccountName;
        applicant.BankAccountNo = dto.BankAccountNo;
        applicant.BankBsb = dto.BankBsb;
        applicant.NextOfKin = dto.NextOfKin;
        applicant.NextOfKinRelationship = dto.NextOfKinRelationship;
        applicant.NextOfKinPhone = dto.NextOfKinPhone;
        applicant.Notes = dto.Notes;
        applicant.ModifiedDate = DateTime.UtcNow;

        await ctx.SaveChangesAsync(ct);
        return MapToDto(applicant);
    }

    // The canonical declaration the applicant agrees to on final submit. Stored
    // verbatim on the record so we always know what was agreed; the portal shows
    // the same wording. Neutral (no tenant brand) so FE/DB copies stay in sync.
    public const string DeclarationStatement =
        "I confirm that the information and documents I have provided are true, accurate, and complete " +
        "to the best of my knowledge. I understand that providing false information may result in my " +
        "application being declined.";

    // Final submit — captures the declaration and advances the applicant from the
    // self-service "Documentation" stage into "Training" (DeclarationAgree=true),
    // which is where the staff recruitment pipeline picks them up for review.
    // Mirrors the same flag transition NpApplicantService.AdvanceAsync performs.
    public async Task<PortalApplicantDto> SubmitApplicationAsync(int applicantId, PortalSubmitDto dto, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var applicant = await ctx.CourierApplicants.FirstOrDefaultAsync(a => a.Id == applicantId, ct);
        if (applicant == null) throw new PortalException("Application not found.");

        if (applicant.CourierId.HasValue)
            throw new PortalException("This application has already been approved.");
        if (!applicant.EmailVerified)
            throw new PortalException("Please verify your email before submitting.");

        // Idempotent: a double-submit just returns the already-submitted state.
        if (applicant.DeclarationAgree) return MapToDto(applicant);

        if (!dto.Agree)
            throw new PortalException("Please tick the box to agree to the declaration before submitting.");
        if (string.IsNullOrWhiteSpace(dto.FullName))
            throw new PortalException("Please type your full name to sign the declaration.");

        applicant.DeclarationAgree = true;
        applicant.DeclarationName = dto.FullName.Trim();
        applicant.DeclarationText = DeclarationStatement;
        applicant.DeclarationDate = DateTime.UtcNow;
        applicant.ModifiedDate = DateTime.UtcNow;

        await ctx.SaveChangesAsync(ct);
        return MapToDto(applicant);
    }

    // ---- helpers ----------------------------------------------------------

    private PortalSessionDto BuildSession(CourierApplicant applicant)
    {
        var token = tokenService.Issue(portalTenant.TenantId, applicant.Id);
        return new PortalSessionDto
        {
            Token = token,
            Expires = DateTime.UtcNow.Add(PortalSessionTokenService.TokenLifetime),
            Applicant = MapToDto(applicant),
        };
    }

    private static PortalApplicantDto MapToDto(CourierApplicant a) => new()
    {
        Id = a.Id,
        FirstName = a.FirstName,
        LastName = a.Surname,
        Email = a.Email,
        Mobile = a.Mobile,
        Phone = a.Phone,
        EmailVerified = a.EmailVerified,
        PipelineStage = DeriveStage(a),
        Submitted = a.DeclarationAgree,
        SubmittedDate = a.DeclarationDate,
        DeclarationName = a.DeclarationName,
        AddressLine1 = a.AddressLine1,
        City = a.City,
        State = a.State,
        PostCode = a.PostCode,
        DriversLicenceNo = a.DriversLicenceNo,
        VehicleType = a.VehicleType,
        VehicleMake = a.VehicleMake,
        VehicleModel = a.VehicleModel,
        VehicleYear = a.VehicleYear,
        VehicleRegistrationNo = a.VehicleRegistrationNo,
        BankAccountName = a.BankAccountName,
        BankAccountNo = a.BankAccountNo,
        BankBsb = a.BankBsb,
        NextOfKin = a.NextOfKin,
        NextOfKinRelationship = a.NextOfKinRelationship,
        NextOfKinPhone = a.NextOfKinPhone,
        Notes = a.Notes,
    };

    // Same flag-based derivation NpApplicantService uses (the legacy model has no
    // stored stage). Registration/Profile have no flag so applicants surface in
    // the nearest flag-backed stage.
    private static string DeriveStage(CourierApplicant a)
    {
        if (a.CourierId.HasValue || a.TrainingCompleted) return "Approval";
        if (a.DeclarationAgree) return "Training";
        if (a.EmailVerified) return "Documentation";
        return "Email Verification";
    }

    private static string GenerateVerificationCode()
    {
        // 6-digit numeric (matches the legacy courierportal scheme).
        return Random.Shared.Next(100000, 1000000).ToString(System.Globalization.CultureInfo.InvariantCulture);
    }

    // Raw INSERT into the tucManualMessage outbox — same column shape as
    // AutomationEngine.EmailService / Tenant.QuoteNotificationService, so the
    // existing downstream worker picks it up and sends it.
    private async Task QueueVerificationEmailAsync(
        DynamicDespatchDbContext ctx, CourierApplicant applicant, string code, string baseUrl, CancellationToken ct)
    {
        try
        {
            var brand = appSettings.PortalDisplayName;
            var slug = string.IsNullOrWhiteSpace(appSettings.PortalTenantSlug) ? "portal" : appSettings.PortalTenantSlug;
            var verifyLink =
                $"{baseUrl}/apply/{Uri.EscapeDataString(slug)}/verify?email={Uri.EscapeDataString(applicant.Email)}";

            var subject = PortalEmailTemplates.Subject(brand);
            var html = PortalEmailTemplates.BuildVerificationHtml(brand, applicant.FirstName, code, verifyLink);

            await ctx.Database.ExecuteSqlRawAsync(
                @"INSERT INTO tucManualMessage
                  (UcmmDate, SendToEmailAddress, Subject, UcmmMessage, ReplyToEmailAddress,
                   JobId, HasAttachment, FileName, FileType, FileContent, UcmmSent)
                  VALUES
                  (GETUTCDATE(), @p0, @p1, @p2, NULL, NULL, 0, NULL, NULL, NULL, 0)",
                [applicant.Email, subject, html],
                ct);
        }
        catch (Exception ex)
        {
            // Never block registration on the email queue — the applicant row is
            // already saved and the code can be re-sent / read by support.
            Log.Warning(ex, "Failed to queue applicant verification email for {Email}", applicant.Email);
        }
    }
}
