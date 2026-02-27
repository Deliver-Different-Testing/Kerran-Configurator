#nullable enable
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AdminManager.Core.Domain.Despatch;

[Table("JobWorkflowStep")]
public partial class JobWorkflowStep
{
    [Key]
    [Column("Id")]
    public int Id { get; set; }

    [Column("JobId")]
    public int JobId { get; set; }

    [Column("TemplateDetailId")]
    public int TemplateDetailId { get; set; }

    [Column("CompletedAt")]
    public DateTime? CompletedAt { get; set; }

    [Column("CompletedBy")]
    public int? CompletedBy { get; set; }

    [Column("DataType")]
    [StringLength(20)]
    public string? DataType { get; set; }

    [Column("TextData")]
    public string? TextData { get; set; }

    [Column("BlobUrl")]
    [StringLength(500)]
    public string? BlobUrl { get; set; }

    [Column("GpsLatitude", TypeName = "decimal(9,6)")]
    public decimal? GpsLatitude { get; set; }

    [Column("GpsLongitude", TypeName = "decimal(9,6)")]
    public decimal? GpsLongitude { get; set; }

    [ForeignKey("TemplateDetailId")]
    public virtual TucEventTemplateDetail TemplateDetail { get; set; } = null!;
}
