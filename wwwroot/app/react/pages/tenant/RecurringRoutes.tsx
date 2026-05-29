import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  routeService,
  TenantRoute,
  RosterEntry,
  CourierLookup,
  ZipcodeLookup,
  RouteUpsert,
  AssignableTargets,
  AssignTargetType,
} from '@/services/tenant_routeService';
import { AssignTargetPicker, AssignTargetValue } from '@/components/common/AssignTargetPicker';

type Tab = 'routes' | 'roster';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function RecurringRoutes() {
  const { user } = useAuth();
  const recurringJobsUrl = user.despatchWebBaseUrl
    ? `${user.despatchWebBaseUrl}/#!/recurringJobs`
    : null;
  const [activeTab, setActiveTab] = useState<Tab>('routes');
  const [routes, setRoutes] = useState<TenantRoute[]>([]);
  const [couriers, setCouriers] = useState<CourierLookup[]>([]);
  const [targets, setTargets] = useState<AssignableTargets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, c, t] = await Promise.all([
        routeService.listRoutes(),
        routeService.listCouriers(),
        routeService.getAssignableTargets(),
      ]);
      setRoutes(r);
      setCouriers(c);
      setTargets(t);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to load routes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-[#0d0c2c] leading-tight">Recurring Routes</h1>
        <p className="text-text-secondary text-sm mt-1">
          Named routes covering a cluster of zip codes, rostered to a courier per day.
          The roster feeds nightly prebook job creation and surfaces in RunViewer.
        </p>
      </div>

      <div className="flex gap-1 rounded-2xl border border-border bg-white p-1 shadow-sm w-fit">
        {(['routes', 'roster'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
              activeTab === t
                ? 'bg-[#0d0c2c] text-white shadow-sm'
                : 'text-text-secondary hover:bg-slate-50'
            }`}
          >
            {t === 'routes' ? 'Routes' : 'Route Roster'}
          </button>
        ))}
        {recurringJobsUrl && (
          <button
            onClick={() => window.open(recurringJobsUrl, '_blank', 'noopener,noreferrer')}
            title="Opens the Recurring Jobs view in DespatchWeb (new tab)"
            className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-text-secondary hover:bg-slate-50 transition-all"
          >
            Recurring Jobs
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-white p-10 text-center text-sm text-text-secondary">Loading…</div>
      ) : activeTab === 'routes' ? (
        <RoutesTab routes={routes} targets={targets} onChanged={refresh} />
      ) : (
        <RosterTab routes={routes} couriers={couriers} />
      )}
    </div>
  );
}

// ─── Routes tab ───────────────────────────────────────────────────────

function RoutesTab({
  routes,
  targets,
  onChanged,
}: {
  routes: TenantRoute[];
  targets: AssignableTargets | null;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<TenantRoute | 'new' | null>(null);

  const handleSoftDelete = async (r: TenantRoute) => {
    if (!confirm(`Soft-delete "${r.name}"? It will be hidden but not removed.`)) return;
    await routeService.softDeleteRoute(r.id);
    onChanged();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-secondary">
          {routes.length} route{routes.length === 1 ? '' : 's'} configured
        </p>
        <button
          onClick={() => setEditing('new')}
          className="bg-brand-cyan text-[#0d0c2c] font-medium px-5 py-2 rounded-full text-sm hover:shadow-cyan-glow transition-shadow"
        >
          + Add Route
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {routes.length === 0 ? (
          <div className="p-10 text-center text-sm text-text-secondary">No routes yet. Click <strong>Add Route</strong> to create one.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border">
              <tr className="text-left text-[12.5px] font-semibold text-text-secondary">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Default</th>
                <th className="px-4 py-3">Zip Codes</th>
                <th className="px-4 py-3">Roster</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-slate-50">
                  <td className="px-4 py-3.5">
                    <button onClick={() => setEditing(r)} className="text-[#0d0c2c] font-medium hover:text-brand-cyan">{r.name}</button>
                  </td>
                  <td className="px-4 py-3.5 text-text-secondary">{r.area || '—'}</td>
                  <td className="px-4 py-3.5">
                    {r.defaultTargetName ? (
                      <div>
                        <div className="text-[#0d0c2c] flex items-center gap-1.5">
                          {r.defaultTargetName}
                          {r.defaultTargetType && <TargetTypeChip type={r.defaultTargetType} />}
                        </div>
                        {r.defaultTargetHint && <div className="text-[11px] text-text-secondary">{r.defaultTargetHint}</div>}
                      </div>
                    ) : <span className="text-text-secondary">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-text-secondary">
                    <span className="text-[#0d0c2c] font-display font-semibold">{r.zipcodes.length}</span>
                    <span className="text-[11px] ml-1">codes</span>
                  </td>
                  <td className="px-4 py-3.5 text-text-secondary">
                    <span className="text-[#0d0c2c] font-display font-semibold">{r.rosterEntryCount}</span>
                    <span className="text-[11px] ml-1">entries</span>
                  </td>
                  <td className="px-4 py-3.5">
                    {r.active
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800">Active</span>
                      : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 text-slate-700">Inactive</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right text-[12.5px] space-x-3">
                    <button onClick={() => setEditing(r)} className="text-text-secondary hover:text-brand-cyan font-medium">Edit</button>
                    <button onClick={() => handleSoftDelete(r)} className="text-text-secondary hover:text-red-600 font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <RouteEditorModal
          route={editing === 'new' ? null : editing}
          targets={targets}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
    </div>
  );
}

function RouteEditorModal({
  route,
  targets,
  onClose,
  onSaved,
}: {
  route: TenantRoute | null;
  targets: AssignableTargets | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(route?.name ?? '');
  const [area, setArea] = useState(route?.area ?? '');
  const [target, setTarget] = useState<AssignTargetValue | null>(
    route?.defaultTargetType && route?.defaultTargetId
      ? { type: route.defaultTargetType, id: route.defaultTargetId }
      : null,
  );
  const [active, setActive] = useState(route?.active ?? false);
  const [zipcodes, setZipcodes] = useState<{ zipPolygonId: number; zip: string }[]>(route?.zipcodes ?? []);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ZipcodeLookup[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await routeService.searchZipcodes(search.trim());
        if (!cancelled) setResults(r.filter(z => !zipcodes.some(s => s.zipPolygonId === z.zipPolygonId)));
      } catch { /* ignore */ }
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, zipcodes]);

  const valid = name.trim().length > 0 && zipcodes.length > 0;

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      const dto: RouteUpsert = {
        name: name.trim(),
        area: area.trim(),
        defaultTargetType: target?.type ?? null,
        defaultTargetId: target?.id ?? null,
        active,
        zipPolygonIds: zipcodes.map(z => z.zipPolygonId),
      };
      if (route) {
        await routeService.updateRoute(route.id, dto);
      } else {
        await routeService.createRoute(dto);
      }
      onSaved();
    } catch (e: unknown) {
      setErr((e as Error).message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-[#0d0c2c]">{route ? 'Edit Route' : 'New Route'}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-[#0d0c2c] text-2xl leading-none w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">×</button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

          <div>
            <label className="block text-[12.5px] font-medium text-text-secondary mb-1">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Westside Medical AM"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-cyan focus:outline-none" />
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-text-secondary mb-1">Area</label>
            <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Westside"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-cyan focus:outline-none" />
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-text-secondary mb-1">Default Assignment</label>
            <AssignTargetPicker targets={targets} value={target} onChange={setTarget} />
            <p className="text-[11px] text-text-secondary mt-1">
              Courier, Agent, or Network Partner used as this route's default. Roster day/date overrides still take precedence.
            </p>
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-text-secondary mb-1">
              Zip Codes <span className="font-normal">({zipcodes.length} selected)</span>
            </label>
            <div className="border border-border rounded-lg p-2.5 min-h-[58px] flex flex-wrap gap-1.5 bg-slate-50">
              {zipcodes.length === 0 && <span className="text-[12px] text-text-secondary self-center px-2">No zip codes yet — search below to add</span>}
              {zipcodes.map((z) => (
                <span key={z.zipPolygonId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-100 text-[#0d0c2c] text-[12px]">
                  <strong>{z.zip}</strong>
                  <button onClick={() => setZipcodes(zs => zs.filter(s => s.zipPolygonId !== z.zipPolygonId))} className="text-text-secondary hover:text-red-600 font-semibold">×</button>
                </span>
              ))}
            </div>
            <div className="mt-2 relative">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search zip / postcode…"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-cyan focus:outline-none" />
              {search && results.length > 0 && (
                <div className="absolute z-10 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto w-full">
                  {results.slice(0, 10).map((z) => (
                    <button key={z.zipPolygonId}
                      onClick={() => { setZipcodes(zs => [...zs, z]); setSearch(''); setResults([]); }}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-cyan-50 border-b border-border last:border-b-0">
                      <span className="font-display font-semibold">{z.zip}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm pt-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 accent-brand-cyan" />
            <span>Active <span className="text-text-secondary">(uncheck to soft-delete)</span></span>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-border bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2 text-[13px] text-text-secondary hover:text-[#0d0c2c] hover:bg-white rounded-full font-medium">Cancel</button>
          <button onClick={save} disabled={!valid || saving}
            className="bg-brand-cyan text-[#0d0c2c] font-medium text-[13px] px-5 py-2 rounded-full disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed hover:shadow-cyan-glow transition-shadow">
            {saving ? 'Saving…' : route ? 'Save Changes' : 'Create Route'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Roster tab ───────────────────────────────────────────────────────

function RosterTab({ routes, couriers }: { routes: TenantRoute[]; couriers: CourierLookup[] }) {
  const activeRoutes = useMemo(() => routes.filter((r) => r.active), [routes]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(activeRoutes[0]?.id ?? null);
  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (selectedRouteId == null && activeRoutes.length) setSelectedRouteId(activeRoutes[0].id);
  }, [activeRoutes, selectedRouteId]);

  const refresh = useCallback(async () => {
    if (selectedRouteId == null) { setEntries([]); return; }
    setLoading(true); setErr(null);
    try {
      const e = await routeService.listRoster(selectedRouteId);
      setEntries(e);
    } catch (e: unknown) {
      setErr((e as Error).message ?? 'Failed to load roster');
    } finally {
      setLoading(false);
    }
  }, [selectedRouteId]);

  useEffect(() => { refresh(); }, [refresh]);

  if (activeRoutes.length === 0) {
    return <div className="rounded-xl border border-border bg-white p-10 text-center text-sm text-text-secondary">No active routes. Activate one on the Routes tab first.</div>;
  }

  const route = activeRoutes.find((r) => r.id === selectedRouteId) ?? activeRoutes[0];

  const weekly = entries.filter((e) => e.rosterDate === null);
  const overrides = entries.filter((e) => e.rosterDate !== null).sort((a, b) => (a.rosterDate ?? '').localeCompare(b.rosterDate ?? ''));
  const dowMap: Record<number, number> = {};
  weekly.forEach((e) => { if (e.dayOfWeek != null) dowMap[e.dayOfWeek] = e.courierId; });

  const setDow = async (dow: number, courierId: number | null) => {
    // Replace any existing active entry for this DOW. Backend deactivates the
    // collision automatically; deletion of an active row requires the entry id.
    const existing = weekly.find((e) => e.dayOfWeek === dow);
    if (existing && courierId === null) {
      await routeService.deleteRosterEntry(route.id, existing.id);
    } else if (courierId !== null) {
      await routeService.createRosterEntry(route.id, { courierId, rosterDate: null, dayOfWeek: dow });
    }
    refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] text-text-secondary">Route:</span>
        <select value={selectedRouteId ?? ''} onChange={(e) => setSelectedRouteId(parseInt(e.target.value, 10))}
          className="border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-cyan focus:outline-none min-w-[280px]">
          {activeRoutes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}
      {loading && <div className="text-sm text-text-secondary">Loading roster…</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Card title="Default Weekly Pattern" subtitle="Courier rostered on each day of week. Leave blank to fall back to the route's default courier.">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
                <div key={dow} className="flex items-center gap-3">
                  <div className="w-10 text-[12.5px] font-medium text-[#0d0c2c]">{DOW_LABELS[dow]}</div>
                  <select value={dowMap[dow] ?? ''} onChange={(e) => setDow(dow, e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-cyan focus:outline-none">
                    <option value="">— Use default ({route.defaultCourierCode || '—'}) —</option>
                    {couriers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                  </select>
                </div>
              ))}
            </div>
          </Card>

          <DateOverrides
            route={route}
            overrides={overrides}
            couriers={couriers}
            onChanged={refresh}
          />
        </div>

        <div>
          <Card title="14-Day Preview" subtitle="Who's rostered for this route over the next 14 days. Date overrides → weekly pattern → default courier.">
            <FourteenDayPreview route={route} entries={entries} couriers={couriers} />
          </Card>
          <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-[12.5px] text-[#0d0c2c]">
            <div className="font-display font-semibold mb-1">How this is used downstream</div>
            The same precedence logic (date override → DOW pattern → default courier) runs in <code className="bg-white px-1.5 py-0.5 rounded text-[11.5px] font-mono">uspPrebookSet</code> each night.
            The courier it picks is written to <code className="bg-white px-1.5 py-0.5 rounded text-[11.5px] font-mono">tucJob.ucjbCourierID</code> for every materialised recurring job in this route. RunViewer then displays each day's run with the rostered courier.
          </div>
        </div>
      </div>
    </div>
  );
}

function DateOverrides({
  route,
  overrides,
  couriers,
  onChanged,
}: {
  route: TenantRoute;
  overrides: RosterEntry[];
  couriers: CourierLookup[];
  onChanged: () => void;
}) {
  const [date, setDate] = useState('');
  const [courierId, setCourierId] = useState<number | null>(couriers[0]?.id ?? null);

  const add = async () => {
    if (!date || !courierId) return;
    await routeService.createRosterEntry(route.id, { courierId, rosterDate: date, dayOfWeek: null });
    setDate('');
    onChanged();
  };
  const remove = async (id: number) => {
    await routeService.deleteRosterEntry(route.id, id);
    onChanged();
  };

  return (
    <Card title="Date Overrides" subtitle="Specific-date assignments. Wins over the weekly pattern when both exist for the same date.">
      <div className="space-y-2 mb-4">
        {overrides.length === 0
          ? <div className="text-[12px] text-text-secondary py-2">No date overrides yet.</div>
          : overrides.map((o) => {
              const d = o.rosterDate ? new Date(o.rosterDate) : null;
              return (
                <div key={o.id} className="flex items-center justify-between bg-orange-50 border border-orange-200 px-3 py-2 rounded-lg">
                  <div>
                    <span className="text-[13px] font-medium text-[#0d0c2c]">
                      {d ? d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
                    </span>
                    <span className="text-[13px] text-[#0d0c2c] ml-3">→ {o.courierName} ({o.courierCode})</span>
                  </div>
                  <button onClick={() => remove(o.id)} className="text-text-secondary hover:text-red-600 text-[12px] font-medium">Remove</button>
                </div>
              );
            })}
      </div>
      <div className="flex items-end gap-2 pt-3 border-t border-border">
        <div className="flex-1">
          <label className="block text-[12px] font-medium text-text-secondary mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-cyan focus:outline-none" />
        </div>
        <div className="flex-1">
          <label className="block text-[12px] font-medium text-text-secondary mb-1">Courier</label>
          <select value={courierId ?? ''} onChange={(e) => setCourierId(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-cyan focus:outline-none">
            {couriers.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        </div>
        <button onClick={add} disabled={!date || !courierId}
          className="bg-brand-cyan text-[#0d0c2c] font-medium text-[13px] px-4 py-2 rounded-full disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed hover:shadow-cyan-glow transition-shadow">
          Add
        </button>
      </div>
    </Card>
  );
}

function FourteenDayPreview({
  route,
  entries,
  couriers,
}: {
  route: TenantRoute;
  entries: RosterEntry[];
  couriers: CourierLookup[];
}) {
  const courierById = useCallback(
    (id: number | null | undefined) => (id == null ? null : couriers.find((c) => c.id === id)),
    [couriers],
  );

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    const dateOverride = entries.find((e) => e.rosterDate?.slice(0, 10) === iso);
    const dowPattern = entries.find((e) => e.rosterDate === null && e.dayOfWeek === dow);
    let courierId: number | null = null;
    let source: 'override' | 'pattern' | 'default' = 'default';
    if (dateOverride) { courierId = dateOverride.courierId; source = 'override'; }
    else if (dowPattern) { courierId = dowPattern.courierId; source = 'pattern'; }
    else if (route.defaultCourierId) { courierId = route.defaultCourierId; source = 'default'; }
    const c = courierById(courierId);
    const cName = c ? `${c.name} (${c.code})` : (route.defaultCourierName || 'Unassigned');
    return { date: d, source, cName };
  });

  return (
    <div className="space-y-1">
      {days.map((p, i) => {
        const tone = p.source === 'override'
          ? 'bg-orange-50'
          : i === 0
            ? 'bg-cyan-50'
            : 'hover:bg-slate-50';
        const badgeTone = p.source === 'override'
          ? 'bg-orange-100 text-orange-800'
          : p.source === 'pattern'
            ? 'bg-slate-100 text-slate-700'
            : 'bg-slate-50 text-slate-500';
        return (
          <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-[13px] ${tone}`}>
            <div className="flex items-center gap-3">
              <div className="w-20 text-text-secondary">
                {p.date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
              </div>
              {i === 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-100 text-[#0d0c2c]">Today</span>}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-[#0d0c2c]">{p.cName}</div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${badgeTone}`}>{p.source}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TargetTypeChip({ type }: { type: AssignTargetType }) {
  const label = type === 'NetworkPartner' ? 'NP' : type;
  const tone = type === 'Courier'
    ? 'bg-cyan-100 text-[#0d0c2c]'
    : type === 'Agent'
      ? 'bg-violet-100 text-violet-800'
      : 'bg-amber-100 text-amber-800';
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${tone}`}>{label}</span>;
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h3 className="font-display font-semibold text-[#0d0c2c] text-sm">{title}</h3>
      {subtitle && <p className="text-[12px] text-text-secondary mt-0.5 mb-4">{subtitle}</p>}
      {children}
    </div>
  );
}
