using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Reporting;

// Dapper result records for the Client Monthly Report stored procs + callout
// query. Several proc output columns contain spaces / punctuation, so [Column]
// aliases are honored via a CustomPropertyTypeMap registered once in
// ClientMonthlyReportService. Plain columns map by case-insensitive name.
// Mirrors AdminManager's EFPT-scaffolded REP_qryPerformance_Summary* result
// classes — only the columns the report actually renders are kept.

public class PerformanceSummaryResult
{
    public int? Minutes { get; set; }
    public string? Shortname { get; set; }
    public int? Count { get; set; }
    public int? SpeedPercent { get; set; }
    [Column("Avg Speed")] public string? AvgSpeed { get; set; }
    public int? LateCount { get; set; }
    public int? TotalMinsLate { get; set; }
    public int? SuccesPercent { get; set; }
    public string? ClientName { get; set; }
    public int ShowThis { get; set; }
}

public class ExpenditureResult
{
    public int? Year { get; set; }
    public int? ucjbMonth { get; set; }
    [Column("Client Name")] public string? ClientName { get; set; }
    [Column("Total Jobs")] public int? TotalJobs { get; set; }
    [Column("Monthly Expenditure")] public decimal? MonthlyExpenditure { get; set; }
}

public class DestinationResult
{
    public int? Year { get; set; }
    public int? Month { get; set; }
    public string? Suburb { get; set; }
    [Column("Total Jobs")] public int? TotalJobs { get; set; }
    [Column("Monthly Expenditure")] public decimal? MonthlyExpenditure { get; set; }
}

public class PerformanceSpendResult
{
    [Column("Job Number")] public string? JobNumber { get; set; }
    public string? ucjbType { get; set; }
    public DateTime? Date { get; set; }
    public DateTime? Booked { get; set; }
    [Column("Picked up time")] public DateTime? Pickeduptime { get; set; }
    public DateTime? Delivered { get; set; }
    [Column("Total Time")] public int? TotalTime { get; set; }
    public int? DeliveryMins { get; set; }
    [Column("POD Name")] public string? PODName { get; set; }
    public string? Booker { get; set; }
    [Column("Achieved Speed")] public string? AchievedSpeed { get; set; }
    public string? From { get; set; }
    [Column("From Postcode")] public string? FromPostcode { get; set; }
    public string? To { get; set; }
    [Column("To Postcode")] public string? ToPostcode { get; set; }
    public string? Address { get; set; }
    [Column("Late Pickup")] public int? LatePickup { get; set; }
    [Column("Late Delivery")] public int? LateDelivery { get; set; }
    public int? ucjbSpeed { get; set; }
    public string? Notes { get; set; }
    [Column("Charge($) Excl GST")] public decimal? ChargeExclGST { get; set; }
    public decimal FuelSurchargeAmount { get; set; }
    [Column("Ref A")] public string? RefA { get; set; }
    [Column("Ref B")] public string? RefB { get; set; }
    [Column("Urgent Ref")] public string? UrgentRef { get; set; }
    public double? Weight { get; set; }
    public string? Vehicle { get; set; }
    public short? Quantity { get; set; }
    public string? Code { get; set; }
    public string? uccrName { get; set; }
    public string? ucclLegalName { get; set; }
}

// Inline callout-events query result. Columns are aliased in the SQL so plain
// case-insensitive name matching is enough (no [Column] needed).
public class ClientMonthlyJobEventResult
{
    public string? JobNumber { get; set; }
    public DateTime? Date { get; set; }
    public DateTime? Booked { get; set; }
    public DateTime? Delivered { get; set; }
    public string? AchievedSpeed { get; set; }
    public string? From { get; set; }
    public string? To { get; set; }
    public string? Address { get; set; }
    public string? CourierName { get; set; }
    public string? EventType { get; set; }
    public string? Notes { get; set; }
    public decimal? Charge { get; set; }
}
