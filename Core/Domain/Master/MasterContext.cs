#nullable disable
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Domain.Master;

// Single fixed-connection context onto the master-controller DB (the auth /
// MasterController database), registered against the MasterSQLConnection env
// var in Program.cs. Unlike DespatchContext this is NOT per-tenant dynamic —
// there is one master-controller DB for the whole stack.
//
// Scope is deliberately minimal: configurator's only write here is creating /
// reconciling courier login rows so new couriers can sign in to the mobile
// app. Mapping mirrors the relevant slice of AdminManager's scaffolded
// MasterContext for the [User] table.
public class MasterContext : DbContext
{
    public MasterContext(DbContextOptions<MasterContext> options)
        : base(options)
    {
    }

    public virtual DbSet<User> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("User");

            entity.HasKey(e => e.UserId);

            entity.Property(e => e.Email)
                .IsRequired()
                .HasMaxLength(250);
            entity.Property(e => e.IsLegacyHash).HasDefaultValue(true);
            entity.Property(e => e.Password)
                .IsRequired()
                .HasMaxLength(200);
            entity.Property(e => e.ResetKey).HasMaxLength(50);
            entity.Property(e => e.Salt)
                .IsRequired()
                .HasMaxLength(64);
        });
    }
}
