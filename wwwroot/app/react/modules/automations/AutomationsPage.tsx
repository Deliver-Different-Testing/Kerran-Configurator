import { useState, useMemo, useEffect, useCallback } from 'react';
import { AutomationCard } from './components/AutomationCard';
import { SearchableSelect } from './components/SearchableSelect';
import type {
  AutomationRule,
  AutomationFilterState,
  CustomerOption,
  SpeedOption,
  SiteOption,
  RegionOption,
  JobStatus,
  TaskTemplate,
  NotificationTemplate,
  ReportOption,
} from './types';
import { createEmptyAutomation } from './types';
import {
  fetchAutomations,
  fetchCustomersByIds,
  searchCustomers,
  fetchSpeeds,
  fetchSites,
  fetchRegions,
  fetchJobStatuses,
  fetchTaskTemplates,
  fetchNotificationTemplates,
  createAutomation,
  updateAutomation,
  deleteAutomation as deleteAutomationApi,
  fetchAvailableReports,
  apiRuleToFrontend,
  frontendRuleToApi,
} from './api';

// ---------------------------------------------------------------------------
// Hook: load data from the API
// ---------------------------------------------------------------------------

function useAutomationsData() {
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [speeds, setSpeeds] = useState<SpeedOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [jobStatuses, setJobStatuses] = useState<JobStatus[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplate[]>([]);
  const [availableReports, setAvailableReports] = useState<ReportOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesData, speedData, siteData, regionData, statusData, taskData, notifData, reportsData] =
        await Promise.all([
          fetchAutomations(),
          fetchSpeeds(),
          fetchSites(),
          fetchRegions(),
          fetchJobStatuses(),
          fetchTaskTemplates(),
          fetchNotificationTemplates(),
          fetchAvailableReports(),
        ]);
      const rules = rulesData.map(apiRuleToFrontend);
      setAutomations(rules);
      setSpeeds(speedData);
      setSites(siteData);
      setRegions(regionData);
      setJobStatuses(statusData);
      setTaskTemplates(taskData);
      setNotificationTemplates(notifData);
      setAvailableReports(reportsData);

      // Resolve only the customer IDs referenced by existing rules (not all customers)
      const allCustomerIds = new Set<string>();
      for (const rule of rules) {
        for (const id of rule.scope.customerIds) allCustomerIds.add(id);
      }
      if (allCustomerIds.size > 0) {
        const resolvedCustomers = await fetchCustomersByIds([...allCustomerIds]);
        setCustomers(resolvedCustomers);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return {
    automations, setAutomations,
    customers, setCustomers, speeds, sites, regions, jobStatuses, taskTemplates, notificationTemplates, availableReports,
    loading, error, reload: loadAll,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AutomationsPageProps {
  showToast?: (msg: string) => void;
}

export function AutomationsPage({ showToast }: AutomationsPageProps) {
  const {
    automations, setAutomations,
    customers, setCustomers, speeds, sites, regions, jobStatuses, taskTemplates, notificationTemplates, availableReports,
    loading, error, reload,
  } = useAutomationsData();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newAutomation, setNewAutomation] = useState<AutomationRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState<AutomationFilterState>({
    customerId: 'all', speedId: 'all', search: '',
  });

  const filteredAutomations = useMemo(() => {
    return automations.filter((auto) => {
      if (filters.customerId !== 'all') {
        if (!auto.scope.allCustomers && !auto.scope.customerIds.includes(filters.customerId)) return false;
      }
      if (filters.speedId !== 'all') {
        if (!auto.scope.allSpeeds && !auto.scope.speedIds.includes(filters.speedId)) return false;
      }
      if (filters.search) {
        const query = filters.search.toLowerCase();
        if (!auto.name.toLowerCase().includes(query) && !auto.description?.toLowerCase().includes(query)) return false;
      }
      return true;
    });
  }, [automations, filters]);

  // Ensure all customer IDs referenced by a rule are resolved in local state
  const ensureCustomersResolved = async (rule: AutomationRule) => {
    const missingIds = rule.scope.customerIds.filter(
      (id) => !customers.find((c) => c.id === id),
    );
    if (missingIds.length > 0) {
      const resolved = await fetchCustomersByIds(missingIds);
      if (resolved.length > 0) {
        setCustomers((prev) => [...prev, ...resolved]);
      }
    }
  };

  const handleNewAutomation = () => {
    const empty = createEmptyAutomation();
    setNewAutomation({ ...empty, id: `auto-new-${Date.now()}`, createdAt: '', updatedAt: '' });
    setIsCreating(true);
    setExpandedId(null);
  };

  const handleSaveNew = async (automation: AutomationRule) => {
    setSaving(true);
    try {
      const created = await createAutomation(frontendRuleToApi(automation));
      const frontendRule = apiRuleToFrontend(created);
      setAutomations((prev) => [frontendRule, ...prev]);
      await ensureCustomersResolved(frontendRule);
      setIsCreating(false);
      setNewAutomation(null);
      showToast?.('Automation created');
    } catch (err) {
      alert(`Failed to create: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelNew = () => {
    setIsCreating(false);
    setNewAutomation(null);
  };

  const handleUpdate = async (automation: AutomationRule) => {
    setSaving(true);
    try {
      const updated = await updateAutomation(Number(automation.id), frontendRuleToApi(automation));
      const frontendRule = apiRuleToFrontend(updated);
      setAutomations((prev) => prev.map((a) => (a.id === automation.id ? frontendRule : a)));
      await ensureCustomersResolved(frontendRule);
      setExpandedId(null);
      showToast?.('Automation saved');
    } catch (err) {
      alert(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this automation?')) return;
    try {
      await deleteAutomationApi(Number(id));
      setAutomations((prev) => prev.filter((a) => a.id !== id));
      showToast?.('Automation deleted');
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const hasActiveFilters = filters.customerId !== 'all' || filters.speedId !== 'all' || filters.search !== '';

  // Loading
  if (loading) {
    return (
      <div className="main">
        <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'rgba(13,12,44,.45)' }}>Loading automations...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="main">
        <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Failed to load automations</p>
            <p style={{ fontSize: 13, color: 'rgba(13,12,44,.45)', marginBottom: 16 }}>{error}</p>
            <button className="btn btn-primary" onClick={reload}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main">
      {/* Header */}
      <div className="topbar">
        <div className="topbar-top">
          <div>
            <h1>Automations</h1>
            <div className="subtitle">Create "if this then that" rules to automate workflows</div>
          </div>
          <button className="btn btn-primary" onClick={handleNewAutomation} disabled={isCreating || saving}>
            + New Automation
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="content">
        {/* Filters */}
        <div className="filter-bar">
          <input
            className="input"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Search automations..."
            style={{ flex: 1, maxWidth: 360 }}
          />
          <SearchableSelect
            onSearch={(q) => searchCustomers(q, 20)}
            value={filters.customerId}
            selectedLabel={customers.find((c) => c.id === filters.customerId)?.name}
            onChange={(val) => {
              setFilters((prev) => ({ ...prev, customerId: val }));
            }}
            placeholder="Search customers..."
            allLabel="All Customers"
          />
          <select
            value={filters.speedId}
            onChange={(e) => setFilters((prev) => ({ ...prev, speedId: e.target.value }))}
          >
            <option value="all">All Speeds</option>
            {speeds.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              className="btn btn-sm btn-outline"
              onClick={() => setFilters({ customerId: 'all', speedId: 'all', search: '' })}
            >
              Clear
            </button>
          )}
        </div>

        <div style={{ fontSize: 13, color: 'rgba(13,12,44,.45)', marginBottom: 12 }}>
          Showing {filteredAutomations.length} of {automations.length} automations
        </div>

        {/* New Automation Card */}
        {isCreating && newAutomation && (
          <AutomationCard
            automation={newAutomation}
            customers={customers}
            speeds={speeds}
            sites={sites}
            regions={regions}
            jobStatuses={jobStatuses}
            taskTemplates={taskTemplates}
            notificationTemplates={notificationTemplates}
            availableReports={availableReports}
            onSearchCustomers={(q) => searchCustomers(q, 20)}
            isExpanded={true}
            isNew={true}
            onToggle={() => {}}
            onSave={handleSaveNew}
            onDelete={handleCancelNew}
            onCancel={handleCancelNew}
          />
        )}

        {/* Automations List */}
        {filteredAutomations.map((automation) => (
          <AutomationCard
            key={automation.id}
            automation={automation}
            customers={customers}
            speeds={speeds}
            sites={sites}
            regions={regions}
            jobStatuses={jobStatuses}
            taskTemplates={taskTemplates}
            notificationTemplates={notificationTemplates}
            availableReports={availableReports}
            onSearchCustomers={(q) => searchCustomers(q, 20)}
            isExpanded={expandedId === automation.id}
            onToggle={() => setExpandedId(expandedId === automation.id ? null : automation.id)}
            onSave={handleUpdate}
            onDelete={() => handleDelete(automation.id)}
          />
        ))}

        {filteredAutomations.length === 0 && !isCreating && (
          <div className="auto-empty-state" style={{ padding: '48px 20px' }}>
            <p style={{ fontWeight: 500, marginBottom: 4 }}>No automations found</p>
            <p>
              {hasActiveFilters
                ? 'Try adjusting your filters'
                : 'Click "New Automation" to create your first rule'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
