#nullable enable
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AdminManager.Core.Domain.Despatch;

[Table("JobBarcode")]
public partial class JobBarcode
{
    [Key]
    [Column("Id")]
    public int Id { get; set; }

    [Column("JobId")]
    public int JobId { get; set; }

    [Column("BarcodeValue")]
    [StringLength(500)]
    public string BarcodeValue { get; set; } = null!;

    [Column("BarcodeType")]
    [StringLength(50)]
    public string? BarcodeType { get; set; }

    [Column("ScannedAt")]
    public DateTime ScannedAt { get; set; }

    [Column("ScannedBy")]
    public int? ScannedBy { get; set; }

    [Column("GpsLatitude", TypeName = "decimal(9,6)")]
    public decimal? GpsLatitude { get; set; }

    [Column("GpsLongitude", TypeName = "decimal(9,6)")]
    public decimal? GpsLongitude { get; set; }
}
