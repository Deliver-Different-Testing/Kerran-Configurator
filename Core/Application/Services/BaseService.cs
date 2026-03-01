using System;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services
{
    public class BaseService(IDbContextFactory<DynamicDespatchDbContext> contextFactory) : IDisposable
    {
        private DynamicDespatchDbContext? _context;
        protected DynamicDespatchDbContext Context
        {
            get { return _context ??= contextFactory.CreateDbContext(); }
        }
        public void Dispose()
        {
            _context?.Dispose();
        }
    }
}
