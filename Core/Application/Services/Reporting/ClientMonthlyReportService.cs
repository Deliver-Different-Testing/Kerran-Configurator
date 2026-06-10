using System;
using System.ComponentModel.DataAnnotations.Schema;
using System.Data;
using System.Linq;
using System.Reflection;
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
using QuestPDF.Infrastructure;

namespace DfrntDriveConfigurator.Core.Application.Services.Reporting;

// Client Monthly Report — ported from AdminManager's
// ReportService.GenerateClientMonthlyReportAsync. Runs the same 4 stored procs
// + the inline callout-events query, hydrates the shared DeliverDifferentReporting
// data model, and renders PDF (QuestPDF) / Excel (ClosedXML) via the package's
// document classes. Procs are called with Dapper (the configurator's data tool);
// proc output columns with spaces are matched via a [Column]-aware type map.
public class ClientMonthlyReportService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IHttpContextAccessor httpContextAccessor,
    ITenantBrandingService tenantBrandingService,
    INpScopeResolver scopeResolver)
{
    private static bool _questPdfInitialized;
    private static bool _dapperMapsRegistered;
    private static readonly object InitLock = new();

    public async Task<(byte[] Content, string ContentType, string Extension)> GenerateAsync(
        int? clientId, DateTime startDate, DateTime endDate, string? format, CancellationToken ct = default)
    {
        EnsureInitialized();

        await using var db = await contextFactory.CreateDbContextAsync(ct);

        // NP-scope guard: a non-admin caller may only run the report for a
        // client linked to their NpAgentId, and must pick a specific client.
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin)
        {
            if (clientId is not int cid)
                throw new InvalidOperationException("A client must be selected.");
            var inScope = scope.NpAgentId is int npId &&
                await db.TucClients.AsNoTracking().AnyAsync(c => c.UcclId == cid && c.NpAgentId == npId, ct);
            if (!inScope)
                throw new InvalidOperationException($"Client {cid} not found.");
        }

        var branding = await tenantBrandingService.GetBrandingAsync(GetTenantId());

        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        var procParams = new { ClientID = clientId, StartDate = startDate, EndDate = endDate };
        CommandDefinition Proc(string name) =>
            new(name, procParams, commandType: CommandType.StoredProcedure, cancellationToken: ct);

        var summary     = (await conn.QueryAsync<PerformanceSummaryResult>(Proc("REP_qryPerformance_Summary"))).ToList();
        var spend       = (await conn.QueryAsync<PerformanceSpendResult>(Proc("REP_qryPerformance_Summary_PerformanceSpend"))).ToList();
        var expenditure = (await conn.QueryAsync<ExpenditureResult>(Proc("REP_qryPerformance_Summary_Expenditure"))).ToList();
        var destination = (await conn.QueryAsync<DestinationResult>(Proc("REP_qryPerformance_Summary_Destination"))).ToList();

        const string calloutSql = @"
            SELECT
                tucJobArchive.ucjbNumber          AS JobNumber,
                tucJobArchive.ucjbDate            AS Date,
                tucJobArchive.ucjbTime            AS Booked,
                tucJobArchive.ucjbComplTime       AS Delivered,
                tucJobType.ucjtDescription        AS AchievedSpeed,
                tucSuburb.ucsuName                AS [From],
                tucSuburb_1.ucsuName              AS [To],
                tucJobArchive.ucjbToAddr          AS Address,
                tucCourier.uccrName               AS CourierName,
                tucEventType.ucetName             AS EventType,
                tucJobArchive.ucjbNotes           AS Notes,
                tucJobArchive.ucjbAmount          AS Charge
            FROM tucJobArchive
                INNER JOIN tucClient        ON tucJobArchive.ucjbClientID = tucClient.ucclID
                INNER JOIN tucJobType       ON tucJobArchive.ucjbSpeed   = tucJobType.ucjtID
                INNER JOIN tucSuburb        ON tucJobArchive.ucjbFrom    = tucSuburb.ucsuID
                INNER JOIN tucSuburb AS tucSuburb_1 ON tucJobArchive.ucjbTo = tucSuburb_1.ucsuID
                INNER JOIN tucCourier       ON tucJobArchive.ucjbCourierID = tucCourier.uccrID
                INNER JOIN tucEventArchive  ON tucJobArchive.ucjbID      = tucEventArchive.ucevJobID
                INNER JOIN tucEventType     ON tucEventArchive.ucevType  = tucEventType.ucetID
                LEFT JOIN tblJobRelationshipType
                    ON tucJobArchive.JobRelationshipTypeID = tblJobRelationshipType.JobRelationshipTypeID
            WHERE
                tucJobArchive.ucjbDate BETWEEN @StartDate AND @EndDate
                AND (tblJobRelationshipType.DisplayStatement = 1 OR tucJobArchive.JobRelationshipTypeID IS NULL)
                AND tucJobArchive.ucjbClientID = @ClientID
                AND tucJobArchive.ucjbVoid = 0
                AND tucJobArchive.ucjbJobDone = 1
                AND tucEventType.ucetName LIKE 'Callout%'
            ORDER BY tucJobArchive.ucjbDate, tucJobArchive.ucjbTime";

        var calloutRows = (await conn.QueryAsync<ClientMonthlyJobEventResult>(
            new CommandDefinition(calloutSql, procParams, cancellationToken: ct))).ToList();

        var clientName = summary.FirstOrDefault(s => !string.IsNullOrWhiteSpace(s.ClientName))?.ClientName
                      ?? expenditure.FirstOrDefault(e => !string.IsNullOrWhiteSpace(e.ClientName))?.ClientName
                      ?? "";
        var clientLegalName = spend.FirstOrDefault(s => !string.IsNullOrWhiteSpace(s.ucclLegalName))?.ucclLegalName;

        var data = new ClientMonthlyReportData
        {
            ClientName = clientName,
            ClientLegalName = clientLegalName,
            StartDate = startDate,
            EndDate = endDate,

            PerformanceSummary = summary.Select(s => new ClientMonthlyPerformanceRow
            {
                ShortName = s.Shortname,
                Minutes = s.Minutes,
                Count = s.Count,
                SpeedPercent = s.SpeedPercent,
                AvgSpeed = s.AvgSpeed,
                LateCount = s.LateCount,
                TotalMinsLate = s.TotalMinsLate,
                SuccessPercent = s.SuccesPercent,
                ShowThis = s.ShowThis
            }).ToList(),

            Expenditure = expenditure.Select(e => new ClientMonthlyExpenditureRow
            {
                Year = e.Year,
                Month = e.ucjbMonth,
                ClientName = e.ClientName,
                TotalJobs = e.TotalJobs,
                MonthlyExpenditure = e.MonthlyExpenditure
            }).ToList(),

            Destinations = destination.Select(d => new ClientMonthlyDestinationRow
            {
                Year = d.Year,
                Month = d.Month,
                Suburb = d.Suburb,
                TotalJobs = d.TotalJobs,
                MonthlyExpenditure = d.MonthlyExpenditure
            }).ToList(),

            PerformanceSpend = spend.Select(p => new ClientMonthlyJobRow
            {
                JobNumber = p.JobNumber,
                JobType = p.ucjbType,
                Date = p.Date,
                Booked = p.Booked,
                PickedUpTime = p.Pickeduptime,
                Delivered = p.Delivered,
                TotalTime = p.TotalTime,
                DeliveryMins = p.DeliveryMins,
                PodName = p.PODName,
                Booker = p.Booker,
                AchievedSpeed = p.AchievedSpeed,
                From = p.From,
                FromPostcode = p.FromPostcode,
                To = p.To,
                ToPostcode = p.ToPostcode,
                Address = p.Address,
                LatePickup = p.LatePickup,
                LateDelivery = p.LateDelivery,
                Speed = p.ucjbSpeed,
                Notes = p.Notes,
                ChargeExclGst = p.ChargeExclGST,
                FuelSurchargeAmount = p.FuelSurchargeAmount,
                RefA = p.RefA,
                RefB = p.RefB,
                UrgentRef = p.UrgentRef,
                Weight = p.Weight,
                Vehicle = p.Vehicle,
                Quantity = p.Quantity,
                CourierCode = p.Code,
                CourierName = p.uccrName
            }).ToList(),

            CalloutEvents = calloutRows.Select(c => new ClientMonthlyJobEventRow
            {
                JobNumber = c.JobNumber,
                Date = c.Date,
                Booked = c.Booked,
                Delivered = c.Delivered,
                AchievedSpeed = c.AchievedSpeed,
                From = c.From,
                To = c.To,
                Address = c.Address,
                CourierName = c.CourierName,
                EventType = c.EventType,
                Notes = c.Notes,
                ChargeExclGst = c.Charge
            }).ToList()
        };

        using var stream = new System.IO.MemoryStream();
        if (string.Equals(format?.Trim(), "EXCEL", StringComparison.OrdinalIgnoreCase))
        {
            new ClientMonthlyReportSpreadsheet(data, branding).Generate(stream);
            return (stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx");
        }

        new ClientMonthlyReportDocument(data, branding).GeneratePdf(stream);
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

    private static void EnsureInitialized()
    {
        if (_questPdfInitialized && _dapperMapsRegistered) return;
        lock (InitLock)
        {
            if (!_questPdfInitialized)
            {
                QuestPDF.Settings.License = LicenseType.Community;
                _questPdfInitialized = true;
            }
            if (!_dapperMapsRegistered)
            {
                SetColumnMap<PerformanceSummaryResult>();
                SetColumnMap<ExpenditureResult>();
                SetColumnMap<DestinationResult>();
                SetColumnMap<PerformanceSpendResult>();
                _dapperMapsRegistered = true;
            }
        }
    }

    // Map result columns to properties honoring [Column] (for spaced/punctuated
    // proc columns), falling back to case-insensitive property-name match.
    private static void SetColumnMap<T>()
    {
        SqlMapper.SetTypeMap(typeof(T), new CustomPropertyTypeMap(typeof(T),
            (type, column) => type.GetProperties().FirstOrDefault(p =>
                string.Equals(
                    p.GetCustomAttribute<ColumnAttribute>()?.Name ?? p.Name,
                    column, StringComparison.OrdinalIgnoreCase))!));
    }
}
