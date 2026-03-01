using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Domain.Despatch;

[Table("tblUser")]
[Index("StaffId", Name = "StaffID")]
[Index("UserGroupId", Name = "UserGroupID")]
public partial class TblUser
{
    [Key]
    [StringLength(50)]
    public string UserName { get; set; } = null!;

    [StringLength(50)]
    public string FullName { get; set; } = null!;

    [Column("UserGroupID")]
    public int UserGroupId { get; set; }

    [Column(TypeName = "datetime")]
    public DateTime? LastAccessed { get; set; }

    public bool Active { get; set; }

    [Column("StaffID")]
    public int? StaffId { get; set; }

    public bool InternetAccess { get; set; }
}
