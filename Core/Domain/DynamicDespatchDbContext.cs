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

        // Agent/NP client compliance-profile overlays (2026-06-11, database/043).
        public virtual DbSet<TucAgentComplianceProfile> TucAgentComplianceProfiles { get; set; }

        // Courier compliance-profile assignment (courier modal §11, database/054).
        public virtual DbSet<CourierComplianceProfile> CourierComplianceProfiles { get; set; }

        // Legacy events log, repurposed for courier communications (modal §13).
        public virtual DbSet<TucEvent> TucEvents { get; set; }

        // Courier SMS 2FA code store (modal §17b, database/057). Hand-authored
        // entity, configured here so it survives EFPT regen (not in efpt.config.json).
        public virtual DbSet<TucSmsAuthCode> TucSmsAuthCodes { get; set; }

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

            // Phase 3b/4b — map the hand-authored DocumentType.ReviewCriteria
            // (database/041) + ExpiryUrgentDays (database/042) columns onto the
            // EFPT-scaffolded entity. Survives regen.
            modelBuilder.Entity<DocumentType>(e =>
            {
                e.Property(d => d.ReviewCriteria).HasColumnName("ReviewCriteria");
                e.Property(d => d.ExpiryUrgentDays).HasColumnName("ExpiryUrgentDays");
            });

            modelBuilder.Entity<TucAgentComplianceProfile>(entity =>
            {
                entity.HasKey(e => e.UacpId);
                entity.ToTable("tucAgentComplianceProfile");
                // PascalCase columns match property names (database/043); no FK
                // navs modelled (queried by AgentId / ProfileId as plain ints).
            });

            modelBuilder.Entity<CourierComplianceProfile>(entity =>
            {
                entity.HasKey(e => e.UccpId);
                entity.ToTable("tucCourierComplianceProfile");
                // PascalCase columns match property names (database/054); no FK
                // navs modelled (queried by CourierId / ProfileId as plain ints).
            });

            modelBuilder.Entity<TucEvent>(entity =>
            {
                entity.HasKey(e => e.UcevId);
                entity.ToTable("tucEvent");
                // Legacy lowercase column names — map explicitly (lean projection).
                entity.Property(e => e.UcevId).HasColumnName("ucevID");
                entity.Property(e => e.UcevType).HasColumnName("ucevType");
                entity.Property(e => e.UcevCourierId).HasColumnName("ucevCourierID");
                entity.Property(e => e.UcevNotes).HasColumnName("ucevNotes");
                entity.Property(e => e.UcevDescription).HasColumnName("ucevDescription");
                entity.Property(e => e.UcevDate).HasColumnName("ucevDate");
                entity.Property(e => e.UcevTime).HasColumnName("ucevTime");
                entity.Property(e => e.UcevOriginator).HasColumnName("ucevOriginator");
                entity.Property(e => e.UcevDespatcher).HasColumnName("ucevDespatcher");
                entity.Property(e => e.UcevPageCourier).HasColumnName("ucevPageCourier");
                entity.Property(e => e.UcevClosed).HasColumnName("ucevClosed");
                entity.Property(e => e.UcevIsScheduled).HasColumnName("ucevIsScheduled");
                entity.Property(e => e.UcevNotificationSent).HasColumnName("ucevNotificationSent");
                entity.Property(e => e.UcevDueTime).HasColumnName("ucevDueTime");
            });

            modelBuilder.Entity<TucSmsAuthCode>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.ToTable("TucSmsAuthCode");
                // PascalCase columns match property names (database/057) — no
                // per-property HasColumnName needed. Queried by CanonicalMobile.
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
