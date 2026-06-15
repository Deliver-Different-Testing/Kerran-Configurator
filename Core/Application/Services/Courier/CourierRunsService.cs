using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Courier;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Courier;

// Phase 2 — My Runs. Native port of courierportal RunService. Runs come from the
// existing per-tenant stored procs CP_stpCourierRuns (list) / CP_stpCourierRun
// (detail) — reused at the DB layer (the configurator's [AdminManager] login was
// granted EXECUTE via dbmigrationsv2 20260615160000). Results are grouped by
// (BookDate, RunName) into Current/Past and mapped with the sub-contractor split.
//
// v1: calculateMaster = false (the courier sees their own net amounts). The
// master breakdown (Masters[]/MasterAmount — what a master earns from each sub)
// is deferred; logged in memory.
public class CourierRunsService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    ICourierScopeResolver scopeResolver)
{
    // Internal projection matching the CP_* proc output columns (mapped by name).
    private sealed class RunItem
    {
        public int JobId { get; set; }
        public DateTime BookDate { get; set; }
        public string JobNumber { get; set; }
        public string ClientCode { get; set; }
        public int RunId { get; set; }
        public string RunName { get; set; }
        public double RunKms { get; set; }
        public int RunMins { get; set; }
        public string DeliveryAddressLine1 { get; set; }
        public string DeliveryAddressLine2 { get; set; }
        public string DeliveryAddressLine3 { get; set; }
        public string DeliveryAddressLine4 { get; set; }
        public string DeliveryAddressLine5 { get; set; }
        public string DeliveryAddressLine6 { get; set; }
        public string DeliveryAddressLine7 { get; set; }
        public string DeliveryAddressLine8 { get; set; }
        public string DeliveryLongitude { get; set; }
        public string DeliveryLatitude { get; set; }
        public double CourierPercentage { get; set; }
        public decimal? CourierPayment { get; set; }
        public decimal? CourierFuel { get; set; }
        public decimal? CourierBonus { get; set; }
        public int? MasterCourierId { get; set; }
        public decimal? SubContractorPercentage { get; set; }
        public decimal? SubContractorFuelPercentage { get; set; }
        public decimal? SubContractorBonusPercentage { get; set; }
        public int StatusId { get; set; }
        public string Status { get; set; }
        public bool JobDone { get; set; }
        public bool Void { get; set; }
        public bool Reprice { get; set; }
        public bool Archived { get; set; }
        public bool Invoiced { get; set; }
    }

    public async Task<CourierRunsResultDto> GetMyRunsAsync(CancellationToken ct)
    {
        var scope = await Require(ct);
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        var items = await ctx.Database
            .SqlQueryRaw<RunItem>("EXEC [dbo].[CP_stpCourierRuns] @CourierId = {0}", scope.CourierId)
            .ToListAsync(ct);

        var country = await ctx.TblSettings.Select(s => s.CountryCode).FirstOrDefaultAsync(ct);
        var today = DateTime.UtcNow.Date;

        var grouped = items.GroupBy(x => new { x.BookDate, x.RunName }).ToList();
        var current = grouped.Where(g => g.Any(r => !IsCompleted(r) && !r.Void));
        var past = grouped.Where(g => !g.Any(r => !IsCompleted(r) && !r.Void));

        return new CourierRunsResultDto
        {
            Current = current.Select(g => MapRun(g.ToList(), country, today)).ToList(),
            Past = past.Select(g => MapRun(g.ToList(), country, today)).ToList(),
        };
    }

    public async Task<CourierRunDto> GetMyRunAsync(DateTime bookDate, string runName, CancellationToken ct)
    {
        var scope = await Require(ct);
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        var items = await ctx.Database
            .SqlQueryRaw<RunItem>(
                "EXEC [dbo].[CP_stpCourierRun] @CourierId = {0}, @BookDate = {1}, @RunName = {2}",
                scope.CourierId, bookDate.Date, runName ?? string.Empty)
            .ToListAsync(ct);

        if (items.Count == 0) throw new CourierPortalException("Run not found.");

        var country = await ctx.TblSettings.Select(s => s.CountryCode).FirstOrDefaultAsync(ct);
        return MapRun(items, country, DateTime.UtcNow.Date);
    }

    public async Task SendEnquiryAsync(CourierEnquiryDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto?.JobNumber)) throw new CourierPortalException("Job number is required.");
        if (string.IsNullOrWhiteSpace(dto.Message)) throw new CourierPortalException("Please enter your enquiry message.");

        var scope = await Require(ct);
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        var enquiryEmail = await ctx.TblSettings.Select(s => s.EnquiryEmail).FirstOrDefaultAsync(ct);
        if (string.IsNullOrWhiteSpace(enquiryEmail))
            throw new CourierPortalException("Enquiries aren't configured for this tenant. Please contact dispatch directly.");

        var code = await ctx.TucCouriers.Where(c => c.UccrId == scope.CourierId).Select(c => c.Code).FirstOrDefaultAsync(ct);
        var subject = $"Courier Portal: Job Enquiry for {dto.JobNumber.Trim()} for courier {code}";

        // Reuse the tucManualMessage outbox (same shape as QuoteNotificationService);
        // a downstream worker sends it. ReplyTo = courier's email so dispatch can
        // reply straight to the driver.
        await ctx.Database.ExecuteSqlRawAsync(
            @"INSERT INTO tucManualMessage
              (UcmmDate, SendToEmailAddress, Subject, UcmmMessage, ReplyToEmailAddress,
               JobId, HasAttachment, FileName, FileType, FileContent, UcmmSent)
              VALUES (GETUTCDATE(), {0}, {1}, {2}, {3}, NULL, 0, NULL, NULL, NULL, 0)",
            [enquiryEmail, subject, dto.Message.Trim(), scope.Email ?? (object)DBNull.Value],
            ct);
    }

    // ---- helpers ----------------------------------------------------------

    private async Task<CourierScope> Require(CancellationToken ct)
    {
        var scope = await scopeResolver.ResolveAsync(ct);
        if (scope == null) throw new CourierPortalException("No active courier record is linked to your account.");
        return scope;
    }

    private static bool IsCompleted(RunItem r) => !r.Void && r.JobDone;

    private static decimal Net(decimal? amount, bool isSub, decimal? subPct) =>
        Math.Round((amount ?? 0m) * (isSub ? (subPct ?? 0m) : 1m), 4, MidpointRounding.AwayFromZero);

    private static CourierRunDto MapRun(List<RunItem> items, string countryCode, DateTime today)
    {
        var jobs = items.Select(x =>
        {
            var isSub = x.MasterCourierId.HasValue;
            return new CourierJobDto
            {
                JobId = x.JobId,
                JobNumber = x.JobNumber,
                ClientCode = x.ClientCode,
                CourierPayment = Net(x.CourierPayment, isSub, x.SubContractorPercentage),
                CourierFuel = Net(x.CourierFuel, isSub, x.SubContractorFuelPercentage),
                CourierBonus = Net(x.CourierBonus, isSub, x.SubContractorBonusPercentage),
                MasterId = x.MasterCourierId,
                DeliveryAddressLine1 = x.DeliveryAddressLine1,
                DeliveryAddressLine2 = x.DeliveryAddressLine2,
                DeliveryAddressLine3 = x.DeliveryAddressLine3,
                DeliveryAddressLine4 = x.DeliveryAddressLine4,
                DeliveryAddressLine5 = x.DeliveryAddressLine5,
                DeliveryAddressLine6 = x.DeliveryAddressLine6,
                DeliveryAddressLine7 = x.DeliveryAddressLine7,
                DeliveryAddressLine8 = x.DeliveryAddressLine8,
                DeliveryLatitude = double.TryParse(x.DeliveryLatitude, out var lat) ? lat : null,
                DeliveryLongitude = double.TryParse(x.DeliveryLongitude, out var lng) ? lng : null,
                Void = x.Void,
                Status = x.StatusId != 6 && x.StatusId != 13 && x.JobDone ? "Done" : x.Status,
            };
        }).ToList();

        var first = items[0];
        return new CourierRunDto
        {
            Id = first.RunId,
            RunType = 1,
            BookDate = first.BookDate,
            DateDisplay = first.BookDate == today
                ? "TODAY"
                : first.BookDate.ToString(countryCode == "NZ" ? "dd/MM/yyyy" : "MM/dd/yyyy", CultureInfo.InvariantCulture),
            RunName = first.RunName,
            Kms = Math.Round(first.RunKms, 2, MidpointRounding.AwayFromZero),
            Time = first.RunMins,
            Amount = Math.Round(jobs.Where(j => !j.Void).Sum(j => j.CourierPayment + j.CourierFuel + j.CourierBonus), 2, MidpointRounding.AwayFromZero),
            Masters = new List<CourierRunMasterDto>(),
            MasterAmount = 0m,
            Cities = string.Join(", ", jobs.Where(j => !string.IsNullOrWhiteSpace(j.DeliveryAddressLine5)).Select(j => j.DeliveryAddressLine5).Distinct(StringComparer.OrdinalIgnoreCase)),
            States = string.Join(", ", jobs.Where(j => !string.IsNullOrWhiteSpace(j.DeliveryAddressLine6)).Select(j => j.DeliveryAddressLine6).Distinct(StringComparer.OrdinalIgnoreCase)),
            Jobs = jobs,
        };
    }
}
