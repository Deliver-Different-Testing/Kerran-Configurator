using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Domain
{
    public class DynamicDespatchDbContext(DbContextOptions<DespatchContext> options) : DespatchContext(options)
    {
    }
}
