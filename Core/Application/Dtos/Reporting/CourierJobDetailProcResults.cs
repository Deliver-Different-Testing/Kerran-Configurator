using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Reporting;

// Dapper result records for the "Jobs by Courier by Day - Detail" report procs.
// Mirrors AdminManager's EFPT-scaffolded REP_qryJobsByCourierByDay_Detail /
// _Summary2 result classes. Spaced/punctuated summary columns ("No Jobs",
// "Av Per Job", "OnTime%") are matched via the [Column]-aware Dapper type map
// (ReportingDapper.SetColumnMap). Detail columns are all plain names.

public class CourierJobDetailRow
{
    public DateTime? Date { get; set; }
    public DateTime? Time { get; set; }
    public string? Number { get; set; }
    public string? ClientCode { get; set; }
    public string? OurRef { get; set; }
    public string? From { get; set; }
    public string? To { get; set; }
    public string? ShortName { get; set; }
    public string? OriginalSpeed { get; set; }
    public decimal? Amount { get; set; }
    public string? Invoice { get; set; }
    public int? DespatchMins { get; set; }
    public int? DeliveryMins { get; set; }
    public int? LateMins { get; set; }
    public DateTime? CompletedTime { get; set; }
    public string? LateCall { get; set; }
    public string? PODName { get; set; }
    public string? FirstName { get; set; }
    public string? Surname { get; set; }
    public DateTime? PUTime { get; set; }
    public string? CourierCode { get; set; }
    public int CourierID { get; set; }
    public string? SMSName { get; set; }
    public double? Weight { get; set; }
    public int? Van { get; set; }
    public int JobID { get; set; }
}

public class CourierJobSummaryRow
{
    public int? Minutes { get; set; }
    public string? ShortName { get; set; }
    public decimal? Total { get; set; }
    public decimal? FuelSurchargeTotal { get; set; }
    public decimal? TotalPlusSurcharge { get; set; }
    public decimal? WithholdingTaxAmount { get; set; }
    [Column("No Jobs")] public int? NoJobs { get; set; }
    [Column("Av Per Job")] public decimal? AvPerJob { get; set; }
    public int? TotalMinsLate { get; set; }
    public int? LateJobs { get; set; }
    public int? AvMinsLate { get; set; }
    [Column("OnTime%")] public decimal? OnTime { get; set; }
    public decimal? AcLate { get; set; }
    public decimal? NtLate { get; set; }
}
