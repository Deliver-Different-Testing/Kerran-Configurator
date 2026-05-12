import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fleetService, Fleet, FleetCourier, Depot } from '@/services/np_fleetService';

// ─── Icons ───────────────────────────────────────────────────────────────────

const CheckIcon = () => (
  <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
);
const XIcon = () => (
  <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

function FlagIcon({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span title={label} className="inline-flex items-center">
      {enabled ? <CheckIcon /> : <XIcon />}
    </span>
  );
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
      <span className="text-sm text-text-secondary">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-brand-cyan' : 'bg-gray-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </label>
  );
}

// ─── Fleet List ──────────────────────────────────────────────────────────────

function FleetList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [sortField, setSortField] = useState<'name'>('name');
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  useEffect(() => {
    setFleets(fleetService.search(search));
  }, [search]);

  const sorted = [...fleets].sort((a, b) => {
    const av = a[sortField].toLowerCase();
    const bv = b[sortField].toLowerCase();
    return av < bv ? -sortDir : av > bv ? sortDir : 0;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Fleet Management</h1>
          <p className="text-sm text-text-secondary mt-1">Manage courier fleets, locations, and settings</p>
        </div>
        <button
          onClick={() => navigate('/fleet-management/new')}
          className="px-4 py-2 bg-brand-cyan text-white rounded-lg text-sm font-medium hover:bg-brand-cyan/90 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New Fleet
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input
          type="text"
          placeholder="Search fleets by name, code, or notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/30 focus:border-brand-cyan"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-light border-b border-border">
              <th
                className="text-left px-4 py-3 font-medium text-text-secondary cursor-pointer hover:text-text-primary select-none"
                onClick={() => { setSortDir(sortDir === 1 ? -1 : 1); setSortField('name'); }}
              >
                Name {sortField === 'name' && (sortDir === 1 ? '↑' : '↓')}
              </th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Location</th>
              <th className="text-center px-4 py-3 font-medium text-text-secondary">Couriers</th>
              <th className="text-center px-4 py-3 font-medium text-text-secondary" title="Portal Access">Portal</th>
              <th className="text-center px-4 py-3 font-medium text-text-secondary" title="Invoicing">Invoice</th>
              <th className="text-center px-4 py-3 font-medium text-text-secondary" title="Schedules">Sched.</th>
              <th className="text-center px-4 py-3 font-medium text-text-secondary" title="Despatch Clearlists">Desp.</th>
              <th className="text-center px-4 py-3 font-medium text-text-secondary" title="Device Clearlists">Device</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((fleet) => {
              const couriers = fleetService.getCouriers(fleet.id);
              return (
                <tr
                  key={fleet.id}
                  onClick={() => navigate(`/fleet-management/${fleet.id}`)}
                  className="border-b border-border last:border-0 hover:bg-brand-cyan/5 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-text-primary">{fleet.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{fleetService.getDepotName(fleet.depotId)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-full bg-brand-cyan/10 text-brand-cyan text-xs font-medium">
                      {couriers.length}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center"><FlagIcon enabled={fleet.allowCourierPortalAccess} label="Portal Access" /></td>
                  <td className="px-4 py-3 text-center"><FlagIcon enabled={fleet.allowInvoicing} label="Invoicing" /></td>
                  <td className="px-4 py-3 text-center"><FlagIcon enabled={fleet.allowSchedules} label="Schedules" /></td>
                  <td className="px-4 py-3 text-center"><FlagIcon enabled={fleet.displayOnClearlistsDespatch} label="Despatch Clearlists" /></td>
                  <td className="px-4 py-3 text-center"><FlagIcon enabled={fleet.displayOnClearlistsDevice} label="Device Clearlists" /></td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-text-muted">No fleets found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Fleet Detail ────────────────────────────────────────────────────────────

function FleetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [backup, setBackup] = useState<Fleet | null>(null);
  const [editing, setEditing] = useState(isNew);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [couriers, setCouriers] = useState<FleetCourier[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDepots(fleetService.getDepots());
    if (isNew) {
      const blank: Fleet = {
        id: 0,
        name: '',
        depotId: null,
        directCostAccountCode: '',
        notes: '',
        displayOnClearlistsDespatch: false,
        displayOnClearlistsDevice: false,
        allowCourierPortalAccess: false,
        allowInvoicing: false,
        allowSchedules: false,
        created: '',
        createdBy: '',
        lastModified: '',
        lastModifiedBy: '',
      };
      setFleet(blank);
      setBackup(blank);
    } else {
      const f = fleetService.getById(Number(id));
      if (f) {
        setFleet({ ...f });
        setBackup({ ...f });
        setCouriers(fleetService.getCouriers(f.id));
      }
    }
  }, [id, isNew]);

  if (!fleet) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">Fleet not found</p>
        <button onClick={() => navigate('/fleet-management')} className="mt-4 text-brand-cyan hover:underline text-sm">← Back to Fleet Management</button>
      </div>
    );
  }

  const update = (patch: Partial<Fleet>) => setFleet((prev) => prev ? { ...prev, ...patch } : prev);

  const handleSave = () => {
    if (!fleet.name.trim()) return;
    if (isNew) {
      const created = fleetService.create(fleet);
      navigate(`/fleet-management/${created.id}`, { replace: true });
    } else {
      fleetService.update(fleet.id, fleet);
      setBackup({ ...fleet });
      setEditing(false);
    }
  };

  const handleCancel = () => {
    if (isNew) {
      navigate('/fleet-management');
    } else {
      setFleet(backup ? { ...backup } : fleet);
      setEditing(false);
    }
  };

  const handleDelete = () => {
    fleetService.delete(fleet.id);
    navigate('/fleet-management');
  };

  const disabled = !editing;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/fleet-management')} className="text-text-muted hover:text-text-primary transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{isNew ? 'New Courier Fleet' : fleet.name}</h1>
            {!isNew && <p className="text-xs text-text-muted mt-0.5">ID: {fleet.id} · Created {new Date(fleet.created).toLocaleDateString()}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={handleCancel} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-light transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-brand-cyan text-white rounded-lg text-sm font-medium hover:bg-brand-cyan/90 transition-colors">Save</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="px-4 py-2 bg-brand-cyan text-white rounded-lg text-sm font-medium hover:bg-brand-cyan/90 transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                Edit
              </button>
              <button onClick={() => setConfirmDelete(true)} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors">Delete</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-border p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4">General Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Fleet Name</label>
                <input
                  type="text"
                  maxLength={50}
                  value={fleet.name}
                  onChange={(e) => update({ name: e.target.value })}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white disabled:bg-surface-light disabled:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-cyan/30 focus:border-brand-cyan"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Location</label>
                <select
                  value={fleet.depotId ?? ''}
                  onChange={(e) => update({ depotId: e.target.value ? Number(e.target.value) : null })}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white disabled:bg-surface-light disabled:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-cyan/30 focus:border-brand-cyan"
                >
                  <option value="">— None Selected —</option>
                  {depots.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Direct Cost Account Code</label>
                <input
                  type="text"
                  maxLength={50}
                  value={fleet.directCostAccountCode}
                  onChange={(e) => update({ directCostAccountCode: e.target.value })}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white disabled:bg-surface-light disabled:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-cyan/30 focus:border-brand-cyan"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
                <textarea
                  rows={5}
                  value={fleet.notes}
                  onChange={(e) => update({ notes: e.target.value })}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white disabled:bg-surface-light disabled:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-cyan/30 focus:border-brand-cyan resize-none"
                />
              </div>
            </div>
          </div>

          {/* Couriers in Fleet */}
          {!isNew && (
            <div className="bg-white rounded-lg border border-border p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4">
                Couriers in Fleet
                <span className="ml-2 text-xs font-normal text-text-muted">({couriers.length})</span>
              </h2>
              {couriers.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left pb-2 font-medium text-text-secondary">Name</th>
                      <th className="text-left pb-2 font-medium text-text-secondary">Phone</th>
                      <th className="text-left pb-2 font-medium text-text-secondary">Vehicle</th>
                      <th className="text-left pb-2 font-medium text-text-secondary">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {couriers.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 text-text-primary font-medium">{c.name}</td>
                        <td className="py-2.5 text-text-secondary">{c.phone}</td>
                        <td className="py-2.5 text-text-secondary">{c.vehicle}</td>
                        <td className="py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-text-muted py-4 text-center">No couriers assigned to this fleet</p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar — toggles */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-border p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4">Fleet Settings</h2>
            <div className="space-y-4">
              <Toggle label="Courier Portal Access" checked={fleet.allowCourierPortalAccess} onChange={(v) => update({ allowCourierPortalAccess: v })} disabled={disabled} />
              <Toggle label="Allow Invoicing" checked={fleet.allowInvoicing} onChange={(v) => update({ allowInvoicing: v })} disabled={disabled} />
              <Toggle label="Allow Schedules" checked={fleet.allowSchedules} onChange={(v) => update({ allowSchedules: v })} disabled={disabled} />
              <hr className="border-border" />
              <Toggle label="Display on Clearlists (Despatch)" checked={fleet.displayOnClearlistsDespatch} onChange={(v) => update({ displayOnClearlistsDespatch: v })} disabled={disabled} />
              <Toggle label="Display on Clearlists (Device)" checked={fleet.displayOnClearlistsDevice} onChange={(v) => update({ displayOnClearlistsDevice: v })} disabled={disabled} />
            </div>
          </div>

          {/* Audit info */}
          {!isNew && (
            <div className="bg-white rounded-lg border border-border p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4">Audit Trail</h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-text-muted">Created</dt>
                  <dd className="text-text-secondary">{new Date(fleet.created).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Created By</dt>
                  <dd className="text-text-secondary">{fleet.createdBy}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Last Modified</dt>
                  <dd className="text-text-secondary">{new Date(fleet.lastModified).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Last Modified By</dt>
                  <dd className="text-text-secondary">{fleet.lastModifiedBy}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(false); }}>
          <div className="bg-white rounded-lg shadow-lg border border-border w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-text-primary mb-2">Delete Fleet</h2>
            <p className="text-sm text-text-secondary mb-5">Permanently delete <strong>{fleet.name}</strong>? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-light transition-colors">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function FleetManagement() {
  const { id } = useParams<{ id: string }>();
  return id ? <FleetDetail /> : <FleetList />;
}
