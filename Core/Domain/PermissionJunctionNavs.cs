using System.Collections.Generic;

namespace DfrntDriveConfigurator.Core.Domain.Despatch;

// Hand-authored, regen-safe (lives outside the EFPT output folder
// Core/Domain/Despatch). Adds the explicit join-entity navigations the
// role/contact services rely on.
//
// EF Power Tools collapses pure 2-FK junctions into skip-nav many-to-many
// (UseManyToManyEntity=false — kept because TenantRouteService depends on the
// Route.ZipPolygons skip-nav). tblRoleClientType + tblContactContactRole are
// therefore excluded from efpt.config.json and configured explicitly in
// DynamicDespatchDbContext.OnModelCreating; these partial collections give
// TblContactRole its join-side navigations (role.TblRoleClientTypes /
// role.TblContactContactRoles).
public partial class TblContactRole
{
    public virtual ICollection<TblRoleClientType> TblRoleClientTypes { get; set; } = new List<TblRoleClientType>();

    public virtual ICollection<TblContactContactRole> TblContactContactRoles { get; set; } = new List<TblContactContactRole>();
}
