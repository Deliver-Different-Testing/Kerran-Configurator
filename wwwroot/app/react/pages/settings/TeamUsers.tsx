// DF-Admin multi-lane Team & Users (Unified Permissions §8.1). Lists contacts
// across lanes (Tenant Staff / Network Partners / DF Admin; never Customers)
// with the same 3-tab Contact modal. Backed by /api/admin/contacts.
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  contactsApi,
  type AdminContactRow, type AdminContactDetail, type AdminRoleOption,
  type AdminRelType, type AdminClientOption, type AdminResolvedTile,
  type AdminContactAudit, type AdminContactSave, type ResolvedDataScope,
} from '@/services/api';
import { ACCESS_LABEL, clampAccess, type AccessLevel } from '@/data/accessLevels';

type Lane = 'all' | 'tenant' | 'np' | 'dfadmin';
const LANES: { key: Lane; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tenant', label: 'Tenant Staff' },
  { key: 'np', label: 'Network Partners' },
  { key: 'dfadmin', label: 'DF Admin' },
];

const PILL: Record<AccessLevel, string> = {
  0: 'bg-transparent text-text-muted border border-gray-300',
  1: 'bg-[#3bc7f4] text-white',
  2: 'bg-emerald-500 text-white',
  3: 'bg-purple-500 text-white',
};

export default function TeamUsersPage() {
  const [lane, setLane] = useState<Lane>('all');
  const [rows, setRows] = useState<AdminContactRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await contactsApi.list(lane)); }
    catch (e: any) { setError(e?.message ?? 'Failed to load contacts'); }
    finally { setLoading(false); }
  }, [lane]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Team &amp; Users</h2>
          <p className="text-sm text-text-secondary mt-1">Contacts across Tenant Staff, Network Partners, and DF Admin. Customers are managed separately.</p>
        </div>
        <button onClick={() => setEditing('new')} className="px-4 py-2 rounded-lg bg-[#3bc7f4] text-white text-sm font-medium hover:bg-[#2bb5e2]">+ Add Contact</button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {LANES.map(l => (
          <button key={l.key} onClick={() => setLane(l.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${lane === l.key ? 'bg-[#3bc7f4] text-white' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'}`}>
            {l.label}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          className="ml-auto px-3 py-1.5 rounded-lg border border-border text-sm w-56 focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/40" />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-300 bg-red-50 text-sm text-red-800 flex items-start justify-between gap-3">
          <span>{error}</span><button onClick={() => setError(null)} className="text-red-600 font-bold">×</button>
        </div>
      )}
      {toast && (
        <div className="mb-4 p-3 rounded-lg border border-green-200 bg-green-50 text-sm text-green-800 flex items-start justify-between gap-3">
          <span>{toast}</span><button onClick={() => setToast(null)} className="text-green-700 font-bold">×</button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              {['Name', 'Client / NP', 'Email', 'Role(s)', 'Status', 'Last Login', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium text-text-primary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="px-4 py-6 text-center text-text-muted">Loading…</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7} className="px-4 py-6 text-center text-text-muted">No contacts.</td></tr>
              : filtered.map(r => (
                <tr
                  key={r.id}
                  onClick={() => setEditing(Number(r.id))}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(Number(r.id)); } }}
                  role="button"
                  tabIndex={0}
                  className="border-b border-border cursor-pointer hover:bg-surface-cream focus:bg-surface-cream focus:outline-none"
                >
                  <td className="px-4 py-3 font-semibold text-text-primary">{r.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{r.clientName || '—'}</td>
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.roles.length === 0 ? <span className="text-text-muted text-xs">No role</span>
                        : r.roles.map(x => <span key={x.id} className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-text-secondary">{x.name}</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-text-secondary">{r.lastLogin}</td>
                  <td className="px-4 py-3 text-right"><button onClick={(e) => { e.stopPropagation(); setEditing(Number(r.id)); }} className="text-[#3bc7f4] hover:underline text-sm font-medium">Edit</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <ContactModal contactId={editing} lane={lane} onClose={(msg) => { setEditing(null); if (msg) setToast(msg); load(); }} />
      )}
    </div>
  );
}

// ---- 3-tab modal ----------------------------------------------------------

type Tab = 'profile' | 'permissions' | 'history' | 'dataScope';

function ContactModal({ contactId, lane, onClose }: { contactId: number | 'new'; lane: Lane; onClose: (toast?: string) => void }) {
  const isNew = contactId === 'new';
  const [tab, setTab] = useState<Tab>('profile');
  const [d, setD] = useState<AdminContactSave & { clientTypeId: number; clientName: string }>({
    clientId: null, firstName: '', lastName: '', email: '', jobTitle: '', mobile: '', directDial: '',
    notes: '', relationshipTypeId: null, roleIds: [], status: 'active', clientTypeId: 0, clientName: '',
  });
  const [clients, setClients] = useState<AdminClientOption[]>([]);
  const [roles, setRoles] = useState<AdminRoleOption[]>([]);
  const [relTypes, setRelTypes] = useState<AdminRelType[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial load: relationship types + clients (for Add picker) + detail (Edit).
  useEffect(() => {
    (async () => {
      try {
        const [rt, cls] = await Promise.all([contactsApi.relationshipTypes(), contactsApi.clients('all')]);
        setRelTypes(rt); setClients(cls);
        if (!isNew) {
          const detail: AdminContactDetail = await contactsApi.get(contactId);
          setD({
            clientId: detail.clientId, firstName: detail.firstName, lastName: detail.lastName, email: detail.email,
            jobTitle: detail.jobTitle, mobile: detail.mobile, directDial: detail.directDial, notes: detail.notes,
            relationshipTypeId: detail.relationshipTypeId, roleIds: detail.roleIds, status: detail.status,
            clientTypeId: detail.clientTypeId, clientName: detail.clientName,
          });
        }
      } catch (e: any) { setError(e?.message ?? 'Failed to load'); }
      finally { setLoading(false); }
    })();
  }, [contactId, isNew]);

  // Fetch assignable roles whenever the contact's ClientType is known/changes.
  useEffect(() => {
    if (d.clientTypeId > 0) contactsApi.roles(d.clientTypeId).then(setRoles).catch(() => setRoles([]));
    else setRoles([]);
  }, [d.clientTypeId]);

  const set = (patch: Partial<typeof d>) => setD(s => ({ ...s, ...patch }));
  const pickClient = (id: number) => {
    const c = clients.find(x => x.id === id);
    set({ clientId: id, clientTypeId: c?.clientTypeId ?? 0, clientName: c?.name ?? '', roleIds: [] });
  };
  const toggleRole = (id: number) => setD(s => ({ ...s, roleIds: s.roleIds.includes(id) ? s.roleIds.filter(x => x !== id) : [...s.roleIds, id] }));

  const canSave = !!(d.firstName.trim() || d.lastName.trim()) && !!d.email.trim() && (!isNew || d.clientId != null) && !saving;

  const save = async () => {
    setSaving(true); setError(null);
    const body: AdminContactSave = {
      clientId: d.clientId, firstName: d.firstName, lastName: d.lastName, email: d.email,
      jobTitle: d.jobTitle, mobile: d.mobile, directDial: d.directDial, notes: d.notes,
      relationshipTypeId: d.relationshipTypeId, roleIds: d.roleIds, status: d.status,
    };
    try {
      if (isNew) { const created = await contactsApi.create(body); onClose(created?.inviteNotice ?? 'Contact added.'); }
      else { await contactsApi.update(contactId, body); onClose('Changes saved.'); }
    } catch (e: any) {
      const code = e?.response?.data?.error ?? e?.message;
      setError(code === 'CLIENT_TYPE_FORBIDDEN' ? 'You don’t have permission to manage a contact at this ClientType.' : (e?.response?.data?.error ?? code ?? 'Failed to save'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-bold text-text-primary">{isNew ? 'Add Contact' : 'Edit Contact'}</h3>
          <button onClick={() => onClose()} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
        </div>
        <div className="flex gap-1 px-6 pt-3 border-b border-border">
          {([['profile', 'Profile'], ['permissions', 'Permissions'], ['history', 'History'], ['dataScope', 'Data Scope']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-[#3bc7f4] text-[#3bc7f4]' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>{label}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">⚠️ {error}</div>}
          {loading ? <p className="text-sm text-text-muted">Loading…</p>
            : tab === 'profile' ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Client / NP {isNew && <span className="text-red-500">*</span>}</label>
                  {isNew ? (
                    <select value={d.clientId ?? ''} onChange={e => e.target.value && pickClient(Number(e.target.value))}
                      className="px-3 py-2 rounded-lg border border-border text-sm">
                      <option value="">— Select a client —</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : <input value={d.clientName || '—'} readOnly className="px-3 py-2 rounded-lg border border-border text-sm opacity-80" />}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {([['First Name', 'firstName'], ['Last Name', 'lastName'], ['Email (Username)', 'email'], ['Job Title', 'jobTitle'], ['Mobile', 'mobile'], ['Direct Dial', 'directDial']] as [string, keyof typeof d][]).map(([label, key]) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-xs text-text-secondary uppercase tracking-wide">{label}</label>
                      <input value={String(d[key] ?? '')} onChange={e => set({ [key]: e.target.value } as any)} className="px-3 py-2 rounded-lg border border-border text-sm" />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Relationship Type</label>
                  <select value={d.relationshipTypeId ?? ''} onChange={e => set({ relationshipTypeId: e.target.value ? Number(e.target.value) : null })} className="px-3 py-2 rounded-lg border border-border text-sm">
                    <option value="">— None —</option>
                    {relTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Role(s)</label>
                  <div className="flex flex-wrap gap-2">
                    {d.clientTypeId === 0 ? <span className="text-text-muted text-xs">Select a client first.</span>
                      : roles.length === 0 ? <span className="text-text-muted text-xs">No assignable roles for this client type.</span>
                      : roles.map(r => {
                        const on = d.roleIds.includes(r.id);
                        return <button key={r.id} type="button" onClick={() => toggleRole(r.id)} title={r.description}
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${on ? 'bg-[#3bc7f4] text-white border-[#3bc7f4]' : 'bg-white text-text-secondary border-border hover:border-[#3bc7f4]'}`}>{on ? '✓ ' : ''}{r.name}</button>;
                      })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-secondary uppercase tracking-wide">Status</label>
                    <select value={d.status} onChange={e => set({ status: e.target.value as 'active' | 'inactive' })} className="px-3 py-2 rounded-lg border border-border text-sm">
                      <option value="active">Active</option><option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-text-secondary uppercase tracking-wide">Notes</label>
                  <textarea rows={2} value={d.notes} onChange={e => set({ notes: e.target.value })} className="px-3 py-2 rounded-lg border border-border text-sm" />
                </div>
              </div>
            ) : tab === 'permissions' ? <PermissionsTab contactId={contactId} />
              : tab === 'history' ? <HistoryTab contactId={contactId} />
              : <DataScopeTab contactId={contactId} />}
        </div>
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border">
          <button onClick={() => onClose()} disabled={saving} className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={!canSave} className="px-4 py-2 rounded-lg bg-[#3bc7f4] text-white text-sm font-medium hover:bg-[#2bb5e2] disabled:opacity-50">
            {saving ? 'Saving…' : isNew ? 'Add Contact' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PermissionsTab({ contactId }: { contactId: number | 'new' }) {
  const [tiles, setTiles] = useState<AdminResolvedTile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (contactId !== 'new') contactsApi.permissions(contactId).then(setTiles).catch((e: any) => setError(e?.message ?? 'Failed')); }, [contactId]);
  if (contactId === 'new') return <p className="text-sm text-text-muted">Save the contact first to see resolved permissions.</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!tiles) return <p className="text-sm text-text-muted">Loading…</p>;
  const pill = (lvl: number) => { const l = clampAccess(lvl); return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PILL[l]}`}>{ACCESS_LABEL[l]}</span>; };
  return (
    <div>
      <p className="text-sm text-text-secondary mb-3">Resolved permissions — the union of this contact's roles after cascade. Read-only.</p>
      <div className="space-y-3">
        {tiles.map(t => (
          <div key={t.key} className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-gray-100 px-3 py-2"><span className="text-xs font-semibold uppercase tracking-wide text-text-primary">{t.displayName}</span>{pill(t.level)}</div>
            {t.items.map(i => <div key={i.key} className="flex items-center justify-between px-3 py-2 border-t border-border"><span className="text-sm text-text-primary pl-3">{i.displayName}</span>{pill(i.level)}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

// RESOLVED-DATA-SCOPE §6/§10 — DF-admin-only inspector. A faithful view of the
// real ScopeDecider: summary, structured fields, decision trace, raw JSON.
// Fields the resolver doesn't compute render as "not modelled" rather than
// fabricated values.
const SCOPE_BADGE: Record<string, string> = {
  Platform: 'bg-purple-100 text-purple-700',
  Tenant: 'bg-blue-100 text-blue-700',
  Np: 'bg-amber-100 text-amber-700',
  None: 'bg-gray-200 text-gray-600',
  Customer: 'bg-gray-100 text-gray-500',
  Courier: 'bg-gray-100 text-gray-500',
};

function DataScopeTab({ contactId }: { contactId: number | 'new' }) {
  const [scope, setScope] = useState<ResolvedDataScope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    if (contactId === 'new') { setLoading(false); return; }
    setLoading(true); setError(null);
    contactsApi.dataScope(contactId)
      .then(s => setScope(s))
      .catch((e: any) => setError(e?.message ?? 'Failed to resolve scope'))
      .finally(() => setLoading(false));
  }, [contactId]);
  useEffect(() => { load(); }, [load]);

  if (contactId === 'new') return <p className="text-sm text-text-muted">Save the contact first to inspect its resolved data scope.</p>;
  if (loading) return <p className="text-sm text-text-muted">Resolving…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!scope) return <p className="text-sm text-text-muted py-6 text-center">No resolved scope — deny by default.</p>;

  const copy = (label: string, text: string) => { navigator.clipboard?.writeText(text); setCopied(label); setTimeout(() => setCopied(null), 1500); };
  const idLabel = (name: string | null, id: number | null) => name ? `${name} (${id})` : (id != null ? String(id) : null);

  const fields: [string, string | number | boolean | null][] = [
    ['Resolved ClientType', `${scope.resolvedClientTypeName} (${scope.resolvedClientTypeId})`],
    ['Scope Kind', scope.scopeKind],
    ['Home Client', idLabel(scope.homeClientName, scope.homeClientId)],
    ['Tenant Client', idLabel(scope.tenantClientName, scope.tenantClientId)],
    ['NP Agent', idLabel(scope.npAgentName, scope.npAgentId)],
    ['Customer Client', scope.customerClientId],
    ['Courier', scope.courierId],
    ['Can see DF Admin', scope.canSeeDfAdmin],
    ['Can cross tenant', scope.canCrossTenant],
    ['Child clients only', scope.canSeeChildClientsOnly],
    ['Inherited from parent', scope.isInheritedFromParentClient],
    ['Resolution source', scope.resolutionSource],
  ];
  const renderVal = (v: string | number | boolean | null) => {
    if (v === null || v === undefined || v === '') return <span className="text-text-muted italic">not modelled</span>;
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  };

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-lg border border-border bg-gray-50 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SCOPE_BADGE[scope.scopeKind] ?? 'bg-gray-100 text-gray-600'}`}>{scope.scopeKind}</span>
          <span className="text-xs text-text-muted">resolved data scope</span>
        </div>
        <p className="text-sm font-semibold text-text-primary">{scope.summary}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => copy('summary', scope.summary)} className="px-2.5 py-1 rounded-md border border-border text-xs text-text-secondary hover:bg-white">{copied === 'summary' ? '✓ Copied' : 'Copy summary'}</button>
          <button onClick={() => copy('json', JSON.stringify(scope, null, 2))} className="px-2.5 py-1 rounded-md border border-border text-xs text-text-secondary hover:bg-white">{copied === 'json' ? '✓ Copied' : 'Copy JSON'}</button>
          <button onClick={load} className="px-2.5 py-1 rounded-md border border-border text-xs text-text-secondary hover:bg-white">Refresh resolution</button>
        </div>
      </div>

      {/* Structured fields grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {fields.map(([label, v]) => (
          <div key={label} className="flex flex-col">
            <span className="text-[11px] text-text-secondary uppercase tracking-wide">{label}</span>
            <span className="text-sm text-text-primary">{renderVal(v)}</span>
          </div>
        ))}
      </div>

      {/* Decision trace */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-text-primary mb-2">Decision trace</h4>
        <ol className="space-y-1.5">
          {scope.rules.map((r, i) => (
            <li key={i} className="text-[13px] text-text-secondary flex gap-2"><span className="text-text-muted">{i + 1}.</span><span>{r}</span></li>
          ))}
        </ol>
      </div>

      {/* Honesty note — what the current resolver does NOT compute */}
      {scope.notModelled.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-800 mb-1">Not modelled by the current resolver</p>
          <p className="text-[13px] text-amber-700">These fields are shown for spec completeness but the production filters do not compute them yet: {scope.notModelled.join('; ')}.</p>
        </div>
      )}

      {/* Raw JSON expander */}
      <div>
        <button onClick={() => setShowJson(v => !v)} className="text-xs text-[#3bc7f4] hover:underline">{showJson ? '▾ Hide raw JSON' : '▸ Show raw JSON'}</button>
        {showJson && <pre className="mt-2 p-3 rounded-lg bg-gray-900 text-gray-100 text-[12px] overflow-x-auto">{JSON.stringify(scope, null, 2)}</pre>}
      </div>
    </div>
  );
}

function HistoryTab({ contactId }: { contactId: number | 'new' }) {
  const [rows, setRows] = useState<AdminContactAudit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (contactId !== 'new') contactsApi.history(contactId).then(setRows).catch((e: any) => setError(e?.message ?? 'Failed')); }, [contactId]);
  if (contactId === 'new') return <p className="text-sm text-text-muted">History appears after the contact is created.</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!rows) return <p className="text-sm text-text-muted">Loading…</p>;
  if (rows.length === 0) return <p className="text-sm text-text-muted py-6 text-center">No changes recorded yet.</p>;
  const fmt = (iso: string) => { const dt = new Date(iso); return isNaN(dt.getTime()) ? iso : dt.toLocaleString(); };
  return (
    <table className="w-full text-sm border-collapse">
      <thead><tr>{['When', 'Field', 'Old', 'New', 'Changed by'].map(h => <th key={h} className="text-left text-xs text-text-secondary uppercase tracking-wide px-3 py-2 border-b border-border">{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="hover:bg-gray-50">
            <td className="px-3 py-2 border-b border-border text-[13px] text-text-secondary whitespace-nowrap">{fmt(r.changedAt)}</td>
            <td className="px-3 py-2 border-b border-border font-medium">{r.field}</td>
            <td className="px-3 py-2 border-b border-border text-text-secondary">{r.oldValue || '—'}</td>
            <td className="px-3 py-2 border-b border-border">{r.newValue || '—'}</td>
            <td className="px-3 py-2 border-b border-border text-text-secondary">{r.changedBy}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
