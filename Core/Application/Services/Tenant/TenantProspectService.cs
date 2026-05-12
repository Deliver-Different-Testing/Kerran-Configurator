using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;
using DfrntDriveConfigurator.Core.Application.Dtos.Tenant;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Tenant;

public class TenantProspectService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IHttpContextAccessor httpContextAccessor) : BaseService(contextFactory)
{
    // Returns the ProspectAgent directory, filtered by optional search (matches
    // company name, city, contact name) and association (CLDA/ECA).
    public async Task<TenantProspectsResponse> Search(string? search, string? association, Guid messageId)
    {
        var query = Context.ProspectAgents
            .AsNoTracking()
            .Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(association))
        {
            query = query.Where(p => p.AssociationSource == association);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var like = $"%{search.Trim()}%";
            query = query.Where(p =>
                EF.Functions.Like(p.CompanyName ?? string.Empty, like)
                || EF.Functions.Like(p.City ?? string.Empty, like)
                || EF.Functions.Like(p.ContactName ?? string.Empty, like));
        }

        var rows = await query
            .OrderBy(p => p.CompanyName)
            .Take(200)
            .Select(p => new
            {
                p.Id,
                p.CompanyName,
                p.ContactName,
                p.Email,
                p.Phone,
                p.City,
                p.State,
                p.AssociationSource,
                p.ServiceTypes,
                p.FleetSize,
                p.IsVerified,
                p.ConvertedToAgentId,
            })
            .ToListAsync();

        var prospects = rows.Select(r => new TenantProspectDto
        {
            Id = r.Id,
            CompanyName = r.CompanyName ?? string.Empty,
            ContactName = r.ContactName ?? string.Empty,
            Email = r.Email ?? string.Empty,
            Phone = r.Phone ?? string.Empty,
            City = r.City ?? string.Empty,
            State = r.State ?? string.Empty,
            Association = r.AssociationSource ?? string.Empty,
            Specialties = SplitCsv(r.ServiceTypes),
            FleetSize = r.FleetSize,
            IsVerified = r.IsVerified,
            ConvertedToAgent = r.ConvertedToAgentId != null,
        }).ToList();

        return new TenantProspectsResponse(messageId)
        {
            Success = true,
            Prospects = prospects,
        };
    }

    // Convert a ProspectAgent into a real tucAgent row. Creates the new agent
    // with reasonable defaults (SuburbId=152 — same convention as elsewhere
    // until a suburb picker exists; IsNetworkPartner=false; null status). Then
    // stamps the prospect with ConvertedToAgentId + ConvertedDate so the
    // directory marks it "Already an Agent".
    public async Task<TenantProspectConvertResponse> ConvertToAgent(int prospectId, Guid messageId)
    {
        var prospect = await Context.ProspectAgents.FirstOrDefaultAsync(p => p.Id == prospectId);
        if (prospect is null)
        {
            return Fail(messageId, "Prospect not found.");
        }

        if (prospect.ConvertedToAgentId is not null)
        {
            return Fail(messageId, "Prospect has already been converted.");
        }

        var actor = httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
                    ?? httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value
                    ?? "system";
        var now = DateTime.UtcNow;

        var agent = new TucAgent
        {
            UcagName = prospect.CompanyName ?? string.Empty,
            UcagPhone = prospect.Phone ?? string.Empty,
            AddressLine1 = prospect.Address ?? string.Empty,
            PostCode = prospect.PostCode ?? string.Empty,
            UcagSuburbId = 152,
            UcagAddress = string.Empty,
            UcagFax = string.Empty,
            UcagAltPhone = string.Empty,
            UcagAltFax = string.Empty,
            UcagNotes = string.Empty,
            Notes = $"Converted from ProspectAgent #{prospect.Id} ({prospect.AssociationSource}).",
            IsNetworkPartner = false,
            NpPortalEnabled = false,
            NpTier = 1,
            CreatedBy = actor,
            LastModifiedBy = actor,
            Created = now,
            LastModified = now,
        };
        Context.TucAgents.Add(agent);
        await Context.SaveChangesAsync();

        prospect.ConvertedToAgentId = agent.UcagId;
        prospect.ConvertedDate = now;
        prospect.UpdatedDate = now;
        await Context.SaveChangesAsync();

        return new TenantProspectConvertResponse(messageId)
        {
            Success = true,
            AgentId = agent.UcagId,
            AgentName = agent.UcagName,
        };
    }

    private static TenantProspectConvertResponse Fail(Guid messageId, string message) => new(messageId)
    {
        Success = false,
        Messages = { new MessageDto { Message = message } },
    };

    // ServiceTypes is a comma-delimited string in the seed data. Split, trim,
    // drop empties, cap at 6 to keep the directory cards tidy.
    private static List<string> SplitCsv(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new List<string>();
        return raw.Split(',')
            .Select(s => s.Trim())
            .Where(s => s.Length > 0)
            .Take(6)
            .ToList();
    }
}
