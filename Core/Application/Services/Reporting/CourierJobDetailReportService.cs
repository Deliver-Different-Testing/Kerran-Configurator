using System;
using System.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using DeliverDifferentReporting.Documents;
using DeliverDifferentReporting.Models;
using DeliverDifferentReporting.Services;
using DfrntDriveConfigurator.Core.Application.Dtos.Reporting;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;

namespace DfrntDriveConfigurator.Core.Application.Services.Reporting;

// "Jobs by Courier by Day - Detail" — ported from AdminManager's
// ReportService.GenerateCourierJobDetailReportAsync (the report seen in the
// courier portal's Reports screen). Runs the same 2 procs, hydrates the shared
// DeliverDifferentReporting CourierJobDetailData model, and renders PDF
// (QuestPDF) / Excel (ClosedXML) via the package document classes. Courier is
// NP-scoped; data access via Dapper.
public class CourierJobDetailReportService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IHttpContextAccessor httpContextAccessor,
    ITenantBrandingService tenantBrandingService,
    INpScopeResolver scopeResolver)
{
    private static bool _mapsRegistered;
    private static readonly object MapLock = new();

    public async Task<(byte[] Content, string ContentType, string Extension)> GenerateAsync(
        int? courierId, DateTime startDate, DateTime endDate, string? format, CancellationToken ct = default)
    {
        ReportingDapper.EnsureQuestPdf();
        EnsureMaps();

        await using var db = await contextFactory.CreateDbContextAsync(ct);

        // NP-scope guard: a non-admin caller may only run the report for a
        // courier linked to their NpAgentId, and must pick a specific courier.
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin)
        {
            if (courierId is not int cid)
                throw new InvalidOperationException("A courier must be selected.");
            var inScope = scope.NpAgentId is int npId &&
                await db.TucCouriers.AsNoTracking().AnyAsync(c => c.UccrId == cid && c.NpAgentId == npId, ct);
            if (!inScope)
                throw new InvalidOperationException($"Courier {cid} not found.");
        }

        var branding = await tenantBrandingService.GetBrandingAsync(GetTenantId());

        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        var procParams = new { CourierID = courierId, StartDate = startDate, EndDate = endDate };
        CommandDefinition Proc(string name) =>
            new(name, procParams, commandType: CommandType.StoredProcedure, cancellationToken: ct);

        var detail  = (await conn.QueryAsync<CourierJobDetailRow>(Proc("REP_qryJobsByCourierByDay_Detail"))).ToList();
        var summary = (await conn.QueryAsync<CourierJobSummaryRow>(Proc("REP_qryJobsByCourierByDay_Summary2"))).ToList();

        var first = courierId.HasValue ? detail.FirstOrDefault() : null;

        var data = new CourierJobDetailData
        {
            StartDate = startDate,
            EndDate = endDate,
            Courier = first != null
                ? new CourierInfo
                {
                    FirstName = first.FirstName,
                    Surname = first.Surname,
                    CourierCode = first.CourierCode,
                    CourierID = first.CourierID
                }
                : null,

            Jobs = detail.Select(d => new JobDetail
            {
                Date = d.Date ?? DateTime.MinValue,
                Time = d.Time ?? DateTime.MinValue,
                Number = d.Number ?? "",
                Invoice = d.Invoice,
                ClientCode = d.ClientCode,
                OurRef = d.OurRef,
                From = d.From,
                To = d.To,
                Weight = d.Weight,
                Van = d.Van,
                Amount = d.Amount,
                OriginalSpeed = d.OriginalSpeed,
                ShortName = d.ShortName,
                DespatchMins = d.DespatchMins,
                DeliveryMins = d.DeliveryMins,
                PUTime = d.PUTime,
                LateCall = d.LateCall,
                CompletedTime = d.CompletedTime,
                LateMins = d.LateMins,
                PODName = d.PODName,
                SMSName = d.SMSName,
                JobID = d.JobID
            }).ToList(),

            SpeedSummaries = summary.Select(s => new SpeedSummary
            {
                ShortName = s.ShortName ?? "",
                NoJobs = s.NoJobs ?? 0,
                Total = s.Total ?? 0,
                AvPerJob = s.AvPerJob ?? 0,
                OnTimePercent = s.OnTime ?? 0,
                LateJobs = s.LateJobs ?? 0,
                AvMinsLate = s.AvMinsLate ?? 0
            }).ToList(),

            Totals = new TotalSummary
            {
                TotalJobs = summary.Sum(s => s.NoJobs ?? 0),
                Total = summary.Sum(s => s.Total ?? 0),
                FuelSurchargeTotal = summary.Sum(s => s.FuelSurchargeTotal ?? 0),
                TotalPlusSurcharge = summary.Sum(s => s.TotalPlusSurcharge ?? 0),
                WithholdingTaxAmount = summary.Sum(s => s.WithholdingTaxAmount ?? 0),
                AvgPerJob = summary.Sum(s => s.NoJobs ?? 0) > 0
                    ? summary.Sum(s => s.Total ?? 0) / summary.Sum(s => s.NoJobs ?? 0)
                    : 0,
                OnTimePercent = summary.Sum(s => s.NoJobs ?? 0) > 0
                    ? 100m * (summary.Sum(s => s.NoJobs ?? 0) - summary.Sum(s => s.LateJobs ?? 0))
                      / summary.Sum(s => s.NoJobs ?? 0)
                    : 0,
                TotalLateJobs = summary.Sum(s => s.LateJobs ?? 0),
                TotalMinsLate = summary.Sum(s => s.TotalMinsLate ?? 0),
                AcLatePercent = summary.FirstOrDefault()?.AcLate ?? 0,
                NtLatePercent = summary.FirstOrDefault()?.NtLate ?? 0
            }
        };

        using var stream = new System.IO.MemoryStream();
        if (string.Equals(format?.Trim(), "EXCEL", StringComparison.OrdinalIgnoreCase))
        {
            new CourierJobDetailSpreadsheet(data, branding).Generate(stream);
            return (stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx");
        }

        new CourierJobDetailDocument(data, branding).GeneratePdf(stream);
        return (stream.ToArray(), "application/pdf", ".pdf");
    }

    private int GetTenantId()
    {
        var user = httpContextAccessor.HttpContext?.User;
        var tenantClaim = user?.Claims.FirstOrDefault(c => c.Type == "CurrentTenantID")?.Value;
        if (string.IsNullOrEmpty(tenantClaim) || !int.TryParse(tenantClaim, out var tenantId))
            throw new InvalidOperationException("Unable to determine tenant ID from user claims.");
        return tenantId;
    }

    private static void EnsureMaps()
    {
        if (_mapsRegistered) return;
        lock (MapLock)
        {
            if (_mapsRegistered) return;
            ReportingDapper.SetColumnMap<CourierJobDetailRow>();
            ReportingDapper.SetColumnMap<CourierJobSummaryRow>();
            _mapsRegistered = true;
        }
    }
}
