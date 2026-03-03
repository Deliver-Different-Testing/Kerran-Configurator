using System;
using System.Linq;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Lookup;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services
{
    public class LookupService(IDbContextFactory<DynamicDespatchDbContext> contextFactory) : BaseService(contextFactory)
    {
        public async Task<ClientsResponse> GetClients(Guid messageId)
        {
            var clients = await Context.TucClients
                .Where(c => c.UcclActive)
                .OrderBy(c => c.UcclName)
                .Select(c => new ClientLookupDto
                {
                    Id = c.UcclId,
                    Name = c.UcclName ?? "",
                    Code = c.UcclCode ?? ""
                })
                .Take(200)
                .ToListAsync();

            return new ClientsResponse(messageId)
            {
                Success = true,
                Clients = clients
            };
        }

        public async Task<ClientsResponse> SearchClients(string? query, int limit, Guid messageId)
        {
            var q = Context.TucClients.Where(c => c.UcclActive);

            if (!string.IsNullOrWhiteSpace(query))
            {
                q = q.Where(c => c.UcclName.Contains(query) || c.UcclCode.Contains(query));
            }

            var clients = await q
                .OrderBy(c => c.UcclName)
                .Select(c => new ClientLookupDto
                {
                    Id = c.UcclId,
                    Name = c.UcclName ?? "",
                    Code = c.UcclCode ?? ""
                })
                .Take(limit)
                .ToListAsync();

            return new ClientsResponse(messageId)
            {
                Success = true,
                Clients = clients
            };
        }

        public async Task<ServicesResponse> GetServices(Guid messageId)
        {
            var services = await Context.TucJobTypes
                .OrderBy(j => j.UcjtName)
                .Select(j => new ServiceLookupDto
                {
                    Id = j.UcjtId,
                    Name = j.UcjtName ?? "",
                    Code = j.UcjtCode ?? ""
                })
                .Take(200)
                .ToListAsync();

            return new ServicesResponse(messageId)
            {
                Success = true,
                Services = services
            };
        }

        public async Task<ServicesResponse> SearchServices(string? query, int limit, Guid messageId)
        {
            var q = Context.TucJobTypes.AsQueryable();

            if (!string.IsNullOrWhiteSpace(query))
            {
                q = q.Where(j => j.UcjtName.Contains(query) || j.UcjtCode.Contains(query));
            }

            var services = await q
                .OrderBy(j => j.UcjtName)
                .Select(j => new ServiceLookupDto
                {
                    Id = j.UcjtId,
                    Name = j.UcjtName ?? "",
                    Code = j.UcjtCode ?? ""
                })
                .Take(limit)
                .ToListAsync();

            return new ServicesResponse(messageId)
            {
                Success = true,
                Services = services
            };
        }
    }
}
