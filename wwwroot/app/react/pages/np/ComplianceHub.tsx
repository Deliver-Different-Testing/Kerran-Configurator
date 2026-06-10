import { useEffect, useMemo, useState } from 'react';
import ComplianceDashboard from './ComplianceDashboard';
import ComplianceProfiles from './ComplianceProfiles';
import DocumentTypeSettings from './DocumentTypeSettings';
import AgentComplianceTab from './AgentComplianceTab';
import { DriverApproval } from '@/pages/tenant/DriverApproval';
import { useComplianceAlerts } from '@/hooks/useCompliance';
import { useAgents } from '@/hooks/useAgents';
import { useAgentComplianceRoster } from '@/hooks/useAgentCompliance';
import { driverApprovalService } from '@/services/np_driverApprovalService';

type LegacyDriverTab = 'dashboard' | 'documents' | 'profiles' | 'approval';
type HubTab = 'overall' | 'agent-np' | 'driver';

interface TabDef {
  id: HubTab;
  label: string;
  badge?: number;
}

interface DriverTabDef {
  id: LegacyDriverTab;
  label: string;
  badge?: number;
}

interface CriticalItem {
  id: string;
  scope: 'Agent/NP' | 'Driver';
  severity: 'Critical' | 'Urgent' | 'Watch';
  title: string;
  detail: string;
  owner: string;
  actionLabel: string;
  targetTab: HubTab;
  driverTab?: LegacyDriverTab;
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'text-text-primary',
}: {
  label: string;
  value: number;
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

function SeverityPill({ severity }: { severity: CriticalItem['severity'] }) {
  const tone = severity === 'Critical'
    ? 'bg-red-100 text-red-700'
    : severity === 'Urgent'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-sky-100 text-sky-700';

  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{severity}</span>;
}

export default function ComplianceHub({
  initialTab,
  standalone,
}: {
  initialTab?: LegacyDriverTab;
  standalone?: boolean;
}) {
  // Real Agent/NP roster (identity / status / NP flag) — GET /api/v1/tenant/agents.
  // Business-document compliance for Agents/NPs is now live (Phase 1) — per-NP
  // doc-health comes from GET /api/v1/np/compliance/agents/* and feeds the
  // Agent/NP metric cards + critical-issue rows below. Driver compliance is live.
  const { agents } = useAgents();
  const { alerts: driverAlerts } = useComplianceAlerts();
  const { byId: agentComplianceById } = useAgentComplianceRoster();
  const pendingCount = driverApprovalService.getPendingCount();

  const initialHubTab: HubTab = initialTab ? 'driver' : 'overall';
  const [activeTab, setActiveTab] = useState<HubTab>(initialHubTab);
  const [activeDriverTab, setActiveDriverTab] = useState<LegacyDriverTab>(initialTab || 'dashboard');

  useEffect(() => {
    if (initialTab) {
      setActiveTab('driver');
      setActiveDriverTab(initialTab);
    }
  }, [initialTab]);

  const npMetrics = useMemo(() => {
    const totalAgents = agents.length;
    const networkPartners = agents.filter((agent) => agent.isNetworkPartner).length;
    const activeAgents = agents.filter((agent) => agent.status === 'Active').length;
    const pendingNp = agents.filter((agent) => agent.status === 'Pending NP').length;
    const highRiskNps = agents.filter((agent) => agentComplianceById.get(agent.id)?.riskLevel === 'High').length;
    const missingNpDocs = agents.reduce((sum, agent) => sum + (agentComplianceById.get(agent.id)?.summary.missingDocuments ?? 0), 0);
    return { totalAgents, networkPartners, activeAgents, pendingNp, highRiskNps, missingNpDocs };
  }, [agents, agentComplianceById]);

  // Critical items combine live Agent/NP business-document compliance (high-risk
  // NPs — missing or rejected mandatory docs) with the live driver alerts.
  const criticalItems = useMemo<CriticalItem[]>(() => {
    const items: CriticalItem[] = [];

    agents.forEach((agent) => {
      const c = agentComplianceById.get(agent.id);
      if (!c || c.riskLevel !== 'High') return;
      const gaps = c.summary.missingDocuments + c.summary.rejectedDocuments;
      items.push({
        id: `agentnp-${agent.id}`,
        scope: 'Agent/NP',
        severity: 'Critical',
        title: `${agent.name} has ${gaps} mandatory document${gaps === 1 ? '' : 's'} outstanding`,
        detail: `${c.summary.approvedMandatoryDocuments}/${c.summary.mandatoryDocuments} required documents approved · ${c.summary.missingDocuments} missing · ${c.summary.rejectedDocuments} rejected.`,
        owner: 'Agent / NP compliance',
        actionLabel: 'Open Agent / NP compliance',
        targetTab: 'agent-np',
      });
    });

    driverAlerts
      .filter((alert) => ['Expired', 'Missing', 'Expiring'].includes(alert.alertStatus))
      .slice(0, 8)
      .forEach((alert) => {
        const severity: CriticalItem['severity'] = alert.alertStatus === 'Expired' || alert.alertStatus === 'Missing' ? 'Critical' : 'Watch';
        const title = alert.alertStatus === 'Expired'
          ? `${alert.courierName} has expired ${alert.documentType}`
          : alert.alertStatus === 'Missing'
            ? `${alert.courierName} is missing ${alert.documentType}`
            : `${alert.courierName} has ${alert.documentType} expiring soon`;
        const detail = alert.alertStatus === 'Expiring'
          ? `${alert.daysUntilExpiry ?? 0} days remaining before expiry.`
          : alert.expiryDate
            ? `Expired on ${new Date(alert.expiryDate).toLocaleDateString()}.`
            : 'Required document has not been uploaded.';

        items.push({
          id: `driver-${alert.courierId}-${alert.documentType}-${alert.alertStatus}`,
          scope: 'Driver',
          severity,
          title,
          detail,
          owner: alert.fleet || 'Driver compliance',
          actionLabel: alert.alertStatus === 'Expiring' ? 'Open Driver dashboard' : 'Open Driver dashboard',
          targetTab: 'driver',
          driverTab: 'dashboard',
        });
      });

    if (pendingCount > 0) {
      items.unshift({
        id: 'driver-approval-queue',
        scope: 'Driver',
        severity: 'Urgent',
        title: `${pendingCount} driver approvals need review`,
        detail: 'Pending onboarding approvals are waiting for tenant or admin action.',
        owner: 'Driver approval queue',
        actionLabel: 'Open approvals',
        targetTab: 'driver',
        driverTab: 'approval',
      });
    }

    const weight = { Critical: 0, Urgent: 1, Watch: 2 };
    return items.sort((a, b) => weight[a.severity] - weight[b.severity]).slice(0, 12);
  }, [agents, agentComplianceById, driverAlerts, pendingCount]);

  // Driver-sourced only — see Option-3 note above. Business-doc figures are not
  // tracked yet, so they no longer feed these rollups.
  const topMetrics = useMemo(() => {
    const expiredDriverItems = driverAlerts.filter((alert) => alert.alertStatus === 'Expired').length;
    const missingDriverItems = driverAlerts.filter((alert) => alert.alertStatus === 'Missing').length;
    const expiringDriverItems = driverAlerts.filter((alert) => alert.alertStatus === 'Expiring').length;

    return {
      expiredPaperwork: expiredDriverItems,
      urgentReview: pendingCount,
      missingDocs: missingDriverItems,
      expiringLicenses: expiringDriverItems,
    };
  }, [driverAlerts, pendingCount]);

  const tabs: TabDef[] = [
    {
      id: 'overall',
      label: 'Overall Compliance',
      badge: criticalItems.filter((item) => item.severity === 'Critical' || item.severity === 'Urgent').length || undefined,
    },
    {
      id: 'agent-np',
      label: 'Agent / NP Compliance',
    },
    {
      id: 'driver',
      label: 'Driver Compliance',
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
  ];

  const driverTabs: DriverTabDef[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'approval', label: 'Driver Approval', badge: pendingCount > 0 ? pendingCount : undefined },
    { id: 'documents', label: 'Documents' },
    { id: 'profiles', label: 'Profiles' },
  ];

  if (standalone) {
    return <DocumentTypeSettings />;
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-2xl border border-border bg-white p-1 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-[#0d0c2c] text-white shadow-sm'
                : 'text-text-secondary hover:bg-slate-50'
            }`}
          >
            {tab.label}
            {tab.badge && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === tab.id ? 'bg-amber-400 text-[#0d0c2c]' : 'bg-amber-100 text-amber-700'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* NP-Level roster + live business-document compliance summary. */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Network Partners"
          value={npMetrics.networkPartners}
          detail={`of ${npMetrics.totalAgents} agent records`}
          tone="text-violet-700"
        />
        <MetricCard
          label="High-Risk NPs"
          value={npMetrics.highRiskNps}
          detail="Missing or rejected mandatory documents."
          tone="text-red-700"
        />
        <MetricCard
          label="Missing NP Docs"
          value={npMetrics.missingNpDocs}
          detail="Required Agent / NP documents not on file."
          tone="text-amber-700"
        />
        <MetricCard
          label="Driver Approvals"
          value={pendingCount}
          detail="Pending driver onboarding approvals."
          tone="text-sky-700"
        />
      </div>

      {activeTab === 'overall' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard label="Expired Driver Docs" value={topMetrics.expiredPaperwork} detail="Driver documents currently expired." tone="text-red-700" />
            <MetricCard label="Driver Approvals" value={topMetrics.urgentReview} detail="Driver onboarding approvals waiting for action." tone="text-amber-700" />
            <MetricCard label="Missing Driver Docs" value={topMetrics.missingDocs} detail="Mandatory driver documents not on file." tone="text-red-700" />
            <MetricCard label="Expiring Soon" value={topMetrics.expiringLicenses} detail="Driver licenses and other tracked items nearing expiry." tone="text-sky-700" />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Severity</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Scope</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Issue</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Owner / Queue</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-muted">Action</th>
                </tr>
              </thead>
              <tbody>
                {criticalItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-muted">No critical compliance items are currently open.</td>
                  </tr>
                ) : criticalItems.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-3"><SeverityPill severity={item.severity} /></td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${item.scope === 'Agent/NP' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                        {item.scope}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-text-primary">{item.title}</div>
                      <div className="text-xs text-text-secondary">{item.detail}</div>
                    </td>
                    <td className="px-3 py-3 text-text-secondary">{item.owner}</td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => {
                          setActiveTab(item.targetTab);
                          if (item.driverTab) setActiveDriverTab(item.driverTab);
                        }}
                        className="text-sm font-medium text-brand-cyan hover:underline"
                      >
                        {item.actionLabel}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'agent-np' && <AgentComplianceTab />}

      {activeTab === 'driver' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-white p-1 shadow-sm">
            {driverTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveDriverTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  activeDriverTab === tab.id
                    ? 'bg-brand-cyan/15 text-brand-dark'
                    : 'text-text-secondary hover:bg-slate-50'
                }`}
              >
                {tab.label}
                {tab.badge && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeDriverTab === tab.id ? 'bg-amber-400 text-brand-dark' : 'bg-amber-100 text-amber-700'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeDriverTab === 'dashboard' && <ComplianceDashboard />}
          {activeDriverTab === 'documents' && <DocumentTypeSettings />}
          {activeDriverTab === 'profiles' && <ComplianceProfiles />}
          {activeDriverTab === 'approval' && <DriverApproval />}
        </div>
      )}
    </div>
  );
}
