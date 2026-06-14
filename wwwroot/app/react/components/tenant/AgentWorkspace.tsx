import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AssociationBadge } from '@/components/common/AssociationBadge';
import { TierBadge } from '@/components/tenant/TierBadge';
import type { BusinessComplianceDocument, TenantCourier } from '@/types';
import { Modal } from '@/components/tenant/Modal';
import {
  archiveAgent,
  getAgentStatusTone,
  getBusinessComplianceSummary,
  getCompliancePercentage,
  getDriverComplianceSummary,
  getDriversForAgent,
  type AgentWorkspaceRecord,
} from '@/pages/tenant/agentComplianceService';
import { useAgentComplianceDetail } from '@/hooks/useAgentCompliance';
import {
  agentProfilesApi,
  staffAgentDocsApi,
  type AgentComplianceDetail,
  type AgentComplianceProfiles,
  type AgentDocument,
} from '@/services/np_agentComplianceService';
import { AgentDocumentPreviewModal } from './AgentDocumentPreviewModal';

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

// Tenant-administered client compliance-profile overlays (Phase 4b-ii). Assigned
// profiles add their required documents to this NP's compliance scorecard.
function ClientProfilesPanel({ agentId }: { agentId: number }) {
  const [data, setData] = useState<AgentComplianceProfiles | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { agentProfilesApi.getForAgent(agentId).then(setData).catch(() => {}); }, [agentId]);

  const toggle = async (pid: number, on: boolean) => {
    if (!data) return;
    const next = on ? [...data.assignedProfileIds, pid] : data.assignedProfileIds.filter((x) => x !== pid);
    setBusy(true);
    try { setData(await agentProfilesApi.setForAgent(agentId, next)); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-surface-light p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Client Compliance Profiles</div>
      {!data ? (
        <div className="mt-1 text-sm text-text-secondary">Loading…</div>
      ) : data.available.length === 0 ? (
        <div className="mt-1 text-sm text-text-secondary">No client profiles configured yet.</div>
      ) : (
        <>
          <div className="mt-2 space-y-1.5">
            {data.available.map((p) => {
              const on = data.assignedProfileIds.includes(p.id);
              return (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-brand-cyan" checked={on} disabled={busy} onChange={(e) => toggle(p.id, e.target.checked)} />
                  <span className="text-text-primary">{p.name}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-text-muted">Assigned profiles add their required documents to this NP's compliance.</p>
        </>
      )}
    </div>
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

        <ClientProfilesPanel agentId={agent.id} />

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

function aiTone(decision?: string | null): string {
  switch (decision) {
    case 'accept': return 'bg-green-50 text-green-700 ring-1 ring-green-200';
    case 'reject': return 'bg-red-50 text-red-700 ring-1 ring-red-200';
    default: return 'bg-slate-50 text-slate-600 ring-1 ring-slate-200';
  }
}
function aiLabel(decision?: string | null): string {
  switch (decision) {
    case 'accept': return 'AI: Accept';
    case 'reject': return 'AI: Reject';
    case 'needs_review': return 'AI: Needs review';
    default: return 'AI: —';
  }
}

// Real business-document compliance + staff review. detail (requirements +
// summary) comes from /api/v1/np/compliance/agents/:id; the document instances
// (with their Pending/Verified/Rejected status + the advisory AI suggestion)
// come from /api/v1/np/agents/:id/documents. Staff verify/reject here.
function ComplianceTab({ agentId, detail, onChanged }: {
  agentId: number;
  detail: AgentComplianceDetail | null;
  onChanged: () => void;
}) {
  const [docs, setDocs] = useState<AgentDocument[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectFor, setRejectFor] = useState<AgentDocument | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  // STEVE-AGENT-DOCUMENT-PREVIEW-MODAL-2026-06-13 — preview/AI/Verify-Reject
  // in one modal. Opens from the File column's "View" affordance below.
  const [previewDoc, setPreviewDoc] = useState<AgentDocument | null>(null);

  const loadDocs = useCallback(async () => {
    try { setDocs(await staffAgentDocsApi.list(agentId)); } catch { /* surfaced via empty state */ }
  }, [agentId]);
  useEffect(() => { loadDocs(); }, [loadDocs]);

  // Latest active doc per type (server already filters IsActive).
  const docByType = useMemo(() => {
    const m = new Map<number, AgentDocument>();
    [...docs].sort((a, b) => b.uploadedDate.localeCompare(a.uploadedDate))
      .forEach((d) => { if (!m.has(d.documentTypeId)) m.set(d.documentTypeId, d); });
    return m;
  }, [docs]);

  const summary = detail?.summary;
  const requirements = detail?.requirements ?? [];

  const after = async () => { await loadDocs(); onChanged(); setBusyId(null); };
  const onVerify = async (d: AgentDocument) => {
    setBusyId(d.id);
    try { await staffAgentDocsApi.verify(agentId, d.id); } finally { await after(); }
  };
  const confirmReject = async () => {
    if (!rejectFor) return;
    const id = rejectFor.id;
    setBusyId(id);
    setRejectFor(null);
    try { await staffAgentDocsApi.reject(agentId, id, rejectReason.trim() || 'Rejected'); }
    finally { setRejectReason(''); await after(); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Required Approved" value={summary ? `${summary.approvedMandatoryDocuments}/${summary.mandatoryDocuments}` : '—'} />
        <StatCard label="Pending Review" value={summary?.pendingDocuments ?? '—'} />
        <StatCard label="Rejected" value={summary?.rejectedDocuments ?? '—'} />
        <StatCard label="Missing" value={summary?.missingDocuments ?? '—'} />
        <StatCard label="NP Score" value={detail ? `${detail.overallScorePercent}%` : '—'} detail={detail ? `docs ${detail.compliancePercent}% · fleet ${detail.courierCompliancePercent}%` : undefined} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50">
              <th className="px-3 py-2.5 text-left font-medium text-text-muted">Requirement</th>
              <th className="px-3 py-2.5 text-left font-medium text-text-muted">Required</th>
              <th className="px-3 py-2.5 text-left font-medium text-text-muted">Status</th>
              <th className="px-3 py-2.5 text-left font-medium text-text-muted">AI suggestion</th>
              <th className="px-3 py-2.5 text-left font-medium text-text-muted">Expiry</th>
              <th className="px-3 py-2.5 text-left font-medium text-text-muted">File</th>
              <th className="px-3 py-2.5 text-left font-medium text-text-muted">Action</th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((req) => {
              const doc = docByType.get(req.documentTypeId);
              const pending = doc?.verifyStatus === 'Pending';
              return (
                <tr key={req.documentTypeId} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-3 font-semibold text-text-primary">
                    {req.documentTypeName}
                    {req.source === 'onboarding' && <span className="ml-2 text-xs font-normal text-text-muted">(from onboarding)</span>}
                  </td>
                  <td className="px-3 py-3">{req.mandatory ? 'Required' : 'Optional'}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${complianceTone(req.status as BusinessComplianceDocument['status'])}`}>
                      {complianceLabel(req.status as BusinessComplianceDocument['status'])}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {doc?.aiSuggestedDecision ? (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${aiTone(doc.aiSuggestedDecision)}`} title={doc.aiRationale ?? ''}>
                        {aiLabel(doc.aiSuggestedDecision)}
                        {doc.aiSuggestedExpiry ? ` · exp ${doc.aiSuggestedExpiry}` : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {req.expiryDate ? <span className={(req.isExpired || req.isExpiringUrgent) ? 'text-red-600' : req.isExpiring ? 'text-amber-600' : ''}>{req.expiryDate}</span> : '—'}
                  </td>
                  <td className="px-3 py-3">
                    {doc ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="text-sm font-medium text-brand-cyan hover:underline"
                        >
                          View
                        </button>
                        <a
                          href={staffAgentDocsApi.downloadUrl(agentId, doc.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-text-muted hover:text-text-secondary"
                        >
                          Download
                        </a>
                      </div>
                    ) : <span className="text-xs text-text-muted">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    {pending && doc ? (
                      <div className="flex gap-2">
                        <button onClick={() => onVerify(doc)} disabled={busyId === doc.id} className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">Verify</button>
                        <button onClick={() => setRejectFor(doc)} disabled={busyId === doc.id} className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">Reject</button>
                      </div>
                    ) : doc?.verifyStatus === 'Rejected' ? (
                      <span className="text-xs text-red-600" title={doc.rejectReason}>Rejected</span>
                    ) : doc?.verifyStatus === 'Verified' ? (
                      <span className="text-xs text-green-700">Verified</span>
                    ) : <span className="text-xs text-text-muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rejectFor && (
        <Modal isOpen onClose={() => { setRejectFor(null); setRejectReason(''); }} title="Reject document" size="sm" footer={
          <>
            <button onClick={() => { setRejectFor(null); setRejectReason(''); }} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary">Cancel</button>
            <button onClick={confirmReject} className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700">Reject document</button>
          </>
        }>
          <p className="text-sm text-text-secondary mb-3">Tell the NP why <strong>{rejectFor.documentTypeName}</strong> was rejected so they can re-upload.</p>
          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="Reason for rejection…" className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </Modal>
      )}

      <AgentDocumentPreviewModal
        isOpen={previewDoc !== null}
        agentId={agentId}
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onChanged={after}
      />
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
  // STEVE-COMPLIANCE-MONITORING-REDESIGN-2026-06-13 — accept `?tab=` deep-link
  // so the new Compliance Monitoring page can jump straight to Agent / NP
  // Compliance instead of forcing staff through Overview first.
  const [searchParams] = useSearchParams();
  const initialFromUrl = (searchParams.get('tab') ?? '') as WorkspaceTab | '';
  const initialTab: WorkspaceTab =
    initialFromUrl === 'agent-np-compliance' || initialFromUrl === 'drivers' ||
    initialFromUrl === 'driver-compliance' || initialFromUrl === 'overview'
      ? initialFromUrl
      : 'overview';
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const drivers = useMemo(() => getDriversForAgent(agent.id), [agent.id]);
  const { detail, refresh: refreshDetail } = useAgentComplianceDetail(agent.id);
  const summary = detail?.summary;

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
            <StatCard label="Compliance" value={summary ? `${summary.approvedMandatoryDocuments}/${summary.mandatoryDocuments}` : '—'} detail={detail ? `${detail.overallScorePercent}% NP score` : undefined} />
            <StatCard label="Drivers" value={drivers.length} />
            <StatCard label="Pending Review" value={summary?.pendingDocuments ?? '—'} />
            <StatCard label="Rejected / Missing" value={summary ? summary.rejectedDocuments + summary.missingDocuments : '—'} />
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
        {activeTab === 'agent-np-compliance' && <ComplianceTab agentId={agent.id} detail={detail} onChanged={refreshDetail} />}
        {activeTab === 'drivers' && <DriversTab drivers={drivers} />}
        {activeTab === 'driver-compliance' && <DriverComplianceTab drivers={drivers} />}
      </div>
    </div>
  );
}
