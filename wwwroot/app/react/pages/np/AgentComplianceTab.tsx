import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAgents } from '@/hooks/useAgents';
import { useAgentComplianceRoster } from '@/hooks/useAgentCompliance';
import type { AgentRiskLevel } from '@/services/np_agentComplianceService';
import type { AgentStatus } from '@/types';

// Agent / NP compliance roster.
//
// Identity / status / NP roster is REAL (GET /api/v1/tenant/agents via useAgents).
// Business-document compliance is now REAL too (Phase 1): per-NP doc-health is
// sourced from GET /api/v1/np/compliance/agents/roster and joined by agentId.
// Driver compliance remains on its own live tab in ComplianceHub.

const STATUS_TONE: Record<AgentStatus, string> = {
  Active: 'bg-green-100 text-green-700',
  Inactive: 'bg-slate-100 text-slate-600',
  Pending: 'bg-amber-100 text-amber-700',
  Suspended: 'bg-red-100 text-red-700',
  Potential: 'bg-sky-100 text-sky-700',
  'Pending NP': 'bg-violet-100 text-violet-700',
  Archived: 'bg-gray-100 text-gray-500',
};

const RISK_TONE: Record<AgentRiskLevel, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-green-100 text-green-700',
};

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
  const { byId: complianceById } = useAgentComplianceRoster();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filteredRows = useMemo(() => agents.filter((agent) => {
    const haystack = `${agent.name} ${agent.contactName} ${agent.city} ${agent.state}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (statusFilter && agent.status !== statusFilter) return false;
    return true;
  }), [agents, search, statusFilter]);

  return (
    <div className="space-y-5">
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
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Doc Compliance</th>
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Risk</th>
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Association</th>
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-text-muted">Loading Agent / NP records…</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-text-muted">No Agent / NP records match the current filters.</td>
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
                  {(() => {
                    const c = complianceById.get(agent.id);
                    return (
                      <>
                        <td className="px-3 py-3">
                          {c ? (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${c.compliancePercent}%` }} />
                              </div>
                              <span className="text-xs text-text-secondary">{c.summary.approvedMandatoryDocuments}/{c.summary.mandatoryDocuments}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {c ? (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${RISK_TONE[c.riskLevel]}`}>{c.riskLevel}</span>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
                      </>
                    );
                  })()}
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
