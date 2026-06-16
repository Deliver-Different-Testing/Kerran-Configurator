import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  routeService,
  TenantRoute,
  RosterEntry,
  ZipcodeLookup,
  RouteUpsert,
  RouteCopy,
  AssignableTargets,
  AssignTargetType,
  ScheduleLookup,
  RouteBooking,
} from '@/services/tenant_routeService';
import { AssignTargetPicker, AssignTargetValue } from '@/components/common/AssignTargetPicker';
import { RouteTypeChip } from '@/components/tenant/RouteTypeChip';
import { LinehaulTab } from './LinehaulTab';

type Tab = 'routes' | 'linehaul' | 'roster' | 'linehaul-roster';

// Final tab order from day one (spec §3/§4) so operators don't relearn the
// layout when Linehaul Roster fills in.
const TABS: { key: Tab; label: string }[] = [
  { key: 'routes', label: 'Routes' },
  { key: 'linehaul', label: 'Linehaul' },
  { key: 'roster', label: 'Route Roster' },
  { key: 'linehaul-roster', label: 'Linehaul Roster' },
];

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function RecurringRoutes() {
  const { user } = useAuth();
  const recurringJobsUrl = user.despatchWebBaseUrl
    ? `${user.despatchWebBaseUrl}/#!/recurringJobs`
    : null;
  const [activeTab, setActiveTab] = useState<Tab>('routes');
  const [routes, setRoutes] = useState<TenantRoute[]>([]);
  const [targets, setTargets] = useState<AssignableTargets | null>(null);
  const [schedules, setSchedules] = useState<ScheduleLookup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, t, s] = await Promise.all([
        routeService.listRoutes(),
        routeService.getAssignableTargets(),
        routeService.listSchedules().catch(() => [] as ScheduleLookup[]),
      ]);
      setRoutes(r);
      setTargets(t);
      setSchedules(s);
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
          Named routes covering a cluster of zip codes, rostered to a courier, agent, or NP per day.
          The roster feeds nightly prebook job creation and surfaces in RunViewer.
        </p>
      </div>

      <div className="flex gap-1 rounded-2xl border border-border bg-white p-1 shadow-sm w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-[#0d0c2c] text-white shadow-sm'
                : 'text-text-secondary hover:bg-slate-50'
            }`}
          >
            {label}
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
        <RoutesTab routes={routes} targets={targets} schedules={schedules} onChanged={refresh} />
      ) : activeTab === 'linehaul' ? (
        <LinehaulTab />
      ) : activeTab === 'roster' ? (
        <RosterTab routes={routes} targets={targets} />
      ) : (
        <LinehaulRosterTab />
      )}
    </div>
  );
}

// ─── Routes tab ───────────────────────────────────────────────────────

function RoutesTab({
  routes,
  targets,
  schedules,
  onChanged,
}: {
  routes: TenantRoute[];
  targets: AssignableTargets | null;
  schedules: ScheduleLookup[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<TenantRoute | 'new' | null>(null);
  const [copying, setCopying] = useState<TenantRoute | null>(null);

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
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Default</th>
                <th className="px-4 py-3">Zip Codes</th>
                <th className="px-4 py-3">Roster</th>
                <th className="px-4 py-3">Mapped Stops</th>
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
                  <td className="px-4 py-3.5"><RouteTypeChip kind="first-final" /></td>
                  <td className="px-4 py-3.5 text-text-secondary">{r.area || '—'}</td>
                  <td className="px-4 py-3.5">
                    {r.scheduleId ? (
                      <div>
                        <ScheduleChip name={r.scheduleName} startTime={r.scheduleStartTime} endTime={r.scheduleEndTime} />
                        <div className="text-[11px] text-text-secondary mt-1">{formatScheduleDays(r.scheduleDays)}</div>
                      </div>
                    ) : <span className="text-text-secondary text-[12.5px]">— Unbound —</span>}
                  </td>
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
                  {/* Mapped Stops — live count from the API. cursor-pointer telegraphs
                      the §5 drill-down (per-job list + Speed modal); inert until that ships. */}
                  <td className="px-4 py-3.5 text-text-secondary cursor-pointer" title="Mapped stops drill-down (coming soon)">
                    <span className="text-[#0d0c2c] font-display font-semibold">{r.bookingCount}</span>
                    <span className="text-[11px] ml-1">stop{r.bookingCount === 1 ? '' : 's'}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    {r.active
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800">Active</span>
                      : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 text-slate-700">Inactive</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right text-[12.5px] space-x-3">
                    <button onClick={() => setCopying(r)} className="text-text-secondary hover:text-brand-cyan font-medium">Copy</button>
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
          schedules={schedules}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}

      {copying && (
        <CopyRouteModal
          source={copying}
          targets={targets}
          schedules={schedules}
          onClose={() => setCopying(null)}
          onCopied={() => { setCopying(null); onChanged(); }}
        />
      )}
    </div>
  );
}

// Copies a route's geometry + default target into a new route. Mirrors the
// Edit Route modal shape. Bookings + roster are NOT copied — the amber callout
// makes the booking contract unmissable.
function CopyRouteModal({
  source,
  targets,
  schedules,
  onClose,
  onCopied,
}: {
  source: TenantRoute;
  targets: AssignableTargets | null;
  schedules: ScheduleLookup[];
  onClose: () => void;
  onCopied: () => void;
}) {
  const [name, setName] = useState(`${source.name} (copy)`);
  const [target, setTarget] = useState<AssignTargetValue | null>(
    source.defaultTargetType && source.defaultTargetId
      ? { type: source.defaultTargetType, id: source.defaultTargetId }
      : null,
  );
  const [scheduleId, setScheduleId] = useState<number | null>(source.scheduleId ?? null);
  const [copyZipcodes, setCopyZipcodes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = name.trim().length > 0;

  const submit = async () => {
    setErr(null);
    setSaving(true);
    try {
      const dto: RouteCopy = {
        name: name.trim(),
        defaultTargetType: target?.type ?? null,
        defaultTargetId: target?.id ?? null,
        scheduleId,
        copyZipcodes,
      };
      await routeService.copyRoute(source.id, dto);
      onCopied();
    } catch (e: unknown) {
      setErr((e as Error).message ?? 'Copy failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-[#0d0c2c]">Copy Route</h2>
          <p className="text-[12.5px] text-text-secondary mt-0.5">Copies geometry + default assignment. Existing bookings stay on the source route.</p>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

          <div className="flex items-center justify-between bg-slate-50 border border-border rounded-lg px-3 py-2.5">
            <div>
              <div className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">Source</div>
              <div className="text-sm text-[#0d0c2c]">{source.name}</div>
            </div>
            <div className="text-[12.5px] text-text-secondary">{source.zipcodes.length} zipcode{source.zipcodes.length === 1 ? '' : 's'}</div>
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-text-secondary mb-1">New route name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Central Valley PM"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-cyan focus:outline-none" />
          </div>

          <ScheduleSection schedules={schedules} value={scheduleId} onChange={setScheduleId}
            hint="Most-common reason to Copy is splitting AM and PM with the same geometry." />

          <div>
            <label className="block text-[12.5px] font-medium text-text-secondary mb-1">Default assignment</label>
            <AssignTargetPicker targets={targets} value={target} onChange={setTarget} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={copyZipcodes} onChange={(e) => setCopyZipcodes(e.target.checked)} className="w-4 h-4 accent-brand-cyan" />
            <span>Copy {source.zipcodes.length} zipcode{source.zipcodes.length === 1 ? '' : 's'} <span className="text-text-secondary">(uncheck to start with an empty geometry)</span></span>
          </label>

          <div className="flex gap-2.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-[12.5px] text-[#7c2d12]">
            <span aria-hidden="true">⚠</span>
            <div>
              <strong>Bookings are not copied.</strong> Existing recurring bookings stay attached to <em>{source.name}</em>. Re-assign bookings to the new route from the Dispatch app's Recurring list / Route Viewer.
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2 text-[13px] text-text-secondary hover:text-[#0d0c2c] hover:bg-white rounded-full font-medium">Cancel</button>
          <button onClick={submit} disabled={!valid || saving}
            className="bg-brand-cyan text-[#0d0c2c] font-medium text-[13px] px-5 py-2 rounded-full disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed hover:shadow-cyan-glow transition-shadow">
            {saving ? 'Copying…' : 'Copy route'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RouteEditorModal({
  route,
  targets,
  schedules,
  onClose,
  onSaved,
}: {
  route: TenantRoute | null;
  targets: AssignableTargets | null;
  schedules: ScheduleLookup[];
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
  const [scheduleId, setScheduleId] = useState<number | null>(route?.scheduleId ?? null);
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
        scheduleId,
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
            <p className="text-[11px] text-text-secondary mt-1">
              Free-text description of the route's coverage area. Don't include counts — they're shown as <strong>Mapped Stops</strong> in the route table.
            </p>
            {/* Soft-guard (AR3): warn, don't block, if the operator re-types the stale count tail. */}
            {/mapped recurring bookings/i.test(area) && (
              <p className="text-[11px] text-amber-600 mt-1">
                ⚠️ Looks like a stale stop count — the live total shows in the Mapped Stops column. Consider removing it.
              </p>
            )}
          </div>

          <ScheduleSection schedules={schedules} value={scheduleId} onChange={setScheduleId}
            hint="This route serves the chosen schedule's pickup time window. Day-of-week is set on the schedule; the route supplies geometry." />

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

          {route && <RouteBookingsSection route={route} />}

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

function RosterTab({ routes, targets }: { routes: TenantRoute[]; targets: AssignableTargets | null }) {
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
  const dowEntry: Record<number, RosterEntry> = {};
  weekly.forEach((e) => { if (e.dayOfWeek != null) dowEntry[e.dayOfWeek] = e; });

  const setDow = async (dow: number, value: AssignTargetValue | null) => {
    // Replace any existing active entry for this DOW. Backend deactivates the
    // collision automatically; deletion of an active row requires the entry id.
    const existing = weekly.find((e) => e.dayOfWeek === dow);
    if (value === null) {
      if (existing) await routeService.deleteRosterEntry(route.id, existing.id);
    } else {
      await routeService.createRosterEntry(route.id, { targetType: value.type, targetId: value.id, rosterDate: null, dayOfWeek: dow });
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
          <Card title="Default Weekly Pattern" subtitle="Courier / Agent / NP rostered on each day of week. Leave blank to fall back to the route's default.">
            <div className="space-y-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
                <WeeklyDayRow
                  key={dow}
                  dow={dow}
                  entry={dowEntry[dow] ?? null}
                  route={route}
                  targets={targets}
                  onSet={(v) => setDow(dow, v)}
                />
              ))}
            </div>
          </Card>

          <DateOverrides
            route={route}
            overrides={overrides}
            targets={targets}
            onChanged={refresh}
          />
        </div>

        <div>
          <Card title="14-Day Preview" subtitle="Who's rostered for this route over the next 14 days. Date overrides → weekly pattern → default.">
            <FourteenDayPreview route={route} entries={entries} />
          </Card>
          <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-[12.5px] text-[#0d0c2c]">
            <div className="font-display font-semibold mb-1">How this is used downstream</div>
            The same precedence logic (date override → DOW pattern → default) runs in <code className="bg-white px-1.5 py-0.5 rounded text-[11.5px] font-mono">uspPrebookSet</code> each night.
            For <strong>Courier</strong> assignments the picked courier is written to <code className="bg-white px-1.5 py-0.5 rounded text-[11.5px] font-mono">tucJob.ucjbCourierID</code> for every materialised recurring job, and RunViewer displays each day's run with that courier.
            <div className="mt-2 text-[12px]">
              <strong>Agent / NP</strong> assignments are recorded here for configuration, but are <strong>not yet materialised into jobs</strong> — prebook still resolves a courier only. Use a Courier target for any day that must dispatch today.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// One compact weekday row: shows the current assignment (or "use default") and
// opens the shared Courier/Agent/NP picker in a small modal on Edit.
function WeeklyDayRow({
  dow,
  entry,
  route,
  targets,
  onSet,
}: {
  dow: number;
  entry: RosterEntry | null;
  route: TenantRoute;
  targets: AssignableTargets | null;
  onSet: (v: AssignTargetValue | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const current: AssignTargetValue | null =
    entry?.targetType && entry?.targetId ? { type: entry.targetType, id: entry.targetId } : null;

  return (
    <div className="flex items-center gap-3">
      <div className="w-10 text-[12.5px] font-medium text-[#0d0c2c]">{DOW_LABELS[dow]}</div>
      <div className="flex-1 flex items-center justify-between border border-border rounded-lg px-3 py-2">
        {entry?.targetName ? (
          <span className="text-sm text-[#0d0c2c] flex items-center gap-1.5">
            {entry.targetName}
            {entry.targetType && <TargetTypeChip type={entry.targetType} />}
            {entry.targetHint && <span className="text-[11px] text-text-secondary">{entry.targetHint}</span>}
          </span>
        ) : (
          <span className="text-sm text-text-secondary">— Use default ({route.defaultTargetHint || route.defaultTargetName || '—'}) —</span>
        )}
        <button onClick={() => setEditing(true)} className="text-[12px] text-text-secondary hover:text-brand-cyan font-medium">Edit</button>
      </div>
      {editing && (
        <RosterPickerModal
          title={`${DOW_LABELS[dow]} assignment`}
          targets={targets}
          value={current}
          onClose={() => setEditing(false)}
          onSave={(v) => { setEditing(false); onSet(v); }}
        />
      )}
    </div>
  );
}

// Small modal hosting AssignTargetPicker, with Save + Clear (→ use default).
function RosterPickerModal({
  title,
  targets,
  value,
  onClose,
  onSave,
}: {
  title: string;
  targets: AssignableTargets | null;
  value: AssignTargetValue | null;
  onClose: () => void;
  onSave: (v: AssignTargetValue | null) => void;
}) {
  const [picked, setPicked] = useState<AssignTargetValue | null>(value);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-[#0d0c2c]">{title}</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-[#0d0c2c] text-2xl leading-none w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">×</button>
        </div>
        <div className="px-5 py-5">
          <AssignTargetPicker targets={targets} value={picked} onChange={setPicked} />
        </div>
        <div className="px-5 py-3 border-t border-border bg-slate-50 flex items-center justify-between">
          {value
            ? <button onClick={() => onSave(null)} className="text-[12.5px] text-text-secondary hover:text-red-600 font-medium">Clear (use default)</button>
            : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-[13px] text-text-secondary hover:text-[#0d0c2c] hover:bg-white rounded-full font-medium">Cancel</button>
            <button onClick={() => onSave(picked)} disabled={!picked}
              className="bg-brand-cyan text-[#0d0c2c] font-medium text-[13px] px-5 py-2 rounded-full disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed hover:shadow-cyan-glow transition-shadow">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DateOverrides({
  route,
  overrides,
  targets,
  onChanged,
}: {
  route: TenantRoute;
  overrides: RosterEntry[];
  targets: AssignableTargets | null;
  onChanged: () => void;
}) {
  const [date, setDate] = useState('');
  const [target, setTarget] = useState<AssignTargetValue | null>(null);

  const add = async () => {
    if (!date || !target) return;
    await routeService.createRosterEntry(route.id, { targetType: target.type, targetId: target.id, rosterDate: date, dayOfWeek: null });
    setDate('');
    setTarget(null);
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
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium text-[#0d0c2c]">
                      {d ? d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
                    </span>
                    <span className="text-[13px] text-[#0d0c2c] ml-2">→ {o.targetName || '—'}</span>
                    {o.targetType && <TargetTypeChip type={o.targetType} />}
                    {o.targetHint && <span className="text-[11px] text-text-secondary">{o.targetHint}</span>}
                  </div>
                  <button onClick={() => remove(o.id)} className="text-text-secondary hover:text-red-600 text-[12px] font-medium">Remove</button>
                </div>
              );
            })}
      </div>
      <div className="pt-3 border-t border-border space-y-2">
        <div className="flex gap-2">
          <div className="w-44">
            <label className="block text-[12px] font-medium text-text-secondary mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-cyan focus:outline-none" />
          </div>
          <div className="flex-1">
            <label className="block text-[12px] font-medium text-text-secondary mb-1">Assignment</label>
            <AssignTargetPicker targets={targets} value={target} onChange={setTarget} />
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={add} disabled={!date || !target}
            className="bg-brand-cyan text-[#0d0c2c] font-medium text-[13px] px-4 py-2 rounded-full disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed hover:shadow-cyan-glow transition-shadow">
            Add Override
          </button>
        </div>
      </div>
    </Card>
  );
}

function FourteenDayPreview({
  route,
  entries,
}: {
  route: TenantRoute;
  entries: RosterEntry[];
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    const dateOverride = entries.find((e) => e.rosterDate?.slice(0, 10) === iso);
    const dowPattern = entries.find((e) => e.rosterDate === null && e.dayOfWeek === dow);
    let name = route.defaultTargetName || 'Unassigned';
    let type: AssignTargetType | null = route.defaultTargetType;
    let source: 'override' | 'pattern' | 'default' = 'default';
    if (dateOverride) { name = dateOverride.targetName || name; type = dateOverride.targetType; source = 'override'; }
    else if (dowPattern) { name = dowPattern.targetName || name; type = dowPattern.targetType; source = 'pattern'; }
    return { date: d, source, name, type };
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
            <div className="flex items-center gap-2">
              <div className="text-[#0d0c2c]">{p.name}</div>
              {p.type && <TargetTypeChip type={p.type} />}
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

// Collapsible read-only summary of live recurring bookings on a route. Lazy-loads
// the detail on first expand (the count is already on the route). Re-assignment is
// operator-driven in the Dispatch app / Route Viewer — this is view-only.
function RouteBookingsSection({ route }: { route: TenantRoute }) {
  const [open, setOpen] = useState(false);
  const [bookings, setBookings] = useState<RouteBooking[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && bookings === null && !loading) {
      setLoading(true); setErr(null);
      try {
        setBookings(await routeService.listBookings(route.id));
      } catch (e: unknown) {
        setErr((e as Error).message ?? 'Failed to load bookings');
      } finally {
        setLoading(false);
      }
    }
  };

  const fmtNextDue = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="border border-border rounded-lg">
      <button type="button" onClick={toggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left">
        <span className="text-[12.5px] font-medium text-[#0d0c2c]">
          Bookings on this route <span className="text-text-secondary">({route.bookingCount})</span>
        </span>
        <span className="text-text-secondary text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-border">
          {loading && <div className="text-[12px] text-text-secondary py-3">Loading bookings…</div>}
          {err && <div className="text-[12px] text-red-700 py-3">{err}</div>}
          {!loading && !err && bookings && bookings.length === 0 && (
            <div className="text-[12px] text-text-secondary py-3">No live recurring bookings on this route.</div>
          )}
          {!loading && !err && bookings && bookings.length > 0 && (
            <table className="w-full text-[12.5px] mt-2">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-text-secondary border-b border-border">
                  <th className="py-1.5 pr-2">Client</th>
                  <th className="py-1.5 pr-2">Pickup</th>
                  <th className="py-1.5 pr-2">Days</th>
                  <th className="py-1.5">Next due</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-b-0">
                    <td className="py-1.5 pr-2 text-[#0d0c2c]">{b.clientName || '—'}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{b.pickupWindow || '—'}</td>
                    <td className="py-1.5 pr-2">{b.days || '—'}</td>
                    <td className="py-1.5 tabular-nums">{fmtNextDue(b.nextDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[11px] text-text-secondary mt-2">
            Read-only. Re-assign bookings to a different route from the Dispatch app's Recurring list / Route Viewer.
          </p>
        </div>
      )}
    </div>
  );
}

const ISO_DAY_LABELS: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

// ISO day list (1=Mon … 7=Sun) → compact label: "Mon–Fri", "Every day", or a
// comma list for non-contiguous sets.
function formatScheduleDays(days: number[]): string {
  if (!days || days.length === 0) return '—';
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Every day';
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (contiguous && sorted.length >= 3) return `${ISO_DAY_LABELS[sorted[0]]}–${ISO_DAY_LABELS[sorted[sorted.length - 1]]}`;
  return sorted.map((d) => ISO_DAY_LABELS[d] ?? String(d)).join(', ');
}

// Tint a schedule chip by start-of-window hour — AM / midday / evening, mirroring
// the mockup's orange / purple / reflex coding.
function scheduleTone(startTime: string): string {
  const hour = parseInt(startTime.slice(0, 2), 10);
  if (Number.isNaN(hour)) return 'bg-slate-100 text-slate-700';
  if (hour < 12) return 'bg-amber-100 text-amber-800';
  if (hour < 17) return 'bg-violet-100 text-violet-800';
  return 'bg-blue-100 text-blue-800';
}

function ScheduleChip({ name, startTime, endTime }: { name: string; startTime: string; endTime: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${scheduleTone(startTime)}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {name}{startTime && endTime ? ` · ${startTime}–${endTime}` : ''}
    </span>
  );
}

// Schedule dropdown + live preview (Time window / Days). Holiday handling is
// intentionally omitted — it's per-booking (tucJobBooking.HolidayDeliveryOption),
// not a schedule attribute. Optional: a route may stay unbound until backfilled.
function ScheduleSection({
  schedules,
  value,
  onChange,
  hint,
}: {
  schedules: ScheduleLookup[];
  value: number | null;
  onChange: (id: number | null) => void;
  hint: string;
}) {
  const selected = value != null ? schedules.find((s) => s.id === value) ?? null : null;
  return (
    <div>
      <label className="block text-[12.5px] font-medium text-text-secondary mb-1">Schedule</label>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-cyan focus:outline-none">
        <option value="">— No schedule (unbound) —</option>
        {schedules.map((s) => (
          <option key={s.id} value={s.id}>{s.name} — {formatScheduleDays(s.days)} {s.startTime}–{s.endTime}</option>
        ))}
      </select>
      {selected && (
        <div className="mt-2 rounded-lg bg-cyan-50 border border-cyan-100 px-3 py-2.5 text-[12px] text-[#0d0c2c]">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 mb-1">Selected schedule</div>
          <div className="flex justify-between py-0.5"><span className="text-text-secondary">Time window</span><span className="tabular-nums">{selected.startTime} – {selected.endTime}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-text-secondary">Days</span><span>{formatScheduleDays(selected.days)}</span></div>
        </div>
      )}
      {schedules.length === 0 && <p className="text-[11px] text-text-secondary mt-1">No schedules available for this tenant yet.</p>}
      <p className="text-[11px] text-text-secondary mt-1">{hint}</p>
    </div>
  );
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

// ─── Linehaul Roster tab (spec §4) ────────────────────────────────────
// Placeholder until the Run × Day driver grid (Dispatch_LinehaulRunRoster)
// lands. Kept in the tab order from day one so the layout doesn't shift.
function LinehaulRosterTab() {
  return (
    <div className="rounded-xl border border-border bg-white p-10 text-center">
      <p className="text-sm font-medium text-[#0d0c2c]">Linehaul Roster</p>
      <p className="text-sm text-text-secondary mt-1">
        Driver-by-day rostering for linehaul runs is coming soon.
      </p>
    </div>
  );
}
