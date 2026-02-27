#nullable enable
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AdminManager.Core.Domain.Despatch;

[Table("AppConfig")]
public partial class AppConfig
{
    [Key]
    [Column("Id")]
    public int Id { get; set; }

    [Column("ConfigKey")]
    [StringLength(100)]
    public string ConfigKey { get; set; } = null!;

    [Column("ConfigValue")]
    public string? ConfigValue { get; set; }

    [Column("DataType")]
    [StringLength(20)]
    public string DataType { get; set; } = "string";

    [Column("Category")]
    [StringLength(50)]
    public string Category { get; set; } = "feature";

    [Column("Description")]
    [StringLength(255)]
    public string? Description { get; set; }

    [Column("IsActive")]
    public bool IsActive { get; set; } = true;

    [Column("Created")]
    public DateTime Created { get; set; }

    [Column("CreatedBy")]
    [StringLength(50)]
    public string? CreatedBy { get; set; }

    [Column("LastModified")]
    public DateTime? LastModified { get; set; }

    [Column("LastModifiedBy")]
    [StringLength(50)]
    public string? LastModifiedBy { get; set; }
}
