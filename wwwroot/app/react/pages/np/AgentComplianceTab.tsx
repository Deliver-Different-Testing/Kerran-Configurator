import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { NP_DOC_REQUIREMENTS } from '@/pages/tenant/agentComplianceService';
import {
  getBusinessComplianceSummary,
  getCompliancePercentage,
  getDriverComplianceSummary,
  getDriversForAgent,
  useAgents,
} from '@/pages/tenant/agentComplianceService';
import type { BusinessOnboardingRecord } from '@/services/tenant_agentOnboardingService';
import type { AgentStatus } from '@/types';

type RiskLevel = 'critical' | 'warning' | 'healthy';

const STATUS_TONE: Record<AgentStatus, string> = {
  Active: 'bg-green-100 text-green-700',
  Inactive: 'bg-slate-100 text-slate-600',
  Pending: 'bg-amber-100 text-amber-700',
  Suspended: 'bg-red-100 text-red-700',
  Potential: 'bg-sky-100 text-sky-700',
  'Pending NP': 'bg-violet-100 text-violet-700',
  Archived: 'bg-gray-100 text-gray-500',
};

const ONBOARDING_TONE: Record<string, string> = {
  'Prospect Identified': 'bg-slate-100 text-slate-700',
  Contacted: 'bg-indigo-100 text-indigo-700',
  Qualified: 'bg-violet-100 text-violet-700',
  'Documents Requested': 'bg-amber-100 text-amber-700',
  'Documents Received': 'bg-orange-100 text-orange-700',
  'Review In Progress': 'bg-cyan-100 text-cyan-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Activated: 'bg-green-100 text-green-700',
  'Rejected / Archived': 'bg-slate-200 text-slate-700',
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

function RiskPill({ risk }: { risk: RiskLevel }) {
  const tone = risk === 'critical'
    ? 'bg-red-100 text-red-700'
    : risk === 'warning'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-green-100 text-green-700';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {risk === 'critical' ? 'Critical' : risk === 'warning' ? 'Watch' : 'Healthy'}
    </span>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
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

function NotificationChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone: 'critical' | 'attention' | 'onboarding';
  onClick: () => void;
}) {
  const palette = tone === 'critical'
    ? active ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-100 bg-white text-red-700'
    : tone === 'attention'
      ? active ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-amber-100 bg-white text-amber-700'
      : active ? 'border-cyan-200 bg-cyan-50 text-cyan-700' : 'border-cyan-100 bg-white text-cyan-700';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${palette}`}
    >
      <span>{label}</span>
      <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold">{count}</span>
    </button>
  );
}

export default function AgentComplianceTab() {
  const agents = useAgents();
  // Onboarding now lives in the real API (tenant_agentOnboardingService); this
  // still-mock NP compliance view no longer cross-references it.
  const onboardingRecords: BusinessOnboardingRecord[] = [];
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [notificationFilter, setNotificationFilter] = useState<'critical' | 'attention' | 'onboarding' | ''>('');

  const agentRows = useMemo(() => agents.map((agent) => {
    const docs = getBusinessComplianceSummary(agent.npDocs);
    const drivers = getDriverComplianceSummary(
      agent.isNetworkPartner || agent.status === 'Pending NP'
        ? getDriversForAgent(agent.id)
        : []
    );
    const linkedOnboarding = onboardingRecords.find((record) => record.id === agent.onboardingRecordId);
    const rejectedCount = agent.npDocs.filter((document) => document.status === 'rejected').length;
    const requiredMissing = NP_DOC_REQUIREMENTS.filter((requirement) => requirement.mandatory)
      .filter((requirement) => agent.npDocs.find((document) => document.requirementId === requirement.id)?.status === 'missing').length;
    const risk: RiskLevel = rejectedCount > 0 || requiredMissing > 0
      ? 'critical'
      : docs.pendingDocuments > 0 || drivers.nonCompliant > 0 || drivers.expiring > 0 || agent.status === 'Pending NP'
        ? 'warning'
        : 'healthy';

    return {
      agent,
      docs,
      drivers,
      linkedOnboarding,
      compliancePct: getCompliancePercentage(agent.npDocs),
      requiredMissing,
      rejectedCount,
      risk,
    };
  }), [agents, onboardingRecords]);

  const filteredRows = useMemo(() => agentRows.filter(({ agent, linkedOnboarding, risk, docs }) => {
    const haystack = `${agent.name} ${agent.contactName} ${agent.city} ${agent.state}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (statusFilter && agent.status !== statusFilter) return false;
    if (riskFilter && risk !== riskFilter) return false;
    if (stageFilter && linkedOnboarding?.stage !== stageFilter) return false;
    if (notificationFilter === 'critical' && risk !== 'critical') return false;
    if (notificationFilter === 'attention' && !(risk === 'warning' || docs.pendingDocuments > 0)) return false;
    if (notificationFilter === 'onboarding' && !(linkedOnboarding && ['Documents Requested', 'Documents Received', 'Review In Progress', 'Approved'].includes(linkedOnboarding.stage))) return false;
    return true;
  }), [agentRows, notificationFilter, riskFilter, search, stageFilter, statusFilter]);

  const metrics = useMemo(() => {
    const livePartners = agentRows.filter(({ agent }) => agent.status === 'Active').length;
    const pendingNp = agentRows.filter(({ agent }) => agent.status === 'Pending NP').length;
    const criticalPartners = agentRows.filter(({ risk }) => risk === 'critical').length;
    const docsPendingReview = agentRows.reduce((sum, row) => sum + row.docs.pendingDocuments, 0);
    const requiredMissing = agentRows.reduce((sum, row) => sum + row.requiredMissing, 0);
    const onboardingInReview = onboardingRecords.filter((record) => record.stage === 'Review In Progress').length;

    return { livePartners, pendingNp, criticalPartners, docsPendingReview, requiredMissing, onboardingInReview };
  }, [agentRows, onboardingRecords]);

  const onboardingNotificationCount = useMemo(() => onboardingRecords
    .filter((record) => !record.archived && ['Documents Requested', 'Documents Received', 'Review In Progress', 'Approved'].includes(record.stage)).length,
  [onboardingRecords]);

  const criticalNotificationCount = useMemo(() => agentRows.filter(({ risk }) => risk === 'critical').length, [agentRows]);
  const attentionNotificationCount = useMemo(() => agentRows.filter(({ risk, docs }) => risk === 'warning' || docs.pendingDocuments > 0).length, [agentRows]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <MetricCard label="Live Partners" value={metrics.livePartners} detail="Active Agent / NP records in the network." />
        <MetricCard label="Pending NP" value={metrics.pendingNp} detail="Businesses still moving through NP approval." tone="text-violet-700" />
        <MetricCard label="Critical Issues" value={metrics.criticalPartners} detail="Partners blocked by missing or rejected required paperwork." tone="text-red-700" />
        <MetricCard label="Docs Pending Review" value={metrics.docsPendingReview} detail="Uploaded business documents needing an ops decision." tone="text-amber-700" />
        <MetricCard label="Required Missing" value={metrics.requiredMissing} detail="Mandatory business documents not yet supplied." tone="text-red-700" />
        <MetricCard label="Onboarding Review" value={metrics.onboardingInReview} detail="Prospects sitting in formal compliance review." tone="text-cyan-700" />
      </div>

      <SectionCard
        title="Business Compliance Roster"
        subtitle="Operational roster of Agent / NP records, linked onboarding stage, business paperwork health, and downstream driver exposure."
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <NotificationChip
            label="Critical"
            count={criticalNotificationCount}
            active={notificationFilter === 'critical'}
            tone="critical"
            onClick={() => setNotificationFilter(notificationFilter === 'critical' ? '' : 'critical')}
          />
          <NotificationChip
            label="Requires Attention"
            count={attentionNotificationCount}
            active={notificationFilter === 'attention'}
            tone="attention"
            onClick={() => setNotificationFilter(notificationFilter === 'attention' ? '' : 'attention')}
          />
          <NotificationChip
            label="Onboarding Review"
            count={onboardingNotificationCount}
            active={notificationFilter === 'onboarding'}
            tone="onboarding"
            onClick={() => setNotificationFilter(notificationFilter === 'onboarding' ? '' : 'onboarding')}
          />
          {notificationFilter && (
            <button
              type="button"
              onClick={() => setNotificationFilter('')}
              className="ml-1 text-sm font-medium text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
            >
              Clear
            </button>
          )}
        </div>
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
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Risk</label>
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} className="rounded-xl border border-border px-3 py-2.5 text-sm">
              <option value="">All risk</option>
              <option value="critical">Critical</option>
              <option value="warning">Watch</option>
              <option value="healthy">Healthy</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Onboarding Stage</label>
            <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} className="rounded-xl border border-border px-3 py-2.5 text-sm">
              <option value="">All stages</option>
              {[...new Set(onboardingRecords.map((record) => record.stage))].map((stage) => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Business</th>
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Status</th>
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Onboarding</th>
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Business Docs</th>
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Review Queue</th>
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Driver Exposure</th>
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Risk</th>
                <th className="px-3 py-3 text-left font-semibold text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-text-muted">No business records match the current filters.</td>
                </tr>
              ) : filteredRows.map(({ agent, linkedOnboarding, docs, drivers, compliancePct, requiredMissing, rejectedCount, risk }) => (
                <tr key={agent.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-3">
                    <div className="font-semibold text-text-primary">{agent.name}</div>
                    <div className="text-xs text-text-secondary">{agent.contactName} · {agent.city}, {agent.state}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[agent.status]}`}>{agent.status}</span>
                  </td>
                  <td className="px-3 py-3">
                    {linkedOnboarding ? (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ONBOARDING_TONE[linkedOnboarding.stage]}`}>{linkedOnboarding.stage}</span>
                    ) : (
                      <span className="text-xs text-text-muted">No linked onboarding</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-text-primary">{docs.approvedMandatoryDocuments}/{docs.mandatoryDocuments} required</div>
                    <div className="text-xs text-text-secondary">{compliancePct}% approved</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs text-text-secondary">Pending {docs.pendingDocuments}</div>
                    <div className="text-xs text-red-700">Missing {requiredMissing} · Rejected {rejectedCount}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs text-text-secondary">Compliant {drivers.compliant}</div>
                    <div className="text-xs text-amber-700">Expiring {drivers.expiring}</div>
                    <div className="text-xs text-red-700">Non-compliant {drivers.nonCompliant}</div>
                  </td>
                  <td className="px-3 py-3"><RiskPill risk={risk} /></td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <Link to={`/agents/${agent.id}`} className="text-sm font-medium text-brand-cyan hover:underline">Partner workspace</Link>
                      {linkedOnboarding && (
                        <Link to={`/agents/onboarding/${linkedOnboarding.id}`} className="text-sm font-medium text-brand-cyan hover:underline">Onboarding record</Link>
                      )}
                    </div>
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
