namespace DfrntDriveConfigurator.Core.Application.Dtos.Courier;

/// <summary>
/// Courier Portal (finish-line P0) — at-a-glance dashboard stats for the
/// landing tiles. Deliberately small + high-confidence: every value is derived
/// from data the portal already serves (runs, schedule, documents), so there's
/// no new query surface to maintain.
/// </summary>
public class CourierDashboardDto
{
    // Runs whose book date is today (assigned, across current + completed).
    public int TodaysRuns { get; set; }

    // Runs completed within the current week (Mon–today).
    public int WeekCompletedRuns { get; set; }

    // Next schedule the courier has marked themselves Available for, formatted
    // for display (e.g. "Mon 23 Jun · 06:00"); null when none upcoming.
    public string? NextShift { get; set; }

    // Document checklist counts (only rows that actually have an upload).
    public int DocumentsPending { get; set; }
    public int DocumentsRejected { get; set; }
    public int DocumentsExpiringSoon { get; set; }   // verified, expiry within 30 days (incl. overdue)
    public int DocumentsMissingRequired { get; set; } // mandatory doc types with no upload
}
