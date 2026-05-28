using System;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Np;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

// Registration Settings — toggles applicant registration per site via the
// legacy TblSite.CourierApplicantEnabled column (the same flag courierportal
// reads). Tenant-wide config; not NP-scoped. No new schema.
public class NpRegistrationSiteService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    public async Task<NpRegistrationSitesResponse> GetAll(Guid messageId)
    {
        var rows = await Context.TblSites.AsNoTracking()
            .OrderBy(s => s.Name)
            .Select(ProjectToDto)
            .ToListAsync();

        return new NpRegistrationSitesResponse(messageId) { Success = true, Sites = rows };
    }

    public async Task<NpRegistrationSiteResponse> SetEnabledAsync(int id, NpRegistrationSiteToggleDto dto, Guid messageId)
    {
        var site = await Context.TblSites.FirstOrDefaultAsync(s => s.SiteId == id);
        if (site is null)
            return Fail(messageId, "Site not found.");

        site.CourierApplicantEnabled = dto.ApplicantEnabled;

        // Email claim is set by Hub at login (ClaimTypes.Name).
        site.LastModified = DateTime.UtcNow;
        site.LastModifiedBy = httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
                              ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
                              ?? "system";

        await Context.SaveChangesAsync();

        var read = await Context.TblSites.AsNoTracking()
            .Where(s => s.SiteId == id)
            .Select(ProjectToDto)
            .FirstOrDefaultAsync();

        return new NpRegistrationSiteResponse(messageId) { Success = true, Site = read };
    }

    private static NpRegistrationSiteResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new() { Message = message } },
    };

    private static readonly Expression<Func<TblSite, NpRegistrationSiteDto>> ProjectToDto = s => new NpRegistrationSiteDto
    {
        Id = s.SiteId,
        Name = s.Name ?? string.Empty,
        ApplicantEnabled = s.CourierApplicantEnabled ?? false,
    };
}
