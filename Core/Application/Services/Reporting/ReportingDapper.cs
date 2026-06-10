using System;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Reflection;
using Dapper;
using QuestPDF.Infrastructure;

namespace DfrntDriveConfigurator.Core.Application.Services.Reporting;

// Shared setup for the QuestPDF/Dapper report services (Client Monthly, Courier
// Job Detail, ...). One-time QuestPDF Community license + a [Column]-aware Dapper
// type map so stored-proc result columns with spaces/punctuation (e.g. "No Jobs",
// "OnTime%") bind to typed records. Plain columns fall back to case-insensitive
// property-name matching.
public static class ReportingDapper
{
    private static bool _questPdfInitialized;
    private static readonly object Lock = new();

    public static void EnsureQuestPdf()
    {
        if (_questPdfInitialized) return;
        lock (Lock)
        {
            if (_questPdfInitialized) return;
            QuestPDF.Settings.License = LicenseType.Community;
            _questPdfInitialized = true;
        }
    }

    public static void SetColumnMap<T>()
    {
        SqlMapper.SetTypeMap(typeof(T), new CustomPropertyTypeMap(typeof(T),
            (type, column) => type.GetProperties().FirstOrDefault(p =>
                string.Equals(
                    p.GetCustomAttribute<ColumnAttribute>()?.Name ?? p.Name,
                    column, StringComparison.OrdinalIgnoreCase))!));
    }
}
