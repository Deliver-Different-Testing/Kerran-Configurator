namespace DfrntDriveConfigurator.Core.Application.Dtos.Tenant;

// Mapped Stops drill-down + Job-detail modal (Recurring Routes spec §5). A
// "stop" is a tblBulkJob row; v1 surfaces the linehaul-run jobs with editable
// Speed (the only mutable field) and read-only context.

public class BulkJobListItemDto
{
    public int Id { get; set; }
    public string JobNumber { get; set; } = string.Empty;
    public string Pickup { get; set; } = string.Empty;   // compact "line1, suburb"
    public string Drop { get; set; } = string.Empty;
    public int SpeedId { get; set; }
    public string SpeedShortName { get; set; } = string.Empty;
    public string SpeedName { get; set; } = string.Empty;
    public int SpeedGroupingId { get; set; }
    public string? SpeedGroupingName { get; set; }
    public string? BookDate { get; set; }                // "yyyy-MM-dd"
    public string? BookTime { get; set; }                // "HH:mm"
    public string StatusName { get; set; } = string.Empty;
}

public class BulkJobDetailDto
{
    public int Id { get; set; }
    public string JobNumber { get; set; } = string.Empty;
    public string Customer { get; set; } = string.Empty;
    public string PickupAddress { get; set; } = string.Empty;
    public string DropAddress { get; set; } = string.Empty;
    public int SpeedId { get; set; }
    public string SpeedShortName { get; set; } = string.Empty;
    public string SpeedName { get; set; } = string.Empty;
    public int SpeedGroupingId { get; set; }
    public string? SpeedGroupingName { get; set; }
    public string? BookDate { get; set; }
    public string? BookTime { get; set; }
    public string? LinehaulRunName { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public bool SpeedEditable { get; set; }              // false when delivered/cancelled
    public string? Notes { get; set; }
}

public class UpdateBulkJobSpeedDto
{
    public int SpeedId { get; set; }
}

public class BulkJobSpeedUpdateResult
{
    public BulkJobDetailDto? Dto { get; set; }
    public bool NotFound { get; set; }
    public bool InvalidSpeed { get; set; }
    public bool StatusLocked { get; set; }

    public static BulkJobSpeedUpdateResult Ok(BulkJobDetailDto dto) => new() { Dto = dto };
    public static BulkJobSpeedUpdateResult NotFoundResult() => new() { NotFound = true };
    public static BulkJobSpeedUpdateResult Invalid() => new() { InvalidSpeed = true };
    public static BulkJobSpeedUpdateResult Locked() => new() { StatusLocked = true };
}
