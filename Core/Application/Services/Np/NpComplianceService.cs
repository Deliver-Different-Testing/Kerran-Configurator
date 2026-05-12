using System;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

public class NpComplianceService(IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseService(contextFactory)
{
    public Task<NpComplianceDashboardResponse> GetDashboard(Guid messageId)
    {
        // Real endpoint, sparse data: expiringCount stays 0 until the compliance
        // tracking schema (CourierDocument expiry dates, ComplianceProfile rules)
        // lands. Once those tables exist, expand this to compute real counts.
        var response = new NpComplianceDashboardResponse(messageId)
        {
            Success = true,
            Dashboard = new NpComplianceDashboardDto { ExpiringCount = 0 },
        };
        return Task.FromResult(response);
    }
}
