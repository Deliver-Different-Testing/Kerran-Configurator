using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Domain
{
    public class DynamicDespatchDbContext(DbContextOptions<DespatchContext> options) : DespatchContext(options)
    {
        // Hand-managed explicit junction entities (Unified Permissions §4.1 /
        // §4.1a). EF Power Tools collapses pure 2-FK junctions into skip-nav
        // many-to-many (the project keeps UseManyToManyEntity=false because
        // TenantRouteService relies on the Route.ZipPolygons skip-nav), but the
        // role/contact services need explicit join entities + DbSets. These two
        // tables are excluded from efpt.config.json and wired up here so the
        // configuration survives every regen. No inverse nav on the ClientType /
        // TucClientContact side — deliberate, to avoid widening those entities.
        public virtual DbSet<TblRoleClientType> TblRoleClientTypes { get; set; }
        public virtual DbSet<TblContactContactRole> TblContactContactRoles { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<TblRoleClientType>(entity =>
            {
                entity.HasKey(e => new { e.ContactRoleId, e.ClientTypeId });
                entity.ToTable("tblRoleClientType");
                entity.HasOne(e => e.ContactRole).WithMany(r => r.TblRoleClientTypes)
                    .HasForeignKey(e => e.ContactRoleId)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_RoleClientType_ContactRole");
                entity.HasOne(e => e.ClientType).WithMany()
                    .HasForeignKey(e => e.ClientTypeId)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_RoleClientType_ClientType");
            });

            modelBuilder.Entity<TblContactContactRole>(entity =>
            {
                entity.HasKey(e => new { e.ClientContactId, e.ContactRoleId });
                entity.ToTable("tblContactContactRole");
                entity.HasOne(e => e.ContactRole).WithMany(r => r.TblContactContactRoles)
                    .HasForeignKey(e => e.ContactRoleId)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_ContactContactRole_Role");
                entity.HasOne(e => e.ClientContact).WithMany()
                    .HasForeignKey(e => e.ClientContactId)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_ContactContactRole_Contact");
            });
        }
    }
}
