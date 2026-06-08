import { useEffect, useMemo, useState } from 'react';
import ComplianceDashboard from './ComplianceDashboard';
import ComplianceProfiles from './ComplianceProfiles';
import DocumentTypeSettings from './DocumentTypeSettings';
import AgentComplianceTab from './AgentComplianceTab';
import { DriverApproval } from '@/pages/tenant/DriverApproval';
import { useComplianceAlerts, useComplianceDashboard } from '@/hooks/useCompliance';
import {
  NP_DOC_REQUIREMENTS,
  getBusinessComplianceSummary,
  useAgents,
} from '@/pages/tenant/agentComplianceService';
import type { BusinessOnboardingRecord } from '@/services/tenant_agentOnboardingService';
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
  const agents = useAgents();
  // Onboarding now lives in the real API (tenant_agentOnboardingService); this
  // still-mock NP compliance view no longer cross-references it.
  const onboardingRecords: BusinessOnboardingRecord[] = [];
  const { data: driverDashboard } = useComplianceDashboard();
  const { alerts: driverAlerts } = useComplianceAlerts();
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

  const businessMetrics = useMemo(() => {
    let missingRequired = 0;
    let rejectedDocs = 0;
    let pendingReview = 0;
    let onboardingReview = 0;

    const activeAgents = agents.filter((agent) => agent.status === 'Active').length;
    const pendingNp = agents.filter((agent) => agent.status === 'Pending NP').length;

    agents.forEach((agent) => {
      const summary = getBusinessComplianceSummary(agent.npDocs);
      pendingReview += summary.pendingDocuments;
      rejectedDocs += summary.rejectedDocuments;
      missingRequired += NP_DOC_REQUIREMENTS
        .filter((requirement) => requirement.mandatory)
        .filter((requirement) => agent.npDocs.find((document) => document.requirementId === requirement.id)?.status === 'missing').length;
    });

    onboardingReview = onboardingRecords.filter((record) => record.stage === 'Review In Progress').length;

    return { activeAgents, pendingNp, missingRequired, rejectedDocs, pendingReview, onboardingReview };
  }, [agents, onboardingRecords]);

  const criticalItems = useMemo<CriticalItem[]>(() => {
    const items: CriticalItem[] = [];

    agents.forEach((agent) => {
      const summary = getBusinessComplianceSummary(agent.npDocs);
      const missingDocs = NP_DOC_REQUIREMENTS
        .filter((requirement) => requirement.mandatory)
        .filter((requirement) => agent.npDocs.find((document) => document.requirementId === requirement.id)?.status === 'missing');

      if (missingDocs.length > 0) {
        items.push({
          id: `agent-missing-${agent.id}`,
          scope: 'Agent/NP',
          severity: 'Critical',
          title: `${agent.name} has missing required paperwork`,
          detail: `${missingDocs.map((requirement) => requirement.name).join(', ')}.`,
          owner: agent.contactName,
          actionLabel: 'Review Agent/NP queue',
          targetTab: 'agent-np',
        });
      }

      if (summary.rejectedDocuments > 0) {
        items.push({
          id: `agent-rejected-${agent.id}`,
          scope: 'Agent/NP',
          severity: 'Urgent',
          title: `${agent.name} has rejected business documents`,
          detail: `${summary.rejectedDocuments} rejected documents need resubmission or override.`,
          owner: agent.contactName,
          actionLabel: 'Open Agent/NP roster',
          targetTab: 'agent-np',
        });
      }

      if (summary.pendingDocuments > 0) {
        items.push({
          id: `agent-review-${agent.id}`,
          scope: 'Agent/NP',
          severity: 'Watch',
          title: `${agent.name} is waiting on document review`,
          detail: `${summary.pendingDocuments} uploaded business documents remain in queue.`,
          owner: agent.contactName,
          actionLabel: 'Open Agent/NP roster',
          targetTab: 'agent-np',
        });
      }
    });

    onboardingRecords
      .filter((record) => !record.archived && ['Documents Requested', 'Documents Received', 'Review In Progress'].includes(record.stage))
      .slice(0, 6)
      .forEach((record) => {
        const missingCount = record.complianceItems.filter((item) => item.status === 'missing').length;
        if (missingCount === 0 && record.stage !== 'Review In Progress') return;

        items.push({
          id: `onboarding-${record.id}`,
          scope: 'Agent/NP',
          severity: record.stage === 'Review In Progress' ? 'Urgent' : 'Watch',
          title: `${record.businessName} is in onboarding compliance`,
          detail: record.stage === 'Review In Progress'
            ? `Formal review is open with ${missingCount} unresolved documentation gaps.`
            : `${missingCount} required onboarding items are still outstanding.`,
          owner: record.owner,
          actionLabel: 'Open onboarding queue',
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
  }, [agents, driverAlerts, onboardingRecords, pendingCount]);

  const topMetrics = useMemo(() => {
    const expiredDriverItems = driverAlerts.filter((alert) => alert.alertStatus === 'Expired').length;
    const missingDriverItems = driverAlerts.filter((alert) => alert.alertStatus === 'Missing').length;
    const expiringDriverItems = driverAlerts.filter((alert) => alert.alertStatus === 'Expiring').length;

    return {
      expiredPaperwork: businessMetrics.missingRequired + businessMetrics.rejectedDocs + expiredDriverItems,
      urgentReview: businessMetrics.pendingReview + businessMetrics.onboardingReview + pendingCount,
      missingDocs: businessMetrics.missingRequired + missingDriverItems,
      expiringLicenses: expiringDriverItems,
    };
  }, [businessMetrics, driverAlerts, pendingCount]);

  const tabs: TabDef[] = [
    {
      id: 'overall',
      label: 'Overall Compliance',
      badge: criticalItems.filter((item) => item.severity === 'Critical' || item.severity === 'Urgent').length || undefined,
    },
    {
      id: 'agent-np',
      label: 'Agent / NP Compliance',
      badge: businessMetrics.missingRequired + businessMetrics.rejectedDocs > 0
        ? businessMetrics.missingRequired + businessMetrics.rejectedDocs
        : undefined,
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

      {/* NP-Level Compliance Summary */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="NPs Compliant"
          value={agents.filter((a) => (a.isNetworkPartner || a.status === 'Pending NP') && getBusinessComplianceSummary(a.npDocs).missingDocuments === 0 && getBusinessComplianceSummary(a.npDocs).rejectedDocuments === 0).length}
          detail={`of ${agents.filter((a) => a.isNetworkPartner || a.status === 'Pending NP').length} total NPs`}
          tone="text-green-700"
        />
        <MetricCard
          label="Expiring Certs (All NPs)"
          value={agents.filter((a) => a.isNetworkPartner || a.status === 'Pending NP').reduce((sum, a) => sum + getBusinessComplianceSummary(a.npDocs).pendingDocuments, 0)}
          detail="Pending review across all network partners"
          tone="text-amber-700"
        />
        <MetricCard
          label="High-Risk NPs"
          value={agents.filter((a) => {
            if (!a.isNetworkPartner && a.status !== 'Pending NP') return false;
            const s = getBusinessComplianceSummary(a.npDocs);
            const missingMandatory = NP_DOC_REQUIREMENTS.filter((r) => r.mandatory).filter((r) => a.npDocs.find((d) => d.requirementId === r.id)?.status === 'missing').length;
            return missingMandatory >= 2 || s.rejectedDocuments > 0;
          }).length}
          detail="NPs with 2+ missing mandatory docs or rejections"
          tone="text-red-700"
        />
        <MetricCard
          label="Active NPs"
          value={businessMetrics.activeAgents}
          detail={`${businessMetrics.pendingNp} pending activation`}
        />
      </div>

      {activeTab === 'overall' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard label="Expired / Blocked" value={topMetrics.expiredPaperwork} detail="Expired paperwork, rejected docs, and hard compliance blocks." tone="text-red-700" />
            <MetricCard label="Urgent Review" value={topMetrics.urgentReview} detail="Pending business review items plus driver approvals." tone="text-amber-700" />
            <MetricCard label="Missing Required Docs" value={topMetrics.missingDocs} detail="Mandatory business and driver documents not on file." tone="text-red-700" />
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
