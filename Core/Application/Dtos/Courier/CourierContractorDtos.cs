namespace DfrntDriveConfigurator.Core.Application.Dtos.Courier;

// Phase 2 — a master courier's subcontractors + their payment splits.
// Percentages are stored as fractions (0–1), matching tucCourier.SubContractor*.

public class CourierContractorDto
{
    public int Id { get; set; }
    public string Code { get; set; }
    public string FirstName { get; set; }
    public string Surname { get; set; }
    public decimal Percentage { get; set; }
    public decimal FuelPercentage { get; set; }
    public decimal BonusPercentage { get; set; }
    public bool Active { get; set; }
}

// Value-type decimals aren't subject to the [ApiController] implicit-required
// trap (that only affects non-nullable reference types). A missing field
// defaults to 0; the service validates the 0–1 range.
public class CourierContractorUpdateDto
{
    public decimal Percentage { get; set; }
    public decimal FuelPercentage { get; set; }
    public decimal BonusPercentage { get; set; }
}
