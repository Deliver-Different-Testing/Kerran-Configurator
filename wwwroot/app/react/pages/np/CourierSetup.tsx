/**
 * CourierSetup — detail-page rebuild (2026-06-08).
 *
 * Replaces the legacy 8-tab popup-style form with the same detail-page
 * pattern used by AgentSetup / ContactSetup: header + always-visible
 * Relationship & Commercial card + tabbed operational data + footer
 * actions.
 *
 * Spec drivers:
 *   • docs/NP-COLUMN-AND-COURIER-DETAIL-2026-06-08.md
 *   • docs/COURIER_MASTER_SUB_VISIBILITY_2026-06-06.md §6, §7
 *
 * Endpoints unchanged — reuses GET/PUT /api/v1/np/fleet/{id} for the
 * courier record and GET /api/v1/tenant/agents (filtered to NPs) for the
 * Network Partner picker. NULL npAgentId renders as "Direct".
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { courierService } from '@/services/np_courierService';
import { lookupService, LookupItem } from '@/services/np_lookupService';
import { fleetService, type Fleet } from '@/services/np_fleetService';
import FormField from '@/components/common/FormField';
import PasswordInput from '@/components/common/PasswordInput';
import DocumentUpload from '@/components/common/DocumentUpload';
import { useDocumentTypes, useCourierDocuments, useComplianceSummary } from '@/hooks/useDocuments';
import { CourierDocumentPreviewModal } from '@/components/np/CourierDocumentPreviewModal';
import { useAuth } from '@/context/AuthContext';
import type { Courier, DocumentStatus, CourierDocument } from '@/types';

type CourierTab = 'profile' | 'contact' | 'vehicle' | 'compliance' | 'financial' | 'device' | 'documents' | 'notes';

const TAB_KEYS: CourierTab[] = ['profile', 'contact', 'vehicle', 'compliance', 'financial', 'device', 'documents', 'notes'];
const TAB_LABELS: Record<CourierTab, string> = {
  profile: 'Profile',
  contact: 'Contact',
  vehicle: 'Vehicle',
  compliance: 'Compliance & Licensing',
  financial: 'Financial',
  device: 'Device & Access',
  documents: 'Documents',
  notes: 'Notes & Audit',
};

interface Props {
  onSelectCourier: (id: number) => void;
}

function isExpiringSoon(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date('2026-02-28');
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff > 0 && diff <= 30;
}

function isExpired(dateStr: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date('2026-02-28');
}

export default function CourierSetup({ onSelectCourier }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role } = useAuth();
  // DF Admin and Tenant Admin can reassign the Network Partner. NP users
  // see the field read-only (and the picker list is never fetched for
  // them — avoids a 401 against /api/v1/tenant/agents).
  const canEditNpPartner = role === 'dfadmin' || role === 'tenant';

  const initialTab = (searchParams.get('tab') as CourierTab) || 'profile';
  const [tab, setTab] = useState<CourierTab>(TAB_KEYS.includes(initialTab) ? initialTab : 'profile');

  const [courier, setCourier] = useState<Courier | undefined>();   // last-saved baseline
  const [draft, setDraft] = useState<Courier | undefined>();       // local edits
  const [masters, setMasters] = useState<Courier[]>([]);
  const [masterName, setMasterName] = useState<Courier | null>(null);
  // Attached subs surfaces who a master courier earns commission on.
  const [attachedSubs, setAttachedSubs] = useState<Courier[]>([]);
  const [vehicleMakes, setVehicleMakes] = useState<LookupItem[]>([]);
  const [insuranceCompanies, setInsuranceCompanies] = useState<LookupItem[]>([]);
  const [networkPartners, setNetworkPartners] = useState<LookupItem[]>([]);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Mobile App Login (set/reset password) — preserved from the pre-rewrite page
  // (commit 1395b77). Independent of the main Save; applies immediately.
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSaving, setLoginSaving] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState(false);

  useEffect(() => {
    let alive = true;
    if (id) {
      courierService.getById(Number(id)).then(c => {
        if (!alive) return;
        setCourier(c);
        setDraft(c);
        if (c) onSelectCourier(c.id);
      });
    }
    return () => { alive = false; };
  }, [id, onSelectCourier]);

  useEffect(() => {
    let alive = true;
    courierService.getMasters().then(m => { if (alive) setMasters(m); });
    // Fleet picker source. Wrapped in Promise.resolve so the call site
    // survives the eventual async conversion of fleetService.getAll()
    // (see NP-FLEET-WIRING §3.3). On failure the picker shows only the
    // saved-value fallback + "— Unassigned —".
    Promise.resolve(fleetService.getAll())
      .then(f => { if (alive) setFleets(f); })
      .catch(() => { /* stub/endpoint unreachable — picker falls back to current value only */ });
    lookupService.getVehicleMakes().then(v => { if (alive) setVehicleMakes(v); });
    lookupService.getInsuranceCompanies().then(i => { if (alive) setInsuranceCompanies(i); });
    if (canEditNpPartner) {
      lookupService.getNetworkPartners()
        .then(n => { if (alive) setNetworkPartners(n); })
        .catch(() => { /* tenant endpoint unreachable — picker falls back to current value only */ });
    }
    return () => { alive = false; };
  }, [canEditNpPartner]);

  useEffect(() => {
    let alive = true;
    if (courier?.master) {
      courierService.getById(courier.master).then(m => { if (alive) setMasterName(m ?? null); });
    } else {
      setMasterName(null);
    }
    return () => { alive = false; };
  }, [courier?.master]);

  useEffect(() => {
    let alive = true;
    if (courier?.id && courier.type === 'Master') {
      courierService.getSubsForMaster(courier.id).then(s => { if (alive) setAttachedSubs(s ?? []); });
    } else {
      setAttachedSubs([]);
    }
    return () => { alive = false; };
  }, [courier?.id, courier?.type]);

  if (!courier || !draft) {
    return (
      <div className="text-sm text-text-secondary p-6">Loading courier…</div>
    );
  }

  // ── Field-binding helpers ──────────────────────────────────────────
  const bind = <K extends keyof Courier>(field: K) => ({
    value: (draft[field] ?? '') as string,
    onChange: (val: string | boolean) => setDraft(d => d ? { ...d, [field]: val as Courier[K] } : d),
  });
  const bindNum = <K extends keyof Courier>(field: K) => ({
    value: String(draft[field] ?? ''),
    onChange: (val: string | boolean) => setDraft(d => {
      if (!d) return d;
      const n = typeof val === 'string' ? (val.trim() === '' ? 0 : Number(val)) : 0;
      return { ...d, [field]: (Number.isFinite(n) ? n : 0) as Courier[K] };
    }),
  });
  const bindBool = <K extends keyof Courier>(field: K) => ({
    checked: !!draft[field],
    onChange: (val: string | boolean) => setDraft(d => d ? { ...d, [field]: (typeof val === 'boolean' ? val : !!val) as Courier[K] } : d),
  });

  const c = draft;
  const dirty = JSON.stringify(courier) !== JSON.stringify(draft);

  function lookupSelect(
    label: string,
    idField: keyof Courier,
    nameField: keyof Courier,
    options: LookupItem[],
  ) {
    const currentId = (draft![idField] as number | null | undefined) ?? '';
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-secondary uppercase tracking-wide">{label}</label>
        <select
          value={currentId}
          onChange={(e) => {
            const raw = e.target.value;
            const newId = raw === '' ? null : Number(raw);
            const name = options.find(o => o.id === newId)?.name ?? '';
            setDraft(d => d ? { ...d, [idField]: newId, [nameField]: name } as Courier : d);
          }}
        >
          <option value="">— Select —</option>
          {options.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
    );
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await courierService.update(draft.id, draft);
      setCourier(updated);
      setDraft(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save courier';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(courier);
    setSaveError(null);
    setSaveSuccess(false);
  }

  async function handleResetLogin() {
    if (!draft) return;
    setLoginError(null);
    setLoginSuccess(false);
    setLoginSaving(true);
    try {
      const updated = await courierService.resetLogin(draft.id, loginPassword);
      // Provisioning web-enables the courier — reflect it in baseline + draft
      // without clobbering the operator's other unsaved edits.
      setCourier(updated);
      setDraft(d => (d ? { ...d, webEnabled: updated.webEnabled } : d));
      setLoginPassword('');
      setLoginSuccess(true);
      setTimeout(() => setLoginSuccess(false), 4000);
    } catch (e) {
      const ax = e as { response?: { data?: { messages?: { message?: string }[] } } };
      setLoginError(ax.response?.data?.messages?.[0]?.message ?? 'Could not set the mobile-app password. Please try again.');
    } finally {
      setLoginSaving(false);
    }
  }

  // ── Display labels ─────────────────────────────────────────────────
  // npAgentName empty + npAgentId null = "Direct" (belongs to the
  // tenant, not under any NP). The numeric id is never shown in the UI.
  const npLabel = c.npAgentId == null ? 'Direct' : (c.npAgentName || 'Network Partner');

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center gap-4 mb-5">
        <div className="w-12 h-12 rounded-full bg-brand-cyan flex items-center justify-center text-xl font-bold text-white shrink-0">
          {c.firstName[0]}{c.surName[0]}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold truncate">{c.firstName} {c.surName}</h2>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span className="text-[13px] text-text-secondary font-mono">{c.code}</span>
            <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 border border-sky-200">
              {c.type} Courier
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
              c.npAgentId == null
                ? 'bg-surface-light text-text-secondary border-border'
                : 'bg-badge-purple-bg text-badge-purple-text border-purple-200'
            }`}>
              {npLabel}
            </span>
            {c.location && <span className="text-[13px] text-text-secondary">· {c.location}</span>}
          </div>
        </div>
        <span className={`ml-auto shrink-0 px-3 py-1 rounded-xl text-xs border ${
          c.status === 'active'
            ? 'bg-green-50 text-success border-green-200'
            : 'bg-red-50 text-error border-red-200'
        }`}>
          ● {c.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* ── Relationship & Commercial (always visible, near top) ── */}
      <div className="bg-white border border-border rounded-lg p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">Relationship &amp; Commercial</h3>
          <span className="text-xs text-text-muted">Who this courier reports under and how they get paid</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Courier Type — Independent / Master / Sub / Gig (CourierTypeId
              taxonomy). Only Sub keeps a master FK; switching to any other role
              clears it. A Sub starts with no master until one is picked below. */}
          <FormField
            label="Courier Type"
            type="select"
            value={c.type}
            options={['Independent', 'Master', 'Sub', 'Gig']}
            onChange={(val) => setDraft(d => {
              if (!d) return d;
              const next = val as Courier['type'];
              return {
                ...d,
                type: next,
                master: next === 'Sub' ? d.master : null,
              };
            })}
          />

          {/* Master Courier picker — only when Sub. */}
          {c.type === 'Sub' ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Master Courier</label>
              <select
                value={c.master ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  const next = raw === '' ? null : Number(raw);
                  setDraft(d => d ? { ...d, master: next } : d);
                }}
              >
                <option value="">— Select a master —</option>
                {masters
                  .filter(m => m.id !== c.id)
                  .map(m => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.surName} ({m.code})
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Master Courier</label>
              <input type="text" value="— N/A (not a sub-contractor) —" readOnly className="bg-surface-light cursor-not-allowed opacity-80" />
            </div>
          )}

          {/* Network Partner — editable lookup for DF Admin / Tenant Admin,
              read-only display for NP users. "Direct" is the first option
              and represents NULL (courier belongs to the tenant, not an NP). */}
          {canEditNpPartner ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Network Partner</label>
              <select
                value={c.npAgentId ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  const newId = raw === '' ? null : Number(raw);
                  const newName = newId == null ? '' : (networkPartners.find(o => o.id === newId)?.name ?? c.npAgentName);
                  setDraft(d => d ? { ...d, npAgentId: newId, npAgentName: newName } : d);
                }}
              >
                <option value="">Direct (no Network Partner)</option>
                {networkPartners.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
                {/* Fallback: render the current selection even if not in the loaded
                    list (e.g. picker fetch failed, or the NP was archived). Keeps
                    the dropdown showing the saved value instead of blanking it. */}
                {c.npAgentId != null && !networkPartners.some(o => o.id === c.npAgentId) && (
                  <option value={c.npAgentId}>{c.npAgentName || 'Current Partner'}</option>
                )}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Network Partner</label>
              <input type="text" value={npLabel} readOnly className="bg-surface-light cursor-not-allowed opacity-80" />
            </div>
          )}

          {/* Fleet — maps to TucCourier.CourierFleetId. Sourced from the
              (currently stub) fleetService; NP-scoped once the backend lands.
              "— Unassigned —" is the first option and represents NULL. */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-secondary uppercase tracking-wide">Fleet</label>
            <select
              value={c.courierFleetId ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                const newId = raw === '' ? null : Number(raw);
                const newName = newId == null ? null : (fleets.find(f => f.id === newId)?.name ?? c.courierFleetName ?? null);
                setDraft(d => d ? { ...d, courierFleetId: newId, courierFleetName: newName } : d);
              }}
            >
              <option value="">— Unassigned —</option>
              {fleets.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
              {/* Fallback: render the current selection even if not in the loaded
                  list (NP scope mismatch, archived fleet, fetch failure). Keeps
                  the dropdown showing the saved value instead of blanking it. */}
              {c.courierFleetId != null && !fleets.some(f => f.id === c.courierFleetId) && (
                <option value={c.courierFleetId}>{c.courierFleetName || 'Current Fleet'}</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0 border-b border-border mb-5 overflow-x-auto">
        {TAB_KEYS.map(t => (
          <div
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[13px] cursor-pointer whitespace-nowrap border-b-2 transition-all ${
              tab === t ? 'text-brand-cyan border-brand-cyan' : 'text-text-secondary border-transparent hover:text-text-primary'
            }`}
          >
            {TAB_LABELS[t]}
          </div>
        ))}
      </div>

      {/* ── Profile Tab — identity + dates ── */}
      {tab === 'profile' && (
        <div className="space-y-5">
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Identity</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="First Name" {...bind('firstName')} />
              <FormField label="Surname" {...bind('surName')} />
              <FormField label="Code" value={c.code} readonly />
              <FormField label="Gender" type="select" {...bind('gender')} options={['', 'Male', 'Female']} />
              <FormField label="Date of Birth" type="date" {...bind('dob')} />
              <FormField label="Start Date" type="date" {...bind('startDate')} />
              <FormField label="Finish Date" type="date" {...bind('finishDate')} />
            </div>
          </div>

          {/* Attached Subs — when this courier is a Master.  */}
          {c.type === 'Master' && (
            <div className="bg-white border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Attached Subcontractors</h3>
              {attachedSubs.length === 0 ? (
                <div className="bg-surface-cream border border-border rounded-lg px-4 py-6 text-sm text-text-secondary text-center">
                  No subcontractors attached to this master.
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {['Code', 'Name', 'Phone', 'Vehicle', 'Status'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-text-primary uppercase tracking-wide px-3 py-2.5 border-b border-border bg-slate-50">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attachedSubs.map(s => (
                        <tr
                          key={s.id}
                          onClick={() => navigate(`/courier/${s.id}`)}
                          className="hover:bg-surface-cream cursor-pointer border-t border-border"
                        >
                          <td className="px-3 py-2.5 text-sm font-mono whitespace-nowrap">{s.code}</td>
                          <td className="px-3 py-2.5 text-sm">{s.firstName} {s.surName}</td>
                          <td className="px-3 py-2.5 text-sm whitespace-nowrap">{s.phone || '—'}</td>
                          <td className="px-3 py-2.5 text-sm">{s.vehicle || '—'}</td>
                          <td className="px-3 py-2.5 text-sm">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              s.status === 'active'
                                ? 'bg-green-50 text-success border border-green-200'
                                : 'bg-red-50 text-error border border-red-200'
                            }`}>
                              {s.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 text-[11px] text-text-secondary bg-surface-cream border-t border-border">
                    {attachedSubs.length} sub{attachedSubs.length === 1 ? '' : 's'} attached · click any row to open
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Master Reference — when this courier is a Sub. */}
          {c.type === 'Sub' && masterName && (
            <div className="bg-white border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Master Courier</h3>
              <div
                onClick={() => navigate(`/courier/${masterName.id}`)}
                className="border border-border rounded-lg p-4 flex items-center gap-3 cursor-pointer hover:border-brand-cyan transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-brand-cyan flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {masterName.firstName[0]}{masterName.surName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{masterName.firstName} {masterName.surName}</div>
                  <div className="text-[12px] text-text-secondary">
                    {masterName.code} · Master Courier
                  </div>
                </div>
                <span className="text-brand-cyan text-sm">Open →</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Contact Tab — phones, email, address, NoK ── */}
      {tab === 'contact' && (
        <div className="space-y-5">
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Contact Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Personal Mobile" {...bind('phone')} />
              <FormField label="Company Mobile" {...bind('urgentMobile')} />
              <FormField label="Email" {...bind('email')} />
              <FormField label="Home Phone" {...bind('homePhone')} />
              <FormField label="Address" {...bind('address')} full />
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Emergency / Next of Kin</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Doctor" {...bind('doctor')} />
              <FormField label="Doctor Phone" {...bind('doctorPhone')} />
              <FormField label="Next of Kin" {...bind('nextOfKin')} />
              <FormField label="Relationship" {...bind('nokRelationship')} />
              <FormField label="Next of Kin Address" {...bind('nokAddress')} full />
              <FormField label="Next of Kin Phone" {...bind('nokPhone')} />
            </div>
          </div>
        </div>
      )}

      {/* ── Vehicle Tab ── */}
      {tab === 'vehicle' && (
        <div className="space-y-5">
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Vehicle Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Vehicle Type" {...bind('vehicle')} />
              {lookupSelect('Make', 'makeId', 'make', vehicleMakes)}
              <FormField label="Model" {...bind('model')} />
              <FormField label="Year" {...bindNum('year')} />
              <FormField label="License Plate" {...bind('rego')} />
            </div>
            <div className="mt-3">
              <FormField label="Low Emission Vehicle" type="checkbox" {...bindBool('lowEmission')} />
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Dimensions &amp; Weight</h3>
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Max Pallets" {...bindNum('maxPallets')} />
              <FormField label="Tare Weight (kg)" {...bindNum('tareWeight')} />
              <FormField label="Max Carrying Weight (kg)" {...bindNum('maxCarry')} />
              <FormField label="RUC Weight" {...bindNum('rucWeight')} />
              <FormField label="RUC Kms" {...bindNum('rucKms')} />
              <FormField label="RUC Payload" {...bindNum('rucPayload')} />
              <FormField label="Height (m)" {...bindNum('height')} />
              <FormField label="Width (m)" {...bindNum('width')} />
              <FormField label="Length (m)" {...bindNum('length')} />
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Compliance Dates</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Vehicle Inspection Expiry" type="date" {...bind('inspectionExpiry')} warning={isExpiringSoon(c.inspectionExpiry) ? 'Expiring soon!' : undefined} />
              <FormField label="Registration Expiry" type="date" {...bind('regoExpiry')} warning={isExpiringSoon(c.regoExpiry) ? 'Expiring soon!' : undefined} />
            </div>
          </div>
        </div>
      )}

      {/* ── Compliance & Licensing Tab ── */}
      {tab === 'compliance' && (
        <div className="space-y-5">
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Driver's License</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Driver's License No" {...bind('dlNo')} />
              <FormField label="Driver's License Expiry" type="date" {...bind('dlExpiry')} warning={isExpiringSoon(c.dlExpiry) ? 'Expiring soon!' : undefined} />
            </div>
            {isExpired(c.dlExpiry) && (
              <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-3 text-sm flex items-center gap-2.5 mt-3">
                ⚠️ Driver's license has EXPIRED. Courier must not operate until renewed.
              </div>
            )}
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Endorsements</h3>
            <div className="space-y-1">
              <FormField label="Dangerous Goods" type="checkbox" {...bindBool('dangerousGoods')} />
              {c.dangerousGoods && (
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <FormField label="DG Certificate Expiry" type="date" {...bind('dgExpiry')} warning={isExpiringSoon(c.dgExpiry) ? 'Expiring soon!' : undefined} />
                </div>
              )}
              <FormField label="Heavy Transport Endorsement" type="checkbox" {...bindBool('hte')} />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <FormField label="DOT Number" {...bind('tslNo')} />
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Insurance</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Policy Number" {...bind('policyNo')} />
              {lookupSelect('Insurance Company', 'insuranceCoId', 'insuranceCo', insuranceCompanies)}
              {lookupSelect('Carrier Liability Insurer', 'carrierLiabId', 'carrierLiabCompany', insuranceCompanies)}
              {lookupSelect('Public Liability Insurer', 'publicLiabId', 'publicLiabCompany', insuranceCompanies)}
            </div>
            <div className="mt-3">
              <FormField label="Commercial Insurance" type="checkbox" {...bindBool('commercialIns')} />
            </div>
          </div>
        </div>
      )}

      {/* ── Financial Tab ── */}
      {tab === 'financial' && (
        <div className="space-y-5">
          <div className="bg-sky-50 border border-sky-200 text-sky-700 rounded-lg px-4 py-3 text-sm">
            💡 These are your rates to this courier. Your customers cannot see them.
          </div>

          {/* Payment Channel — Kerran's tucCourier.PaymentMethod. Enum
              {Direct,Invoice,None}; the server validates. Whether an Invoice
              routes to Openforce / Xero is decided downstream by OpenForceNumber
              / XeroId / tenant OpenforceDefault, not here. Moved off the
              Relationship & Commercial header (NP-FLEET-WIRING §2.1). */}
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Payment Channel</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Payment Method"
                type="select"
                value={c.paymentMethod || 'Direct'}
                options={['Direct', 'Invoice', 'None']}
                onChange={(val) => setDraft(d => d ? { ...d, paymentMethod: val as string } : d)}
              />
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Tax &amp; Banking</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Tax ID (EIN)" {...bind('taxId')} />
              <FormField label="Federal Withholding %" {...bindNum('wht')} />
              <FormField label="Bank Account (Routing / Account)" {...bind('bankAcct')} full />
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              {c.type === 'Sub' ? 'Sub Pay Rates' : 'Pay Rates'}
            </h3>
            {c.type === 'Sub' ? (
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Sub Pay Percentage (%)" {...bindNum('subContractorPercentage')} />
                <FormField label="Sub Fuel Percentage (%)" {...bindNum('subContractorFuelPercentage')} />
                <FormField label="Sub Bonus Percentage (%)" {...bindNum('subContractorBonusPercentage')} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Pay Percentage (%)" {...bindNum('payPct')} />
                <FormField label="Bonus Percentage (%)" {...bindNum('bonusPct')} />
              </div>
            )}
            <div className="mt-3">
              <FormField label="Payroll Registration" type="checkbox" {...bindBool('paydayReg')} />
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Compliance Dates</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Contract Signed Date" type="date" {...bind('contractSigned')} />
              <FormField label="Security Check Date" type="date" {...bind('securityCheck')} />
            </div>
          </div>
        </div>
      )}

      {/* ── Device & Access Tab ── */}
      {tab === 'device' && (
        <div className="space-y-5">
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Communication Channel</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Channel" type="select" value={c.channel} options={['App', 'SMS', 'Radio']} />
              <FormField label="Device Type" value={c.deviceType} readonly />
            </div>
            <div className="mt-3">
              <FormField label="Device Admin" type="checkbox" {...bindBool('deviceAdmin')} />
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">SMS &amp; Network</h3>
            <div className="space-y-1">
              <FormField label="Carrier Network" type="checkbox" {...bindBool('vodafone')} />
              <FormField label="Send Job via SMS" type="checkbox" {...bindBool('smsJob')} />
              <FormField label="Send Alert SMS" type="checkbox" {...bindBool('smsAlert')} />
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Web &amp; Display</h3>
            <div className="space-y-1">
              <FormField label="Web Enabled" type="checkbox" {...bindBool('webEnabled')} />
              <FormField label="Auto Despatch" type="checkbox" {...bindBool('autoDispatch')} />
              <FormField label="Show Client Phone" type="checkbox" {...bindBool('showClientPhone')} />
              <FormField label="Mobile Advert Courier" type="checkbox" checked={c.mobileAdvert} />
              <FormField label="Display on Web" type="checkbox" {...bindBool('displayWeb')} />
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Mobile App Login</h3>
            {c.hasMobileLogin === false && (
              <div className="inline-block px-2 py-0.5 rounded text-[11px] border border-amber-300 bg-amber-50 text-amber-700 mb-2">● No login yet — this courier can't sign in to the mobile app</div>
            )}
            {c.hasMobileLogin === true && (
              <div className="inline-block px-2 py-0.5 rounded text-[11px] border border-green-200 bg-green-50 text-green-700 mb-2">● Login active — set a new password below to reset it</div>
            )}
            <p className="text-xs text-text-secondary mb-2">
              Set or reset the password the courier signs in to the mobile app with — their username is their <span className="font-medium">email</span>. If they don't have a login yet, this creates one. Separate from Save; applies immediately.
            </p>
            {!c.email?.trim() && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 text-xs mb-2">
                Add an email on the Profile tab first — it's the courier's sign-in username.
              </div>
            )}
            <div className="flex items-end gap-2 max-w-lg">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs text-text-secondary uppercase tracking-wide">New Password</label>
                <PasswordInput value={loginPassword} onChange={setLoginPassword} maxLength={100} placeholder="Password to give the courier" />
              </div>
              <button
                type="button"
                onClick={handleResetLogin}
                disabled={loginSaving || !loginPassword.trim() || !c.email?.trim()}
                className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loginSaving ? 'Setting…' : 'Set / Reset Password'}
              </button>
            </div>
            {loginError && (
              <div className="mt-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs max-w-lg">⚠️ {loginError}</div>
            )}
            {loginSuccess && (
              <div className="mt-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-xs max-w-lg">✅ Mobile app password set.</div>
            )}
            <div className="mt-4 pt-3 border-t border-border">
              <FormField label="POD Required" type="checkbox" {...bindBool('podRequired')} />
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Working Hours</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Expected Start Time" type="time" {...bind('startTime')} />
              <FormField label="Expected End Time" type="time" {...bind('endTime')} />
            </div>
          </div>
        </div>
      )}

      {/* ── Documents Tab ── */}
      {tab === 'documents' && (
        <div className="space-y-5">
          <CourierDocumentsTab courierId={c.id} />
        </div>
      )}

      {/* ── Notes & Audit Tab ── */}
      {tab === 'notes' && (
        <div className="space-y-5">
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Notes</h3>
            <FormField label="Notes" type="textarea" {...bind('notes')} full rows={5} />
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Training</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Training Hours (Initial)" value={String(c.trainingInit ?? '')} readonly />
              <FormField label="Training Hours (Follow-up)" value={String(c.trainingFollow ?? '')} readonly />
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Audit Trail</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Created" value={c.created} readonly />
              <FormField label="Created By" value={c.createdBy} readonly />
              <FormField label="Last Modified" value={c.modified} readonly />
              <FormField label="Last Modified By" value={c.modifiedBy} readonly />
            </div>
          </div>
        </div>
      )}

      {/* ── Feedback banners ── */}
      {saveError && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          ⚠️ {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="mt-4 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
          ✅ Changes saved.
        </div>
      )}

      {/* ── Footer buttons ── */}
      <div className="flex gap-2.5 mt-5">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          onClick={handleCancel}
          disabled={!dirty || saving}
          className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={() => navigate('/fleet')}
          className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all"
        >
          Back to Fleet
        </button>
      </div>
    </div>
  );
}

// ── Documents sub-tab — unchanged logic from the legacy page ──────────

function StatusBadgeDoc({ status }: { status: DocumentStatus }) {
  const map: Record<DocumentStatus, { icon: string; label: string; bg: string; color: string }> = {
    Current: { icon: '✅', label: 'Current', bg: 'bg-green-50', color: 'text-green-700' },
    ExpiringSoon: { icon: '⚠️', label: 'Expiring Soon', bg: 'bg-amber-50', color: 'text-amber-700' },
    Expired: { icon: '❌', label: 'Expired', bg: 'bg-red-50', color: 'text-red-700' },
    Superseded: { icon: '📁', label: 'Superseded', bg: 'bg-gray-50', color: 'text-gray-500' },
  };
  const s = map[status] || map.Current;
  return <span className={`text-xs px-2.5 py-0.5 rounded-lg border ${s.bg} ${s.color}`}>{s.icon} {s.label}</span>;
}

function CourierDocumentsTab({ courierId }: { courierId: number }) {
  const { types } = useDocumentTypes();
  const { documents, upload, deleteDoc, getDownloadUrl, refresh } = useCourierDocuments(courierId);
  const summary = useComplianceSummary(types, documents);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTypeId, setUploadTypeId] = useState<number | undefined>();
  const [previewDoc, setPreviewDoc] = useState<CourierDocument | null>(null);

  const activeTypes = types.filter(dt => dt.active && (dt.appliesTo === 'ActiveCourier' || dt.appliesTo === 'Both'));

  const handleDownload = async (docId: number) => {
    const url = await getDownloadUrl(docId);
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="bg-white border border-border rounded-lg p-5">
      {/* Compliance summary bar */}
      <div className="bg-surface-light border border-border rounded-lg px-4 py-3 mb-4 flex items-center gap-3 text-sm">
        <span className="font-medium text-brand-dark">Compliance:</span>
        <span className="text-green-600">{summary.current} current</span>
        <span className="text-text-secondary">·</span>
        {summary.expiring > 0 && <><span className="text-amber-600">{summary.expiring} expiring</span><span className="text-text-secondary">·</span></>}
        {summary.expired > 0 && <><span className="text-red-600">{summary.expired} expired</span><span className="text-text-secondary">·</span></>}
        {summary.missing > 0 && <span className="text-red-500">{summary.missing} missing</span>}
        {summary.missing === 0 && summary.expired === 0 && summary.expiring === 0 && (
          <span className="text-green-600">All documents current ✅</span>
        )}
        <span className="ml-auto text-text-secondary">{summary.current + summary.expiring}/{summary.total} mandatory</span>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Documents</h3>
        <button
          onClick={() => { setUploadTypeId(undefined); setShowUpload(true); }}
          className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow"
        >
          Upload Document
        </button>
      </div>

      {/* Document type rows */}
      {activeTypes.map((dt) => {
        const doc = documents.find(d => d.documentTypeId === dt.id && d.status !== 'Superseded');
        return (
          <div key={dt.id} className="flex items-center gap-3 py-3 border-b border-border last:border-b-0">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-brand-dark flex items-center gap-2">
                {dt.name}
                {dt.mandatory && <span className="text-[10px] px-1.5 py-0 rounded bg-red-50 text-red-600 border border-red-200 uppercase">Required</span>}
              </div>
              {doc ? (
                <div className="text-xs text-text-secondary mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>{doc.fileName}</span>
                  <span>· Uploaded {new Date(doc.uploadedDate).toLocaleDateString()}</span>
                  {doc.expiryDate && <span>· Expires {new Date(doc.expiryDate).toLocaleDateString()}</span>}
                  {doc.aiSuggestedDecision && (
                    <span className={doc.aiSuggestedDecision === 'accept' ? 'text-green-600' : doc.aiSuggestedDecision === 'reject' ? 'text-red-500' : 'text-amber-600'}>
                      AI: {doc.aiSuggestedDecision === 'accept' ? 'Accept' : doc.aiSuggestedDecision === 'reject' ? 'Reject' : 'Needs review'}
                    </span>
                  )}
                  {doc.verifyStatus === 'Verified' && <span className="text-green-600">✓ Verified</span>}
                  {doc.verifyStatus === 'Pending' && <span className="text-amber-600">⏳ Pending review</span>}
                </div>
              ) : (
                <div className="text-xs text-red-400 mt-0.5">
                  {dt.mandatory ? '⚠ Not uploaded — required' : 'Not uploaded'}
                </div>
              )}
            </div>

            {doc ? (
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadgeDoc status={doc.status} />
                <button onClick={() => setPreviewDoc(doc)} className="text-xs text-brand-cyan hover:underline">Review</button>
                <button onClick={() => handleDownload(doc.id)} className="text-xs text-brand-cyan hover:underline">Download</button>
                <button onClick={() => { if (confirm('Delete this document?')) deleteDoc(doc.id); }} className="text-xs text-red-500 hover:underline">Delete</button>
              </div>
            ) : (
              <button
                onClick={() => { setUploadTypeId(dt.id); setShowUpload(true); }}
                className="text-xs bg-brand-cyan text-brand-dark px-3 py-1.5 rounded-md font-medium hover:shadow-cyan-glow shrink-0"
              >
                Upload
              </button>
            )}
          </div>
        );
      })}

      {showUpload && (
        <DocumentUpload
          documentTypes={activeTypes}
          selectedTypeId={uploadTypeId}
          onUpload={upload}
          onClose={() => setShowUpload(false)}
        />
      )}

      <CourierDocumentPreviewModal
        isOpen={previewDoc !== null}
        courierId={courierId}
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onChanged={refresh}
      />
    </div>
  );
}
