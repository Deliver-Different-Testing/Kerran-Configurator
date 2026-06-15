using System;
using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Courier;

// Phase 2 — My Runs. Ported from courierportal RunService/Run DTOs. A "run" is a
// group of jobs keyed by (BookDate, RunName). Courier-facing amounts already have
// the sub-contractor split applied (a sub sees their net share).

public class CourierJobDto
{
    public int JobId { get; set; }
    public string JobNumber { get; set; }
    public string ClientCode { get; set; }
    public decimal CourierPayment { get; set; }
    public decimal CourierFuel { get; set; }
    public decimal CourierBonus { get; set; }
    public int? MasterId { get; set; }
    public decimal? MasterPayment { get; set; }
    public decimal? MasterFuel { get; set; }
    public decimal? MasterBonus { get; set; }
    public string DeliveryAddressLine1 { get; set; }
    public string DeliveryAddressLine2 { get; set; }
    public string DeliveryAddressLine3 { get; set; }
    public string DeliveryAddressLine4 { get; set; }
    public string DeliveryAddressLine5 { get; set; }
    public string DeliveryAddressLine6 { get; set; }
    public string DeliveryAddressLine7 { get; set; }
    public string DeliveryAddressLine8 { get; set; }
    public double? DeliveryLatitude { get; set; }
    public double? DeliveryLongitude { get; set; }
    public bool Void { get; set; }
    public string Status { get; set; }
}

public class CourierRunMasterDto
{
    public int Id { get; set; }
    public decimal Amount { get; set; }
}

public class CourierRunDto
{
    public int Id { get; set; }
    public int RunType { get; set; }
    public DateTime BookDate { get; set; }
    public string DateDisplay { get; set; }
    public string RunName { get; set; }
    public double Kms { get; set; }
    public int Time { get; set; }
    public decimal Amount { get; set; }
    public List<CourierRunMasterDto> Masters { get; set; } = new();
    public decimal MasterAmount { get; set; }
    public string Cities { get; set; }
    public string States { get; set; }
    public List<CourierJobDto> Jobs { get; set; } = new();
}

public class CourierRunsResultDto
{
    public List<CourierRunDto> Current { get; set; } = new();
    public List<CourierRunDto> Past { get; set; } = new();
}

public class CourierEnquiryDto
{
    public string JobNumber { get; set; }
    public string Message { get; set; }
}
