using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Interfaces;
using DfrntDriveConfigurator.Core.Domain;
using DfrntDriveConfigurator.Core.Domain.Despatch;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services;

public class AutomationRepository(IDbContextFactory<DynamicDespatchDbContext> contextFactory)
    : BaseService(contextFactory), IAutomationRepository
{
    public async Task<List<AutomationRule>> GetActiveRulesAsync(CancellationToken ct = default) =>
        await Context.AutomationRules
            .Include(r => r.AutomationConditions.OrderBy(c => c.SortOrder))
            .Include(r => r.AutomationActions.OrderBy(a => a.SortOrder))
            .Where(r => r.IsActive && !r.IsDeleted)
            .AsNoTracking()
            .ToListAsync(ct);

    public async Task<List<AutomationRule>> GetTimeBasedRulesAsync(CancellationToken ct = default) =>
        await Context.AutomationRules
            .Include(r => r.AutomationConditions.OrderBy(c => c.SortOrder))
            .Include(r => r.AutomationActions.OrderBy(a => a.SortOrder))
            .Where(r => r.IsActive && !r.IsDeleted && r.AutomationConditions.Any(c =>
                c.ConditionType == "BeforeScheduledTime" ||
                c.ConditionType == "AfterScheduledTime" ||
                c.ConditionType == "AtScheduledTime" ||
                c.ConditionType == "JobUnassigned" ||
                c.ConditionType == "JobAssigned"))
            .AsNoTracking()
            .ToListAsync(ct);

    public async Task<AutomationRule?> GetByIdAsync(int id, CancellationToken ct = default) =>
        await Context.AutomationRules
            .Include(r => r.AutomationConditions.OrderBy(c => c.SortOrder))
            .Include(r => r.AutomationActions.OrderBy(a => a.SortOrder))
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted, ct);

    public async Task<List<AutomationRule>> GetAllAsync(int? customerId, int? speedId, string? search, bool? isActive, CancellationToken ct = default)
    {
        var query = Context.AutomationRules
            .Include(r => r.AutomationConditions.OrderBy(c => c.SortOrder))
            .Include(r => r.AutomationActions.OrderBy(a => a.SortOrder))
            .Where(r => !r.IsDeleted)
            .AsQueryable();

        if (isActive.HasValue)
            query = query.Where(r => r.IsActive == isActive.Value);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(r => r.Name.Contains(search) || (r.Description != null && r.Description.Contains(search)));

        if (customerId.HasValue)
            query = query.Where(r => r.AllCustomers || (r.CustomerIds != null && r.CustomerIds.Contains(customerId.Value.ToString())));

        if (speedId.HasValue)
            query = query.Where(r => r.AllSpeeds || (r.SpeedIds != null && r.SpeedIds.Contains(speedId.Value.ToString())));

        return await query.AsNoTracking().OrderBy(r => r.Name).ToListAsync(ct);
    }

    public async Task<AutomationRule> CreateAsync(AutomationRule rule, CancellationToken ct = default)
    {
        rule.CreatedDate = DateTime.UtcNow;
        Context.AutomationRules.Add(rule);
        await Context.SaveChangesAsync(ct);
        return rule;
    }

    public async Task UpdateAsync(AutomationRule rule, CancellationToken ct = default)
    {
        // The rule passed in was already loaded with tracking by GetByIdAsync (called by the controller).
        // The controller has already updated scalar properties and replaced the conditions/actions
        // collections. We just need to:
        // 1. Delete the old conditions/actions that are no longer present
        // 2. Mark new ones for insertion
        // 3. Save

        rule.ModifiedDate = DateTime.UtcNow;

        // Find orphaned conditions/actions that the change tracker knows about
        // but which were removed from the navigation collections by the controller's .Clear() + re-add
        var trackedConditions = Context.ChangeTracker.Entries<AutomationCondition>()
            .Where(e => e.Entity.RuleId == rule.Id && e.State == EntityState.Deleted)
            .ToList();
        var trackedActions = Context.ChangeTracker.Entries<AutomationAction>()
            .Where(e => e.Entity.RuleId == rule.Id && e.State == EntityState.Deleted)
            .ToList();

        // If the controller didn't trigger deletions via Clear(), do it via raw SQL as fallback
        if (trackedConditions.Count == 0 && trackedActions.Count == 0)
        {
            // Delete old children directly, then add the new ones
            await Context.AutomationConditions.Where(c => c.RuleId == rule.Id).ExecuteDeleteAsync(ct);
            await Context.AutomationActions.Where(a => a.RuleId == rule.Id).ExecuteDeleteAsync(ct);

            // Ensure new conditions/actions are tracked as Added
            foreach (var c in rule.AutomationConditions)
            {
                c.Id = 0;
                c.RuleId = rule.Id;
                Context.Entry(c).State = EntityState.Added;
            }

            foreach (var a in rule.AutomationActions)
            {
                a.Id = 0;
                a.RuleId = rule.Id;
                Context.Entry(a).State = EntityState.Added;
            }
        }

        await Context.SaveChangesAsync(ct);
    }

    public async Task SoftDeleteAsync(int id, CancellationToken ct = default)
    {
        var rule = await Context.AutomationRules.FindAsync(new object[] { id }, ct);
        if (rule is not null)
        {
            rule.IsDeleted = true;
            rule.IsActive = false;
            rule.ModifiedDate = DateTime.UtcNow;
            await Context.SaveChangesAsync(ct);
        }
    }

    public async Task ToggleActiveAsync(int id, CancellationToken ct = default)
    {
        var rule = await Context.AutomationRules.FindAsync(new object[] { id }, ct);
        if (rule is not null)
        {
            rule.IsActive = !rule.IsActive;
            rule.ModifiedDate = DateTime.UtcNow;
            await Context.SaveChangesAsync(ct);
        }
    }

    public async Task<AutomationExecutionLog> LogExecutionAsync(AutomationExecutionLog log, CancellationToken ct = default)
    {
        Context.AutomationExecutionLogs.Add(log);
        await Context.SaveChangesAsync(ct);
        return log;
    }

    public async Task<bool> HasBeenEvaluatedRecentlyAsync(int ruleId, int jobId, int windowMinutes, CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow.AddMinutes(-windowMinutes);
        return await Context.AutomationExecutionLogs
            .AnyAsync(l => l.RuleId == ruleId && l.JobId == jobId && l.ConditionsMet && l.ExecutedDate >= cutoff, ct);
    }

    public async Task<List<AutomationExecutionLog>> GetLogsAsync(
        int? ruleId, int? jobId, DateTime? from, DateTime? to,
        string? triggerType, bool? conditionsMet, int skip, int take, CancellationToken ct = default)
    {
        var query = Context.AutomationExecutionLogs
            .Include(l => l.ActionExecutionDetails)
            .AsQueryable();

        if (ruleId.HasValue) query = query.Where(l => l.RuleId == ruleId.Value);
        if (jobId.HasValue) query = query.Where(l => l.JobId == jobId.Value);
        if (from.HasValue) query = query.Where(l => l.ExecutedDate >= from.Value);
        if (to.HasValue) query = query.Where(l => l.ExecutedDate <= to.Value);
        if (!string.IsNullOrEmpty(triggerType)) query = query.Where(l => l.TriggerType == triggerType);
        if (conditionsMet.HasValue) query = query.Where(l => l.ConditionsMet == conditionsMet.Value);

        return await query
            .OrderByDescending(l => l.ExecutedDate)
            .Skip(skip).Take(take)
            .AsNoTracking()
            .ToListAsync(ct);
    }

    public async Task<AutomationExecutionLog?> GetLogByIdAsync(int id, CancellationToken ct = default) =>
        await Context.AutomationExecutionLogs
            .Include(l => l.ActionExecutionDetails)
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == id, ct);
}
