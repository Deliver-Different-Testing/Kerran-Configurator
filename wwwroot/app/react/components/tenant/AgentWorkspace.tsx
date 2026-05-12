import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssociationBadge } from '@/components/common/AssociationBadge';
import { TierBadge } from '@/components/tenant/TierBadge';
import type { BusinessComplianceDocument, TenantCourier } from '@/types';
import { Modal } from '@/components/tenant/Modal';
import {
  NP_DOC_REQUIREMENTS,
  archiveAgent,
  getAgentStatusTone,
  getBusinessComplianceSummary,
  getCompliancePercentage,
  getDriverComplianceSummary,
  getDriversForAgent,
  type AgentWorkspaceRecord,
} from '@/pages/tenant/agentComplianceService';

type WorkspaceTab = 'overview' | 'agent-np-compliance' | 'drivers' | 'driver-compliance';

function StatusPill({ status }: { status: AgentWorkspaceRecord['status'] }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getAgentStatusTone(status)}`}>
      {status}
    </span>
  );
}

function DriverCompliancePill({ status }: { status: TenantCourier['complianceStatus'] }) {
  const tone = status === 'Compliant'
    ? 'bg-green-100 text-green-700'
    : status === 'Expiring'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700';

  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{status}</span>;
}

function complianceTone(status: BusinessComplianceDocument['status']) {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-700';
    case 'uploaded':
      return 'bg-sky-100 text-sky-700';
    case 'under_review':
      return 'bg-amber-100 text-amber-700';
    case 'rejected':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function complianceLabel(status: BusinessComplianceDocument['status']) {
  switch (status) {
    case 'under_review':
      return 'Under Review';
    case 'uploaded':
      return 'Uploaded';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Missing';
  }
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-surface-light px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-1 text-lg font-bold text-text-primary">{value}</div>
      {detail && <div className="mt-1 text-xs text-text-secondary">{detail}</div>}
    </div>
  );
}

function OtdDisplay({ rate }: { rate: number }) {
  const color = rate >= 95 ? 'text-green-600' : rate >= 85 ? 'text-amber-600' : 'text-red-600';
  return (
    <span className={`relative group font-bold text-sm ${color}`}>
      {rate.toFixed(1)}%
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white shadow">
        On-Time Delivery rate based on last 90 days
      </span>
    </span>
  );
}

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

const ARCHIVE_REASONS = [
  'Contract ended',
  'Performance issues',
  'Out of coverage',
  'Duplicate record',
  'Other',
];

function ArchiveModal({ agentName, onClose, onConfirm }: { agentName: string; onClose: () => void; onConfirm: (reason: string, notes: string) => void }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <Modal isOpen onClose={onClose} title="Archive / Deactivate Partner" size="sm" footer={
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
          Cancel
        </button>
        <button
          onClick={() => onConfirm(reason, notes)}
          disabled={!reason}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Archive Partner
        </button>
      </>
    }>
      <p className="text-sm text-text-secondary mb-4">
        Are you sure you want to archive <strong>{agentName}</strong>? This will deactivate the partner record.
      </p>
      <div className="mb-4">
        <label className="block text-sm font-medium text-text-primary mb-1">Reason</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-cyan/40"
        >
          <option value="">Select a reason…</option>
          {ARCHIVE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional context or details…"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-cyan/40"
          rows={3}
        />
      </div>
    </Modal>
  );
}

function OverviewTab({ agent, drivers }: { agent: AgentWorkspaceRecord; drivers: TenantCourier[] }) {
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [reactivatedAt, setReactivatedAt] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(agent.status);
  const [archiveInfo, setArchiveInfo] = useState<{ reason: string; notes: string; archivedAt: string } | null>(null);
  const isActive = localStatus !== 'Archived';

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Association" value={agent.association === 'None' ? 'Independent' : agent.association} />
          <StatCard label="Member ID" value={agent.associationMemberId || 'Not provided'} />
          <StatCard label="Portal Status" value={agent.isNetworkPartner ? 'Live' : 'Not Live'} />
          <StatCard label="Coverage" value={(agent.coverageAreas.length ? agent.coverageAreas : [agent.city]).join(', ')} />
          <StatCard label="NP Activated" value={agent.npActivatedDate || 'Not yet activated'} />
          <StatCard label="Default Driver Pay" value={agent.defaultCourierPayPercent ? `${agent.defaultCourierPayPercent}%` : 'Not set'} />
        </div>

        {/* Lead Source & Rating */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-surface-light px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wide text-text-muted">Lead Source</div>
            <div className="mt-1 text-sm font-medium text-text-primary">{agent.leadSource || 'Unknown'}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-surface-light px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wide text-text-muted">Performance</div>
            <div className="mt-1">
              {agent.otdRate != null ? <OtdDisplay rate={agent.otdRate} /> : <span className="text-sm text-text-secondary">No data</span>}
            </div>
          </div>
        </div>

        {/* Clients Serviced / Approved Programs */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-surface-light p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Clients Serviced</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(agent.clientsServiced && agent.clientsServiced.length > 0) ? agent.clientsServiced.map((client) => (
                <span key={client} className="rounded-full bg-brand-cyan/10 px-3 py-1 text-xs font-medium text-brand-cyan">
                  {client}
                </span>
              )) : <span className="text-sm text-text-secondary">None listed</span>}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-surface-light p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Approved Programs</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(agent.approvedPrograms && agent.approvedPrograms.length > 0) ? agent.approvedPrograms.map((prog) => (
                <span key={prog} className="rounded-full bg-brand-purple/10 px-3 py-1 text-xs font-medium text-brand-purple">
                  {prog}
                </span>
              )) : <span className="text-sm text-text-secondary">None listed</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-surface-light p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Coverage Areas</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(agent.coverageAreas.length ? agent.coverageAreas : [agent.city]).map((area) => (
              <span key={area} className="rounded-full bg-badge-blue-bg px-3 py-1 text-xs font-medium text-badge-blue-text">
                {area}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface-light p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Notes</div>
          <div className="mt-1 text-sm text-text-secondary">{agent.notes || 'No notes added.'}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface-light p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Driver Roster</div>
          <div className="mt-1 text-sm text-text-secondary">{drivers.length} assigned driver{drivers.length === 1 ? '' : 's'}</div>
        </div>

        {/* Status Toggle */}
        <div className="rounded-xl border border-slate-200 bg-surface-light p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">Partner Status</div>
          <div className="flex items-center gap-3">
            <ToggleSwitch
              enabled={isActive}
              onChange={() => {
                if (isActive) {
                  setShowArchiveModal(true);
                } else {
                  setLocalStatus('Active');
                  setReactivatedAt(new Date().toLocaleString());
                }
              }}
            />
            <span className={`text-sm font-medium ${isActive ? 'text-green-600' : 'text-slate-500'}`}>
              {isActive ? 'Active' : 'Archived'}
            </span>
          </div>
          {!isActive && archiveInfo && (
            <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-text-secondary space-y-1">
              <div><span className="font-medium">Reason:</span> {archiveInfo.reason}</div>
              {archiveInfo.notes && <div><span className="font-medium">Notes:</span> {archiveInfo.notes}</div>}
              {archiveInfo.archivedAt && <div><span className="font-medium">Archived:</span> {archiveInfo.archivedAt}</div>}
            </div>
          )}
          {isActive && reactivatedAt && (
            <div className="mt-2 rounded-lg bg-green-50 p-2 text-xs text-green-700">
              <span className="font-medium">Reactivated:</span> {reactivatedAt}
            </div>
          )}
        </div>
      </div>

      {showArchiveModal && (
        <ArchiveModal
          agentName={agent.name}
          onClose={() => setShowArchiveModal(false)}
          onConfirm={(reason, notes) => {
            archiveAgent(agent.id, reason, notes);
            setLocalStatus('Archived');
            setArchiveInfo({ reason, notes, archivedAt: new Date().toLocaleString() });
            setReactivatedAt(null);
            setShowArchiveModal(false);
          }}
        />
      )}
    </div>
  );
}

function ComplianceTab({ agent }: { agent: AgentWorkspaceRecord }) {
  const summary = getBusinessComplianceSummary(agent.npDocs);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Required Approved" value={`${summary.approvedMandatoryDocuments}/${summary.mandatoryDocuments}`} />
        <StatCard label="Pending Review" value={summary.pendingDocuments} />
        <StatCard label="Rejected" value={summary.rejectedDocuments} />
        <StatCard label="Missing" value={summary.missingDocuments} />
        <StatCard label="Linked Onboarding" value={agent.onboardingRecordId ? `#${agent.onboardingRecordId}` : 'None'} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50">
              <th className="px-3 py-2.5 text-left font-medium text-text-muted">Requirement</th>
              <th className="px-3 py-2.5 text-left font-medium text-text-muted">Required</th>
              <th className="px-3 py-2.5 text-left font-medium text-text-muted">Status</th>
              <th className="px-3 py-2.5 text-left font-medium text-text-muted">Uploaded</th>
              <th className="px-3 py-2.5 text-left font-medium text-text-muted">Reviewed</th>
              <th className="px-3 py-2.5 text-left font-medium text-text-muted">Source</th>
              <th className="px-3 py-2.5 text-left font-medium text-text-muted">Notes</th>
            </tr>
          </thead>
          <tbody>
            {NP_DOC_REQUIREMENTS.map((requirement) => {
              // Defensive fallback: if the agent has no docs (e.g. live-data
              // agents from the DB before document tracking is wired), render
              // each requirement as 'missing' rather than crashing on the
              // non-null assertion.
              const document = agent.npDocs?.find((item) => item.requirementId === requirement.id) ?? {
                requirementId: requirement.id,
                status: 'missing' as const,
                source: 'directory' as const,
              };

              return (
                <tr key={requirement.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-3">
                    <div className="font-semibold text-text-primary">{requirement.name}</div>
                    <div className="text-xs text-text-secondary">{requirement.description}</div>
                  </td>
                  <td className="px-3 py-3">{requirement.mandatory ? 'Required' : 'Optional'}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${complianceTone(document.status)}`}>
                      {complianceLabel(document.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3">{document.uploadedDate || '—'}</td>
                  <td className="px-3 py-3">{document.reviewedDate || '—'}</td>
                  <td className="px-3 py-3">{document.source === 'onboarding' ? 'Onboarding' : 'Directory'}</td>
                  <td className="px-3 py-3 text-text-secondary">{document.notes || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DriversTab({ drivers }: { drivers: TenantCourier[] }) {
  if (drivers.length === 0) {
    return <div className="rounded-xl bg-surface-light p-6 text-sm text-text-secondary">No drivers are currently associated with this partner.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-slate-50">
            <th className="py-3 pl-3 pr-4 text-left font-medium text-text-muted">Driver</th>
            <th className="py-3 pr-4 text-left font-medium text-text-muted">Vehicle</th>
            <th className="py-3 pr-4 text-left font-medium text-text-muted">Phone</th>
            <th className="py-3 pr-4 text-left font-medium text-text-muted">Status</th>
            <th className="py-3 pr-3 text-left font-medium text-text-muted">Last Active</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((driver) => (
            <tr key={driver.id} className="border-b border-border last:border-b-0">
              <td className="py-3 pl-3 pr-4">
                <div className="font-medium text-text-primary">{driver.firstName} {driver.lastName}</div>
                <div className="text-xs text-text-secondary">{driver.email}</div>
              </td>
              <td className="py-3 pr-4">{driver.vehicleType} · {driver.vehicleMake} {driver.vehicleModel}</td>
              <td className="py-3 pr-4">{driver.phone}</td>
              <td className="py-3 pr-4">{driver.isOnline ? 'Online' : 'Offline'}</td>
              <td className="py-3 pr-3">{new Date(driver.lastActiveDate).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DriverComplianceTab({ drivers }: { drivers: TenantCourier[] }) {
  const summary = getDriverComplianceSummary(drivers);

  if (drivers.length === 0) {
    return <div className="rounded-xl bg-surface-light p-6 text-sm text-text-secondary">No driver compliance records are available for this partner yet.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-text-secondary">Compliant {summary.compliant} · Expiring {summary.expiring} · Non-Compliant {summary.nonCompliant}</div>
      <div className="space-y-3">
        {drivers.map((driver) => (
          <div key={driver.id} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-text-primary">{driver.firstName} {driver.lastName}</div>
                <div className="mt-1 text-sm text-text-secondary">{driver.vehicleType} · {driver.vehicleRego}</div>
              </div>
              <DriverCompliancePill status={driver.complianceStatus} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <div className="rounded-lg bg-surface-light px-3 py-2">
                <div className="text-text-muted">Insurance / Vehicle Docs</div>
                <div className="mt-1 font-medium text-text-primary">
                  {driver.complianceStatus === 'Non-Compliant' ? 'Expired' : driver.complianceStatus === 'Expiring' ? 'Expiring Soon' : 'Current'}
                </div>
              </div>
              <div className="rounded-lg bg-surface-light px-3 py-2">
                <div className="text-text-muted">Operational Status</div>
                <div className="mt-1 font-medium text-text-primary">{driver.isOnline ? 'Available' : 'Offline'}</div>
              </div>
              <div className="rounded-lg bg-surface-light px-3 py-2">
                <div className="text-text-muted">Last Activity</div>
                <div className="mt-1 font-medium text-text-primary">{new Date(driver.lastActiveDate).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NpComplianceBar({ documents }: { documents: BusinessComplianceDocument[] }) {
  const percentage = getCompliancePercentage(documents);
  const summary = getBusinessComplianceSummary(documents);

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${percentage}%` }} />
      </div>
      <span className="text-xs text-text-secondary">{summary.approvedMandatoryDocuments}/{summary.mandatoryDocuments}</span>
    </div>
  );
}

export function AgentWorkspace({
  agent,
  variant,
}: {
  agent: AgentWorkspaceRecord;
  variant: 'inline' | 'page';
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const drivers = useMemo(() => getDriversForAgent(agent.id), [agent.id]);
  const complianceSummary = getBusinessComplianceSummary(agent.npDocs);
  const compliancePercentage = getCompliancePercentage(agent.npDocs);

  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'agent-np-compliance', label: 'Agent / NP Compliance' },
    { id: 'drivers', label: 'Drivers' },
    { id: 'driver-compliance', label: 'Driver Compliance' },
  ];

  return (
    <div className={variant === 'page' ? 'space-y-6' : 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100'}>
      <div className={variant === 'page' ? 'rounded-2xl border border-border bg-white p-6 shadow-sm' : 'border-b border-slate-200 pb-3'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {variant === 'page' && (
              <button
                onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/agents')}
                className="inline-flex items-center text-sm text-text-secondary transition-colors hover:text-brand-cyan"
              >
                ← Back to Directory
              </button>
            )}

            <div className={`${variant === 'page' ? 'mt-3' : ''} flex flex-wrap items-center gap-2`}>
              <div className={variant === 'page' ? 'text-2xl font-bold text-text-primary' : 'text-lg font-bold text-text-primary'}>{agent.name}</div>
              <StatusPill status={agent.status} />
              <AssociationBadge association={agent.association} />
              {agent.isNetworkPartner && agent.npTier && <TierBadge tier={agent.npTier} />}
            </div>

            <div className="mt-1 text-sm text-text-secondary">{agent.contactName} · {agent.city}, {agent.state} · {agent.phone} · {agent.email}</div>
          </div>

          <div className={`grid gap-2 ${variant === 'page' ? 'min-w-[320px] grid-cols-2 lg:grid-cols-4' : 'min-w-[240px] grid-cols-2'}`}>
            <StatCard label="Compliance" value={`${complianceSummary.approvedMandatoryDocuments}/${complianceSummary.mandatoryDocuments}`} detail={`${compliancePercentage}% required approved`} />
            <StatCard label="Drivers" value={drivers.length} />
            <StatCard label="Pending Review" value={complianceSummary.pendingDocuments} />
            <StatCard label="Rejected / Missing" value={complianceSummary.rejectedDocuments + complianceSummary.missingDocuments} />
          </div>
        </div>

        <div className="mt-4 flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'border-brand-cyan text-brand-cyan' : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={variant === 'page' ? '' : 'mt-4'}>
        {activeTab === 'overview' && <OverviewTab agent={agent} drivers={drivers} />}
        {activeTab === 'agent-np-compliance' && <ComplianceTab agent={agent} />}
        {activeTab === 'drivers' && <DriversTab drivers={drivers} />}
        {activeTab === 'driver-compliance' && <DriverComplianceTab drivers={drivers} />}
      </div>
    </div>
  );
}
