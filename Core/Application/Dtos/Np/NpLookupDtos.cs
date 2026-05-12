namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Generic {id, name} pair returned by the np/lookups endpoints. Frontend uses
// these to populate select dropdowns for fields backed by lookup tables
// (vehicle make, insurance company, etc.).
public class LookupItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
