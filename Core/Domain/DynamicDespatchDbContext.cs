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

        // Agent/NP Onboarding pipeline (2026-06-09). Hand-authored entities,
        // configured here so they survive EFPT regen (not in efpt.config.json).
        public virtual DbSet<TucAgentOnboarding> TucAgentOnboardings { get; set; }
        public virtual DbSet<TucAgentOnboardingCoverageArea> TucAgentOnboardingCoverageAreas { get; set; }
        public virtual DbSet<TucAgentOnboardingCompliance> TucAgentOnboardingCompliances { get; set; }
        public virtual DbSet<TucAgentOnboardingTimeline> TucAgentOnboardingTimelines { get; set; }

        // Agent/NP post-activation business-document compliance (2026-06-10).
        // Hand-authored entity (database/040), configured here so it survives
        // EFPT regen (not in efpt.config.json).
        public virtual DbSet<TucAgentDocument> TucAgentDocuments { get; set; }

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

            modelBuilder.Entity<TucAgentOnboarding>(entity =>
            {
                entity.HasKey(e => e.UcaoId);
                entity.ToTable("tucAgentOnboarding");
                entity.Property(e => e.UcaoId).HasColumnName("ucaoID");
                entity.Property(e => e.UcagId).HasColumnName("ucagID");
                // Optional link to the activated agent. No inverse collection on
                // TucAgent (avoids widening the EFPT-scaffolded entity).
                entity.HasOne(e => e.Agent).WithMany()
                    .HasForeignKey(e => e.UcagId)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_tucAgentOnboarding_tucAgents");
            });

            modelBuilder.Entity<TucAgentOnboardingCoverageArea>(entity =>
            {
                entity.HasKey(e => e.UcaocId);
                entity.ToTable("tucAgentOnboardingCoverageArea");
                entity.Property(e => e.UcaocId).HasColumnName("ucaocID");
                entity.Property(e => e.UcaoId).HasColumnName("ucaoID");
                entity.HasOne(e => e.Onboarding).WithMany(o => o.CoverageAreas)
                    .HasForeignKey(e => e.UcaoId)
                    .OnDelete(DeleteBehavior.Cascade)
                    .HasConstraintName("FK_tucAgentOnboardingCoverageArea_tucAgentOnboarding");
            });

            modelBuilder.Entity<TucAgentOnboardingCompliance>(entity =>
            {
                entity.HasKey(e => e.UcaodId);
                entity.ToTable("tucAgentOnboardingCompliance");
                entity.Property(e => e.UcaodId).HasColumnName("ucaodID");
                entity.Property(e => e.UcaoId).HasColumnName("ucaoID");
                entity.HasOne(e => e.Onboarding).WithMany(o => o.ComplianceItems)
                    .HasForeignKey(e => e.UcaoId)
                    .OnDelete(DeleteBehavior.Cascade)
                    .HasConstraintName("FK_tucAgentOnboardingCompliance_tucAgentOnboarding");
            });

            modelBuilder.Entity<TucAgentOnboardingTimeline>(entity =>
            {
                entity.HasKey(e => e.UcaotId);
                entity.ToTable("tucAgentOnboardingTimeline");
                entity.Property(e => e.UcaotId).HasColumnName("ucaotID");
                entity.Property(e => e.UcaoId).HasColumnName("ucaoID");
                entity.HasOne(e => e.Onboarding).WithMany(o => o.TimelineEvents)
                    .HasForeignKey(e => e.UcaoId)
                    .OnDelete(DeleteBehavior.Cascade)
                    .HasConstraintName("FK_tucAgentOnboardingTimeline_tucAgentOnboarding");
            });

            modelBuilder.Entity<TucAgentDocument>(entity =>
            {
                entity.HasKey(e => e.UcadId);
                entity.ToTable("tucAgentDocument");
                // PascalCase columns match property names (database/040) — no
                // per-property HasColumnName needed. Only the DocumentType join
                // is configured; the AgentId FK is enforced by the DB constraint
                // and queried as a plain int (no nav, to avoid widening tucAgent).
                entity.HasOne(e => e.DocumentType).WithMany()
                    .HasForeignKey(e => e.DocumentTypeId)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_tucAgentDocument_DocumentType");
            });
        }
    }
}
