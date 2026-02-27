#nullable enable
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AdminManager.Core.Domain.Despatch;

[Table("JobPhoto")]
public partial class JobPhoto
{
    [Key]
    [Column("Id")]
    public int Id { get; set; }

    [Column("JobId")]
    public int JobId { get; set; }

    [Column("PhotoType")]
    [StringLength(50)]
    public string PhotoType { get; set; } = "delivery";

    [Column("BlobUrl")]
    [StringLength(500)]
    public string BlobUrl { get; set; } = null!;

    [Column("ThumbnailUrl")]
    [StringLength(500)]
    public string? ThumbnailUrl { get; set; }

    [Column("CapturedAt")]
    public DateTime CapturedAt { get; set; }

    [Column("CapturedBy")]
    public int? CapturedBy { get; set; }

    [Column("GpsLatitude", TypeName = "decimal(9,6)")]
    public decimal? GpsLatitude { get; set; }

    [Column("GpsLongitude", TypeName = "decimal(9,6)")]
    public decimal? GpsLongitude { get; set; }

    [Column("Notes")]
    [StringLength(500)]
    public string? Notes { get; set; }
}
