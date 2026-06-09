import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAgents } from '@/hooks/useAgents';
import type { AgentStatus } from '@/types';

// Agent / NP compliance roster.
//
// Option-3 scope (mgmt, 2026-06-09): the agent identity / status / NP roster is
// now REAL (GET /api/v1/tenant/agents via useAgents). Post-activation business-
// document compliance (the old NP_DOC_REQUIREMENTS / npDocs matrix) has no
// backend yet, so the doc-health, review-queue, risk and driver-exposure columns
// — all previously derived from in-memory mock data — have been removed rather
// than shown as fabricated numbers. A notice flags the gap. Driver compliance
// remains on its own live tab in ComplianceHub.

const STATUS_TONE: Record<AgentStatus, string> = {
  Active: 'bg-green-100 text-green-700',
  Inactive: 'bg-slate-100 text-slate-600',
  Pending: 'bg-amber-100 text-amber-700',
  Suspended: 'bg-red-100 text-red-700',
  Potential: 'bg-sky-100 text-sky-700',
  'Pending NP': 'bg-violet-100 text-violet-700',
  Archived: 'bg-gray-100 text-gray-500',
};

function MetricCard({
  label,
  value,
  detail,
  tone = 'text-text-primary',
}: {
  label: string;
  value: number | string;
  detail: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">{label}</div>
      <div className={`mt-3 text-3xl font-bold ${tone}`}>{value}</div>
      <div className="mt-2 text-sm text-text-secondary">{detail}</div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export default function AgentComplianceTab() {
  const { agents, loading } = useAgents();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const metrics = useMemo(() => {
    const totalAgents = agents.length;
    const networkPartners = agents.filter((agent) => agent.isNetworkPartner).length;
    const livePartners = agents.filter((agent) => agent.status === 'Active').length;
    const pendingNp = agents.filter((agent) => agent.status === 'Pending NP').length;
    return { totalAgents, networkPartners, livePartners, pendingNp };
  }, [agents]);

  const filteredRows = useMemo(() => agents.filter((agent) => {
    const haystack = `${agent.name} ${agent.contactName} ${agent.city} ${agent.state}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (statusFilter && agent.status !== statusFilter) return false;
    return true;
  }), [agents, search, statusFilter]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Live Partners" value={metrics.livePartners} detail="Active Agent / NP records in the network." tone="text-green-700" />
        <MetricCard label="Network Partners" value={metrics.networkPartners} detail="Agents flagged as Network Partners." tone="text-violet-700" />
        <MetricCard label="Pending NP" value={metrics.pendingNp} detail="Businesses still moving through NP approval." tone="text-amber-700" />
        <MetricCard label="Total Agents" value={metrics.totalAgents} detail="All Agent / NP records on file." />
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Business-document compliance for Agents / NPs isn’t tracked in the backend yet. This roster
        shows live Agent / NP records only — per-NP document health, review queue and risk scoring
        will appear here once agent document tracking is built. Driver compliance is live on the
        <span className="font-semibold"> Driver Compliance</span> tab.
      </div>

      <SectionCard
        title="Agent / NP Roster"
        subtitle="Live operational roster of Agent / NP records sourced from the tenant directory."
      >
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Search</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search business, contact, city, or state"
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Status</label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-border px-3 py-2.5 text-sm">
              <option value="">All statuses</option>
              <option value="Active">Active</option>
              <option value="Pending NP">Pending NP</option>
              <option value="Potential">Potential</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Business</th>
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Status</th>
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Network Partner</th>
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Association</th>
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-muted">Loading Agent / NP records…</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-muted">No Agent / NP records match the current filters.</td>
                </tr>
              ) : filteredRows.map((agent) => (
                <tr key={agent.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-3">
                    <div className="font-semibold text-text-primary">{agent.name}</div>
                    <div className="text-xs text-text-secondary">
                      {[agent.contactName, [agent.city, agent.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[agent.status] ?? 'bg-slate-100 text-slate-600'}`}>{agent.status}</span>
                  </td>
                  <td className="px-3 py-3">
                    {agent.isNetworkPartner ? (
                      <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                        {agent.npTier ?? 'NP'}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {agent.association && agent.association !== 'None' ? agent.association : <span className="text-text-muted">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    <Link to={`/agents/${agent.id}`} className="text-sm font-medium text-brand-cyan hover:underline">Partner workspace</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
