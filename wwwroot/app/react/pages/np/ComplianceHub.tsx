import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ComplianceDashboard from './ComplianceDashboard';
import ComplianceProfiles from './ComplianceProfiles';
import DocumentTypeSettings from './DocumentTypeSettings';
import AgentComplianceTab from './AgentComplianceTab';
import QuizBuilderPage from './QuizBuilderPage';
import { DriverApproval } from '@/pages/tenant/DriverApproval';
import { useComplianceAlerts } from '@/hooks/useCompliance';
import { useAgents } from '@/hooks/useAgents';
import { useAgentComplianceRoster } from '@/hooks/useAgentCompliance';
import { driverApprovalService } from '@/services/np_driverApprovalService';

type LegacyDriverTab = 'dashboard' | 'documents' | 'profiles' | 'approval';
type HubSection = 'monitoring' | 'setup';
type MonitoringTab = 'agent-np' | 'driver';
type SetupTab = 'profiles' | 'documents' | 'training';

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

function SeverityPill({ severity }: { severity: 'Critical' | 'Urgent' | 'Watch' }) {
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
  const location = useLocation();
  const navigate = useNavigate();
  const { agents } = useAgents();
  const { alerts: driverAlerts } = useComplianceAlerts();
  const { byId: agentComplianceById } = useAgentComplianceRoster();
  const pendingCount = driverApprovalService.getPendingCount();

  const derivedSection: HubSection = location.pathname.startsWith('/compliance/setup') ? 'setup' : 'monitoring';
  const initialMonitoringTab: MonitoringTab = initialTab === 'dashboard' || initialTab === 'approval' ? 'driver' : 'agent-np';
  const initialSetupTab: SetupTab = initialTab === 'documents' ? 'documents' : initialTab === 'profiles' ? 'profiles' : 'training';

  const [activeSection, setActiveSection] = useState<HubSection>(initialTab ? (initialTab === 'dashboard' || initialTab === 'approval' ? 'monitoring' : 'setup') : derivedSection);
  const [activeMonitoringTab, setActiveMonitoringTab] = useState<MonitoringTab>(initialMonitoringTab);
  const [activeSetupTab, setActiveSetupTab] = useState<SetupTab>(initialSetupTab);

  useEffect(() => {
    setActiveSection(derivedSection);
  }, [derivedSection]);

  useEffect(() => {
    if (!initialTab) return;
    if (initialTab === 'dashboard' || initialTab === 'approval') {
      setActiveSection('monitoring');
      setActiveMonitoringTab('driver');
    } else {
      setActiveSection('setup');
      setActiveSetupTab(initialTab === 'documents' ? 'documents' : initialTab === 'profiles' ? 'profiles' : 'training');
    }
  }, [initialTab]);

  const npMetrics = useMemo(() => {
    const totalAgents = agents.length;
    const compliant = agents.filter((agent) => (agentComplianceById.get(agent.id)?.riskLevel ?? 'Low') === 'Low').length;
    const atRisk = agents.filter((agent) => agentComplianceById.get(agent.id)?.riskLevel === 'Medium').length;
    const nonComplying = agents.filter((agent) => agentComplianceById.get(agent.id)?.riskLevel === 'High').length;
    const networkPartners = agents.filter((agent) => agent.isNetworkPartner).length;
    return { totalAgents, compliant, atRisk, nonComplying, networkPartners };
  }, [agents, agentComplianceById]);

  const driverMetrics = useMemo(() => ({
    totalAlerts: driverAlerts.length,
    compliant: Math.max(0, driverAlerts.length - driverAlerts.filter((a) => ['Expired', 'Missing', 'Expiring'].includes(a.alertStatus)).length),
    atRisk: driverAlerts.filter((a) => a.alertStatus === 'Expiring').length,
    nonComplying: driverAlerts.filter((a) => a.alertStatus === 'Expired' || a.alertStatus === 'Missing').length,
    pendingApprovals: pendingCount,
  }), [driverAlerts, pendingCount]);

  const agentCriticalItems = useMemo(() => {
    const items = agents.flatMap((agent) => {
      const c = agentComplianceById.get(agent.id);
      if (!c || c.riskLevel === 'Low') return [];
      const severity: 'Critical' | 'Watch' = c.riskLevel === 'High' ? 'Critical' : 'Watch';
      const gaps = c.summary.missingDocuments + c.summary.rejectedDocuments;
      return [{
        id: agent.id,
        severity,
        title: agent.name,
        detail: `${gaps} mandatory document${gaps === 1 ? '' : 's'} outstanding · ${c.summary.approvedMandatoryDocuments}/${c.summary.mandatoryDocuments} approved`,
      }];
    });

    return items.sort((a, b) => (a.severity === 'Critical' ? -1 : 1) - (b.severity === 'Critical' ? -1 : 1)).slice(0, 10);
  }, [agents, agentComplianceById]);

  const handleSectionChange = (section: HubSection) => {
    setActiveSection(section);
    navigate(section === 'setup' ? '/compliance/setup' : '/compliance');
  };

  if (standalone) {
    return <DocumentTypeSettings />;
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-2xl border border-border bg-white p-1 shadow-sm w-fit">
        <button
          onClick={() => handleSectionChange('monitoring')}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
            activeSection === 'monitoring' ? 'bg-[#0d0c2c] text-white shadow-sm' : 'text-text-secondary hover:bg-slate-50'
          }`}
        >
          Monitoring
        </button>
        <button
          onClick={() => handleSectionChange('setup')}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
            activeSection === 'setup' ? 'bg-[#0d0c2c] text-white shadow-sm' : 'text-text-secondary hover:bg-slate-50'
          }`}
        >
          Set up
        </button>
      </div>

      {activeSection === 'monitoring' && (
        <div className="space-y-5">
          <div className="flex gap-1 rounded-2xl border border-border bg-white p-1 shadow-sm w-fit">
            <button
              onClick={() => setActiveMonitoringTab('agent-np')}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                activeMonitoringTab === 'agent-np' ? 'bg-brand-cyan/15 text-brand-dark' : 'text-text-secondary hover:bg-slate-50'
              }`}
            >
              NP / Agents
            </button>
            <button
              onClick={() => setActiveMonitoringTab('driver')}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                activeMonitoringTab === 'driver' ? 'bg-brand-cyan/15 text-brand-dark' : 'text-text-secondary hover:bg-slate-50'
              }`}
            >
              Drivers / Contractors
            </button>
          </div>

          {activeMonitoringTab === 'agent-np' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <MetricCard label="Compliant" value={npMetrics.compliant} detail="Low-risk NP / Agent records" tone="text-green-700" />
                <MetricCard label="At Risk" value={npMetrics.atRisk} detail="Medium-risk NP / Agent records" tone="text-amber-700" />
                <MetricCard label="Non-Complying" value={npMetrics.nonComplying} detail="High-risk NP / Agent records" tone="text-red-700" />
                <MetricCard label="Network Partners" value={npMetrics.networkPartners} detail={`of ${npMetrics.totalAgents} total records`} tone="text-violet-700" />
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50">
                      <th className="px-3 py-3 text-left font-semibold text-text-muted">Severity</th>
                      <th className="px-3 py-3 text-left font-semibold text-text-muted">NP / Agent</th>
                      <th className="px-3 py-3 text-left font-semibold text-text-muted">Issue</th>
                      <th className="px-3 py-3 text-left font-semibold text-text-muted">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentCriticalItems.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-text-muted">No at-risk NP / Agent records are currently open.</td></tr>
                    ) : agentCriticalItems.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-3"><SeverityPill severity={item.severity} /></td>
                        <td className="px-3 py-3 font-semibold text-text-primary">{item.title}</td>
                        <td className="px-3 py-3 text-text-secondary">{item.detail}</td>
                        <td className="px-3 py-3"><button onClick={() => navigate(`/agents/${item.id}`)} className="text-sm font-medium text-brand-cyan hover:underline">Open workspace</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <AgentComplianceTab />
            </div>
          )}

          {activeMonitoringTab === 'driver' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <MetricCard label="Pending Approvals" value={driverMetrics.pendingApprovals} detail="Driver onboarding approvals waiting" tone="text-sky-700" />
                <MetricCard label="At Risk" value={driverMetrics.atRisk} detail="Expiring documents" tone="text-amber-700" />
                <MetricCard label="Non-Complying" value={driverMetrics.nonComplying} detail="Expired or missing documents" tone="text-red-700" />
                <MetricCard label="Alerts Tracked" value={driverMetrics.totalAlerts} detail="Driver / contractor compliance alerts" tone="text-violet-700" />
              </div>

              {initialTab === 'approval' ? <DriverApproval /> : <ComplianceDashboard />}
            </div>
          )}
        </div>
      )}

      {activeSection === 'setup' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-white p-1 shadow-sm w-fit">
            <button
              onClick={() => setActiveSetupTab('profiles')}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${activeSetupTab === 'profiles' ? 'bg-brand-cyan/15 text-brand-dark' : 'text-text-secondary hover:bg-slate-50'}`}
            >
              Compliance Profiles
            </button>
            <button
              onClick={() => setActiveSetupTab('documents')}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${activeSetupTab === 'documents' ? 'bg-brand-cyan/15 text-brand-dark' : 'text-text-secondary hover:bg-slate-50'}`}
            >
              Documents
            </button>
            <button
              onClick={() => setActiveSetupTab('training')}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${activeSetupTab === 'training' ? 'bg-brand-cyan/15 text-brand-dark' : 'text-text-secondary hover:bg-slate-50'}`}
            >
              Training Quizzes
            </button>
          </div>

          {activeSetupTab === 'profiles' && <ComplianceProfiles />}
          {activeSetupTab === 'documents' && <DocumentTypeSettings />}
          {activeSetupTab === 'training' && <QuizBuilderPage />}
        </div>
      )}
    </div>
  );
}
