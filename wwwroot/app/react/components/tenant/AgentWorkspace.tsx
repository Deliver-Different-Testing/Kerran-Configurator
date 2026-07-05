import type { ReactNode } from 'react';
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

type WorkspaceTab = 'overview' | 'compliance' | 'drivers' | 'contacts' | 'rates';

interface ContactRow {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: 'Active' | 'Invitation Pending';
  lastLogin: string;
}

interface RateRow {
  id: string;
  airport: string;
  vehicleSize: string;
  distanceRate: string;
  baseCharge: string;
  distanceIncluded: string;
  perDistanceUnit: string;
  extraCharge: string;
  zoneRateCard: string;
}

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
    case 'approved': return 'bg-green-100 text-green-700';
    case 'uploaded': return 'bg-sky-100 text-sky-700';
    case 'under_review': return 'bg-amber-100 text-amber-700';
    case 'rejected': return 'bg-red-100 text-red-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function complianceLabel(status: BusinessComplianceDocument['status']) {
  switch (status) {
    case 'under_review': return 'Under Review';
    case 'uploaded': return 'Uploaded';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    default: return 'Missing';
  }
}

function StatCard({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-1 text-lg font-bold text-text-primary">{value}</div>
      {detail && <div className="mt-1 text-xs text-text-secondary">{detail}</div>}
    </div>
  );
}

function OtdDisplay({ rate }: { rate: number }) {
  const color = rate >= 95 ? 'text-green-600' : rate >= 85 ? 'text-amber-600' : 'text-red-600';
  return <span className={`font-bold text-sm ${color}`}>{rate.toFixed(1)}%</span>;
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
    <Modal isOpen onClose={onClose} title="Archive / Disable NP" size="sm" footer={
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
          Cancel
        </button>
        <button
          onClick={() => onConfirm(reason, notes)}
          disabled={!reason}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Disable partner
        </button>
      </>
    }>
      <p className="mb-4 text-sm text-text-secondary">
        Archive <strong>{agentName}</strong> from the NP directory.
      </p>
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-text-primary">Reason</label>
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
        <label className="mb-1 block text-sm font-medium text-text-primary">Notes</label>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Client compliance profiles</div>
      {!data ? (
        <div className="mt-1 text-sm text-text-secondary">Loading…</div>
      ) : data.available.length === 0 ? (
        <div className="mt-1 text-sm text-text-secondary">No client profiles configured yet.</div>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {data.available.map((p) => {
              const on = data.assignedProfileIds.includes(p.id);
              return (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 accent-brand-cyan" checked={on} disabled={busy} onChange={(e) => toggle(p.id, e.target.checked)} />
                  <span className="text-text-primary">{p.name}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-text-muted">Assigned profiles add their required documents to this NP's compliance score.</p>
        </>
      )}
    </div>
  );
}

function buildContacts(agent: AgentWorkspaceRecord, drivers: TenantCourier[]): ContactRow[] {
  const opsContact = drivers[0];
  const billingContact = drivers[1] ?? drivers[0];

  return [
    {
      id: 'primary',
      name: agent.contactName || agent.name,
      role: agent.isNetworkPartner ? 'NP Manager' : 'Primary Agent Contact',
      email: agent.email || 'Not provided',
      phone: agent.phone || 'Not provided',
      status: 'Active',
      lastLogin: agent.isNetworkPartner ? '2 hours ago' : '—',
    },
    {
      id: 'ops',
      name: opsContact ? `${opsContact.firstName} ${opsContact.lastName}` : `${agent.contactName || agent.name} Ops`,
      role: 'Dispatcher',
      email: opsContact?.email ?? `ops@${agent.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
      phone: opsContact?.phone ?? agent.phone,
      status: 'Active',
      lastLogin: opsContact ? new Date(opsContact.lastActiveDate).toLocaleDateString() : 'Yesterday',
    },
    {
      id: 'billing',
      name: billingContact ? `${billingContact.firstName} ${billingContact.lastName}` : `${agent.contactName || agent.name} Billing`,
      role: 'Billing',
      email: billingContact?.email ?? `accounts@${agent.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
      phone: billingContact?.phone ?? agent.phone,
      status: 'Invitation Pending',
      lastLogin: 'Never',
    },
  ];
}

function buildRateRows(agent: AgentWorkspaceRecord, drivers: TenantCourier[]): RateRow[] {
  const vehicleTypes = Array.from(new Set(drivers.map((d) => d.vehicleType)));
  const baseVehicles = vehicleTypes.length > 0 ? vehicleTypes : ['Small', 'Van', 'Truck'];
  const cityCode = agent.city.slice(0, 3).toUpperCase() || 'AIR';

  return baseVehicles.slice(0, 3).map((vehicle, index) => ({
    id: `${agent.id}-${vehicle}-${index}`,
    airport: `${cityCode} · ${agent.city} ${index === 0 ? 'Primary' : index === 1 ? 'Regional' : 'Secondary'} Airport`,
    vehicleSize: vehicle,
    distanceRate: `Default ${vehicle} Distance Rate`,
    baseCharge: `$${45 + (index * 18)}`,
    distanceIncluded: `${10 + index * 5} mi`,
    perDistanceUnit: `$${(1.9 + index * 0.7).toFixed(2)}`,
    extraCharge: `Default ${vehicle} Extra Charge`,
    zoneRateCard: index === 0 ? `${agent.city} Core Zone Card` : `${agent.state} Medical Zone Card`,
  }));
}

function MetricTrend({ title, value, detail, points, tone = 'cyan' }: { title: string; value: ReactNode; detail?: string; points: number[]; tone?: 'cyan' | 'green' | 'purple'; }) {
  const stroke = tone === 'green' ? '#13b964' : tone === 'purple' ? '#824ae0' : '#3bc7f4';
  const fill = tone === 'green' ? 'rgba(19,185,100,0.12)' : tone === 'purple' ? 'rgba(130,74,224,0.12)' : 'rgba(59,199,244,0.12)';
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = Math.max(max - min, 1);
  const d = points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * 100;
    const y = 100 - (((point - min) / span) * 80 + 10);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  const area = `${d} L 100 100 L 0 100 Z`;

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{title}</div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{value}</div>
          {detail && <div className="mt-1 text-xs text-text-secondary">{detail}</div>}
        </div>
      </div>
      <div className="mt-4 h-24 rounded-2xl bg-slate-50 p-2">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <path d={area} fill={fill} />
          <path d={d} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function CoverageBars({ airportCount, zipCount }: { airportCount: number; zipCount: number; }) {
  const airportWidth = Math.min(100, Math.max(18, airportCount * 18));
  const zipWidth = Math.min(100, Math.max(22, zipCount / 2));

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Coverage footprint</div>
      <div className="mt-4 space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-text-primary">Airports covered</span>
            <span className="font-semibold text-text-primary">{airportCount}</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-brand-cyan" style={{ width: `${airportWidth}%` }} /></div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-text-primary">Zipcodes mapped</span>
            <span className="font-semibold text-text-primary">{zipCount}</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-violet-500" style={{ width: `${zipWidth}%` }} /></div>
        </div>
      </div>
    </div>
  );
}

function buildLiveDeliveries(agent: AgentWorkspaceRecord) {
  const city = agent.city || 'Unknown';
  return [
    { id: `LD-${agent.id}-1842`, route: `${city} Airport → ${city} CBD`, eta: '14:35', status: 'In transit', sla: 'On time', tone: 'green' },
    { id: `LD-${agent.id}-1846`, route: `${city} Labs → ${city} Hospital`, eta: '14:52', status: 'Picked up', sla: 'At risk', tone: 'amber' },
    { id: `LD-${agent.id}-1851`, route: `${city} Depot → ${city} North`, eta: '15:10', status: 'Awaiting dispatch', sla: 'Queued', tone: 'slate' },
  ] as const;
}

function OverviewTab({ agent, drivers }: { agent: AgentWorkspaceRecord; drivers: TenantCourier[] }) {
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [reactivatedAt, setReactivatedAt] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(agent.status);
  const [archiveInfo, setArchiveInfo] = useState<{ reason: string; notes: string; archivedAt: string } | null>(null);
  const isActive = localStatus !== 'Archived';
  const areas = agent.coverageAreas.length > 0 ? agent.coverageAreas : [agent.city];
  const airportsCovered = Math.max(1, Math.min(6, drivers.length + (agent.isNetworkPartner ? 1 : 0)));
  const zipcodesCovered = (agent.coverageAreaDetails?.reduce((sum, area) => sum + area.zipCount, 0) ?? 0) || (areas.length * 14);
  const complianceDays = agent.npActivatedDate
    ? Math.max(1, Math.floor((Date.now() - new Date(agent.npActivatedDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const otdBase = agent.otdRate ?? 88;
  const otdTrend = [otdBase - 6, otdBase - 3, otdBase - 1, otdBase + 1, otdBase - 2, otdBase].map((v) => Math.max(60, Math.min(99, Math.round(v))));
  const complianceTrend = [Math.max(50, complianceDays * 0.35), Math.max(55, complianceDays * 0.5), Math.max(60, complianceDays * 0.65), Math.max(65, complianceDays * 0.8), Math.max(70, complianceDays * 0.92), Math.max(75, complianceDays)].map((v) => Math.min(100, Math.round(v)));
  const liveDeliveries = buildLiveDeliveries(agent);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr_0.9fr]">
        <MetricTrend
          title="On-time performance"
          value={agent.otdRate != null ? <OtdDisplay rate={agent.otdRate} /> : 'No data'}
          detail="6 month trend"
          points={otdTrend}
          tone="cyan"
        />
        <MetricTrend
          title="Time in compliance"
          value={complianceDays > 0 ? `${complianceDays} days` : 'Not live'}
          detail={agent.npActivatedDate ? `Since ${agent.npActivatedDate}` : 'Awaiting NP activation'}
          points={complianceTrend}
          tone="green"
        />
        <CoverageBars airportCount={airportsCovered} zipCount={zipcodesCovered} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xl font-semibold text-text-primary">Live deliveries</div>
              <div className="mt-1 text-sm text-text-secondary">Current jobs, SLA state and ETA for this partner.</div>
            </div>
            <div className="text-xs font-medium text-text-secondary">{liveDeliveries.length} live</div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  <th className="px-3 py-2.5 text-left font-medium text-text-muted">Job</th>
                  <th className="px-3 py-2.5 text-left font-medium text-text-muted">Route</th>
                  <th className="px-3 py-2.5 text-left font-medium text-text-muted">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium text-text-muted">ETA</th>
                  <th className="px-3 py-2.5 text-left font-medium text-text-muted">SLA</th>
                </tr>
              </thead>
              <tbody>
                {liveDeliveries.map((delivery) => (
                  <tr key={delivery.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-3 font-medium text-text-primary">{delivery.id}</td>
                    <td className="px-3 py-3 text-text-secondary">{delivery.route}</td>
                    <td className="px-3 py-3 text-text-primary">{delivery.status}</td>
                    <td className="px-3 py-3 text-text-primary">{delivery.eta}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${delivery.tone === 'green' ? 'bg-green-100 text-green-700' : delivery.tone === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {delivery.sla}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xl font-semibold text-text-primary">Coverage map</div>
              <div className="mt-1 text-sm text-text-secondary">Airports, zipcodes and service area footprint.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-text-primary">+ Add area</button>
              <button className="rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-text-primary">Use existing city picker</button>
            </div>
          </div>

          <div className="mb-4 h-[320px] overflow-hidden rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,rgba(59,199,244,0.10),rgba(59,199,244,0.03)),radial-gradient(circle_at_24%_38%,rgba(220,50,70,0.22)_0_12%,transparent_13%),radial-gradient(circle_at_46%_54%,rgba(220,50,70,0.20)_0_16%,transparent_17%),radial-gradient(circle_at_63%_44%,rgba(220,50,70,0.18)_0_12%,transparent_13%),linear-gradient(135deg,#f7f6f5,#ece9e7)] p-4">
            <div className="flex h-full items-end">
              <div className="rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-text-primary shadow-sm">
                Map / polygon preview placeholder — reuse Admin Manager map + zip shading
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {areas.map((area) => (
              <span key={area} className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-text-primary">
                {area}
              </span>
            ))}
            {agent.coverageAreaDetails?.filter((a) => !a.hasZipMapping).map((area) => (
              <span key={`${area.areaName}-warning`} className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                {area.areaName} has no zips mapped
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {!agent.isNetworkPartner && (
            <div className="rounded-[24px] border border-purple-200 bg-purple-50/70 p-4 text-sm text-text-primary">
              <strong>Pre-promotion branch:</strong> keep promotion in the separate Edit Agent flow. This surface can still act as the detail home, but Tier / Portal Enabled / Default Courier Pay only become first-class once the Agent is promoted to NP.
            </div>
          )}

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 text-xl font-semibold text-text-primary">Operational snapshot</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard label="Association" value={agent.association === 'None' ? 'Independent' : agent.association} />
              <StatCard label="Member ID" value={agent.associationMemberId || 'Not provided'} />
              <StatCard label="Portal enabled" value={agent.npPortalEnabled ? 'Yes' : agent.isNetworkPartner ? 'Live' : 'Not live'} />
              <StatCard label="Default courier pay" value={agent.defaultCourierPayPercent ? `${agent.defaultCourierPayPercent}%` : 'Not set'} />
              <StatCard label="Driver roster" value={drivers.length} detail={drivers.length === 1 ? '1 assigned driver' : `${drivers.length} assigned drivers`} />
              <StatCard label="Airports / zips" value={`${airportsCovered} / ${zipcodesCovered}`} detail="Coverage breadth" />
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 text-xl font-semibold text-text-primary">Programs & notes</div>
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Clients serviced</div>
                <div className="flex flex-wrap gap-2">
                  {(agent.clientsServiced && agent.clientsServiced.length > 0) ? agent.clientsServiced.map((client) => (
                    <span key={client} className="rounded-full bg-brand-cyan/10 px-3 py-1 text-xs font-medium text-brand-cyan">{client}</span>
                  )) : <span className="text-sm text-text-secondary">None listed</span>}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Approved programs</div>
                <div className="flex flex-wrap gap-2">
                  {(agent.approvedPrograms && agent.approvedPrograms.length > 0) ? agent.approvedPrograms.map((prog) => (
                    <span key={prog} className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">{prog}</span>
                  )) : <span className="text-sm text-text-secondary">None listed</span>}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Notes</div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-text-secondary">{agent.notes || 'No notes added.'}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xl font-semibold text-text-primary">Partner status</div>
                {archiveInfo && <div className="mt-1 text-xs text-text-secondary">Archived {archiveInfo.archivedAt}</div>}
                {isActive && reactivatedAt && <div className="mt-1 text-xs text-green-700">Reactivated {reactivatedAt}</div>}
              </div>
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
                <span className={`text-sm font-medium ${isActive ? 'text-green-600' : 'text-slate-500'}`}>{isActive ? 'Active' : 'Archived'}</span>
              </div>
            </div>
            {archiveInfo && !isActive && (
              <div className="rounded-2xl bg-slate-50 p-3 text-xs text-text-secondary">
                <div><span className="font-medium">Reason:</span> {archiveInfo.reason}</div>
                {archiveInfo.notes && <div className="mt-1"><span className="font-medium">Notes:</span> {archiveInfo.notes}</div>}
              </div>
            )}
          </div>
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

function ComplianceTab({ agentId, detail, onChanged, drivers }: {
  agentId: number;
  detail: AgentComplianceDetail | null;
  onChanged: () => void;
  drivers: TenantCourier[];
}) {
  const [docs, setDocs] = useState<AgentDocument[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectFor, setRejectFor] = useState<AgentDocument | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [previewDoc, setPreviewDoc] = useState<AgentDocument | null>(null);

  const loadDocs = useCallback(async () => {
    try { setDocs(await staffAgentDocsApi.list(agentId)); } catch { /* noop */ }
  }, [agentId]);
  useEffect(() => { loadDocs(); }, [loadDocs]);

  const docByType = useMemo(() => {
    const m = new Map<number, AgentDocument>();
    [...docs].sort((a, b) => b.uploadedDate.localeCompare(a.uploadedDate))
      .forEach((d) => { if (!m.has(d.documentTypeId)) m.set(d.documentTypeId, d); });
    return m;
  }, [docs]);

  const driverSummary = getDriverComplianceSummary(drivers);
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
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Required approved" value={summary ? `${summary.approvedMandatoryDocuments}/${summary.mandatoryDocuments}` : '—'} />
        <StatCard label="Pending review" value={summary?.pendingDocuments ?? '—'} />
        <StatCard label="Rejected" value={summary?.rejectedDocuments ?? '—'} />
        <StatCard label="Missing" value={summary?.missingDocuments ?? '—'} />
        <StatCard label="NP score" value={detail ? `${detail.overallScorePercent}%` : '—'} detail={detail ? `docs ${detail.compliancePercent}% · fleet ${detail.courierCompliancePercent}%` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-xl font-semibold text-text-primary">Compliance</div>
              <div className="mt-1 text-sm text-text-secondary">NP-level documents with staff review and AI suggestion support.</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
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
                            <button onClick={() => setPreviewDoc(doc)} className="text-sm font-medium text-brand-cyan hover:underline">View</button>
                            <a href={staffAgentDocsApi.downloadUrl(agentId, doc.id)} target="_blank" rel="noreferrer" className="text-xs text-text-muted hover:text-text-secondary">Download</a>
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
        </div>

        <div className="space-y-5">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 text-xl font-semibold text-text-primary">Driver compliance roll-up</div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Compliant" value={driverSummary.compliant} />
              <StatCard label="Expiring" value={driverSummary.expiring} />
              <StatCard label="Non-compliant" value={driverSummary.nonCompliant} />
            </div>
            <div className="mt-4 space-y-3">
              {drivers.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-text-secondary">No driver compliance records available yet.</div>
              ) : drivers.map((driver) => (
                <div key={driver.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-text-primary">{driver.firstName} {driver.lastName}</div>
                      <div className="mt-1 text-sm text-text-secondary">{driver.vehicleType} · {driver.vehicleRego}</div>
                    </div>
                    <DriverCompliancePill status={driver.complianceStatus} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ClientProfilesPanel agentId={agentId} />
        </div>
      </div>

      {rejectFor && (
        <Modal isOpen onClose={() => { setRejectFor(null); setRejectReason(''); }} title="Reject document" size="sm" footer={
          <>
            <button onClick={() => { setRejectFor(null); setRejectReason(''); }} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary">Cancel</button>
            <button onClick={confirmReject} className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700">Reject document</button>
          </>
        }>
          <p className="mb-3 text-sm text-text-secondary">Tell the NP why <strong>{rejectFor.documentTypeName}</strong> was rejected so they can re-upload.</p>
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
    return <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-sm text-text-secondary shadow-sm">No drivers are currently associated with this partner.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-slate-50">
            <th className="py-3 pl-4 pr-4 text-left font-medium text-text-muted">Driver</th>
            <th className="py-3 pr-4 text-left font-medium text-text-muted">Vehicle</th>
            <th className="py-3 pr-4 text-left font-medium text-text-muted">Phone</th>
            <th className="py-3 pr-4 text-left font-medium text-text-muted">Status</th>
            <th className="py-3 pr-4 text-left font-medium text-text-muted">Last active</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((driver) => (
            <tr key={driver.id} className="border-b border-border last:border-b-0">
              <td className="py-3 pl-4 pr-4">
                <div className="font-medium text-text-primary">{driver.firstName} {driver.lastName}</div>
                <div className="text-xs text-text-secondary">{driver.email}</div>
              </td>
              <td className="py-3 pr-4">{driver.vehicleType} · {driver.vehicleMake} {driver.vehicleModel}</td>
              <td className="py-3 pr-4">{driver.phone}</td>
              <td className="py-3 pr-4">{driver.isOnline ? 'Online' : 'Offline'}</td>
              <td className="py-3 pr-4">{new Date(driver.lastActiveDate).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContactsTab({ agent, drivers }: { agent: AgentWorkspaceRecord; drivers: TenantCourier[] }) {
  const contacts = useMemo(() => buildContacts(agent, drivers), [agent, drivers]);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-text-primary">Contacts</div>
            <div className="mt-1 text-sm text-text-secondary">Bring contact management into the NP surface instead of burying it in a separate edit flow.</div>
          </div>
          <button className="rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-text-primary">+ Invite new contact</button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="px-3 py-2.5 text-left font-medium text-text-muted">Name</th>
                <th className="px-3 py-2.5 text-left font-medium text-text-muted">Role</th>
                <th className="px-3 py-2.5 text-left font-medium text-text-muted">Status</th>
                <th className="px-3 py-2.5 text-left font-medium text-text-muted">Last login</th>
                <th className="px-3 py-2.5 text-left font-medium text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-3">
                    <div className="font-medium text-text-primary">{contact.name}</div>
                    <div className="text-xs text-text-secondary">{contact.email}</div>
                    <div className="text-xs text-text-secondary">{contact.phone}</div>
                  </td>
                  <td className="px-3 py-3">{contact.role}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${contact.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {contact.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">{contact.lastLogin}</td>
                  <td className="px-3 py-3 text-text-secondary">Change role</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-xl font-semibold text-text-primary">Contact summary</div>
          <div className="space-y-3 text-sm text-text-secondary">
            <div className="rounded-2xl bg-slate-50 p-4">Primary business contact stays visible here rather than being hidden behind Edit Agent.</div>
            <div className="rounded-2xl bg-slate-50 p-4">Dispatcher and billing contacts can sit alongside portal-user management.</div>
            <div className="rounded-2xl bg-slate-50 p-4">This is the same pattern Steve wanted from the mockup: contacts promoted into the NP detail shell.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RatesTab({ agent, drivers }: { agent: AgentWorkspaceRecord; drivers: TenantCourier[] }) {
  const rows = useMemo(() => buildRateRows(agent, drivers), [agent, drivers]);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-text-primary">Rates</div>
            <div className="mt-1 text-sm text-text-secondary">Structured to match the fuller MD table, not the older simplified rate block.</div>
          </div>
          <button className="rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-text-primary">+ Add rate</button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="px-3 py-2.5 text-left font-medium text-text-muted">Airport</th>
                <th className="px-3 py-2.5 text-left font-medium text-text-muted">Vehicle size</th>
                <th className="px-3 py-2.5 text-left font-medium text-text-muted">Distance rate</th>
                <th className="px-3 py-2.5 text-left font-medium text-text-muted">Base charge</th>
                <th className="px-3 py-2.5 text-left font-medium text-text-muted">Distance included</th>
                <th className="px-3 py-2.5 text-left font-medium text-text-muted">Per distance unit</th>
                <th className="px-3 py-2.5 text-left font-medium text-text-muted">Extra charge</th>
                <th className="px-3 py-2.5 text-left font-medium text-text-muted">Zone rate card</th>
                <th className="px-3 py-2.5 text-left font-medium text-text-muted">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-3">{row.airport}</td>
                  <td className="px-3 py-3">{row.vehicleSize}</td>
                  <td className="px-3 py-3">{row.distanceRate}</td>
                  <td className="px-3 py-3">{row.baseCharge}</td>
                  <td className="px-3 py-3">{row.distanceIncluded}</td>
                  <td className="px-3 py-3">{row.perDistanceUnit}</td>
                  <td className="px-3 py-3">{row.extraCharge}</td>
                  <td className="px-3 py-3">{row.zoneRateCard}</td>
                  <td className="px-3 py-3 text-text-secondary">Delete</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-xl font-semibold text-text-primary">Implementation note</div>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-text-secondary">
            This tab is intentionally shaped like the NP modal mockup. It still needs wiring to the real Agent Vehicles / Agent Rates data source, but the table structure now matches the intended editing surface.
          </div>
        </div>
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

export function AgentWorkspace({ agent, variant }: { agent: AgentWorkspaceRecord; variant: 'inline' | 'page'; }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFromUrl = (searchParams.get('tab') ?? '') as WorkspaceTab | '';
  const initialTab: WorkspaceTab =
    initialFromUrl === 'compliance' || initialFromUrl === 'drivers' || initialFromUrl === 'contacts' || initialFromUrl === 'rates' || initialFromUrl === 'overview'
      ? initialFromUrl
      : 'overview';
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const drivers = useMemo(() => getDriversForAgent(agent.id), [agent.id]);
  const { detail, refresh: refreshDetail } = useAgentComplianceDetail(agent.id);
  const summary = detail?.summary;
  const contacts = useMemo(() => buildContacts(agent, drivers), [agent, drivers]);

  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'compliance', label: 'Compliance' },
    { id: 'drivers', label: 'Drivers' },
    { id: 'contacts', label: 'Contacts' },
    { id: 'rates', label: 'Rates' },
  ];

  const shellClass = variant === 'page'
    ? 'mx-auto max-w-[1320px] overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]'
    : 'overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm';

  return (
    <div className={shellClass}>
      <div className="border-b border-slate-200 bg-white px-5 py-5 md:px-6 md:py-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            {variant === 'page' && (
              <button
                onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/agents')}
                className="mb-3 inline-flex items-center text-sm text-text-secondary transition-colors hover:text-brand-cyan"
              >
                ← Back to Directory
              </button>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Agent #{agent.id}</span>
              {agent.isNetworkPartner && <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">Network Partner</span>}
              <StatusPill status={agent.status} />
              {agent.npPortalEnabled && <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700">Portal enabled</span>}
              <AssociationBadge association={agent.association} />
              {agent.npTier && <TierBadge tier={agent.npTier} />}
              {agent.ranking > 0 && <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Ranking {agent.ranking}</span>}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">{agent.name}</div>
            <div className="mt-2 text-sm text-text-secondary">{agent.address} · {agent.city}, {agent.state} {agent.postCode}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="rounded-full border border-border bg-white px-3.5 py-2 text-xs font-semibold text-text-primary">Open in Admin Manager</button>
            <button className="rounded-full border border-border bg-white px-3.5 py-2 text-xs font-semibold text-text-primary">Edit overview</button>
            <button className="rounded-full bg-brand-cyan px-3.5 py-2 text-xs font-semibold text-brand-dark shadow-sm">Open promotion-only Edit Agent</button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Phone · Alt phone" value={agent.phone || 'Not provided'} detail={contacts[1]?.phone && contacts[1].phone !== agent.phone ? `Alt ${contacts[1].phone}` : undefined} />
          <StatCard label="Booking email · Alt email" value={agent.email || 'Not provided'} detail={contacts[1]?.email && contacts[1].email !== agent.email ? `Alt ${contacts[1].email}` : undefined} />
          <StatCard label="Association · Member ID" value={agent.association === 'None' ? 'Independent' : agent.association} detail={agent.associationMemberId || 'No member ID'} />
          <StatCard label="Default courier pay" value={agent.defaultCourierPayPercent ? `${agent.defaultCourierPayPercent}%` : 'Not set'} detail={agent.npActivatedDate ? `NP since ${agent.npActivatedDate}` : 'Not yet activated'} />
          <StatCard label="Compliance" value={summary ? `${summary.approvedMandatoryDocuments}/${summary.mandatoryDocuments}` : '—'} detail={detail ? `${detail.overallScorePercent}% NP score` : 'Awaiting score'} />
        </div>
      </div>

      <div className="border-b border-slate-200 bg-cyan-50/40 px-5 py-3 text-sm text-text-primary md:px-6">
        <strong>MD guardrail:</strong> this surface is backed by the Agent record and reshaped to follow the NP modal mockup — coverage-first overview, real tabs, and promoted Contacts / Rates / Compliance sections.
      </div>

      <div className="overflow-x-auto border-b border-slate-200 bg-white px-5 md:px-6">
        <div className="flex min-w-max gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-brand-cyan text-brand-cyan' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-50/70 px-5 py-5 md:px-6 md:py-6">
        {activeTab === 'overview' && <OverviewTab agent={agent} drivers={drivers} />}
        {activeTab === 'compliance' && <ComplianceTab agentId={agent.id} detail={detail} onChanged={refreshDetail} drivers={drivers} />}
        {activeTab === 'drivers' && <DriversTab drivers={drivers} />}
        {activeTab === 'contacts' && <ContactsTab agent={agent} drivers={drivers} />}
        {activeTab === 'rates' && <RatesTab agent={agent} drivers={drivers} />}
      </div>
    </div>
  );
}
