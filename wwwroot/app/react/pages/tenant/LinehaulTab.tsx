import { useCallback, useEffect, useMemo, useState } from 'react';
import { RouteTypeChip } from '@/components/tenant/RouteTypeChip';
import { RowActionsMenu } from '@/components/tenant/RowActionsMenu';
import { TargetTypeChip } from '@/components/tenant/TargetTypeChip';
import { AssignTargetPicker, AssignTargetValue } from '@/components/common/AssignTargetPicker';
import { TimeField } from '@/components/common/TimeField';
import { MappedStopsDrilldown } from './MappedStopsDrilldown';
import { routeService, AssignableTargets } from '@/services/tenant_routeService';
import { useAuth } from '@/context/AuthContext';
import { rateScheduleService, ReportingSpeed } from '@/services/reporting_rateScheduleService';
import {
  linehaulService,
  extractLinehaulError,
  TenantLinehaulRun,
  TenantLinehaulRunUpsert,
  LinehaulLookups,
  LinehaulScheduleBinding,
} from '@/services/tenant_linehaulService';

// ─── Linehaul tab (Recurring Routes spec §3) ──────────────────────────────
// Full inline CRUD over depot-to-depot middle-mile runs. Mirrors the Routes
// tab's table/lozenge/modal chrome. No DespatchWeb / ClientManager hops.
export function LinehaulTab() {
  const [runs, setRuns] = useState<TenantLinehaulRun[]>([]);
  const [lookups, setLookups] = useState<LinehaulLookups | null>(null);
  const [targets, setTargets] = useState<AssignableTargets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TenantLinehaulRun | 'new' | null>(null);
  const [drillRun, setDrillRun] = useState<TenantLinehaulRun | null>(null);
  const [schedRun, setSchedRun] = useState<TenantLinehaulRun | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Reuse the Routes-side assignable-targets endpoint for the Courier/Agent/NP
      // picker (Fixes §5) — same tenant-scoped {couriers, agents, nps} shape.
      const [r, l, t] = await Promise.all([
        linehaulService.list(),
        linehaulService.lookups(),
        routeService.getAssignableTargets(),
      ]);
      setRuns(r);
      setLookups(l);
      setTargets(t);
    } catch (e: unknown) {
      setError(extractLinehaulError(e, 'Failed to load linehaul runs'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleCopy = async (run: TenantLinehaulRun) => {
    try {
      const copy = await linehaulService.copy(run.id);
      await refresh();
      setEditing(copy);   // open the clone in edit mode (spec §3)
    } catch (e: unknown) {
      setError(extractLinehaulError(e, 'Copy failed'));
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-border bg-white p-10 text-center text-sm text-text-secondary">Loading…</div>;
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-secondary">
          {runs.length} linehaul run{runs.length === 1 ? '' : 's'}
        </p>
        <button
          onClick={() => setEditing('new')}
          className="bg-brand-cyan text-[#0d0c2c] font-medium px-5 py-2 rounded-full text-sm hover:shadow-cyan-glow transition-shadow"
        >
          + Add Linehaul Run
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {runs.length === 0 ? (
          <div className="p-10 text-center text-sm text-text-secondary">
            No middle-mile runs yet — click <strong>+ Add Linehaul Run</strong> to create your first.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border">
              <tr className="text-left text-[12.5px] font-semibold text-text-secondary">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Origin → Destination</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">Despatch</th>
                <th className="px-4 py-3">Default</th>
                <th className="px-4 py-3">Used by Schedules</th>
                <th className="px-4 py-3">Mapped Stops</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setEditing(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(r); } }}
                  role="button"
                  tabIndex={0}
                  className="border-b border-border last:border-b-0 cursor-pointer hover:bg-surface-cream focus:bg-surface-cream focus:outline-none"
                >
                  <td className="px-4 py-3.5">
                    <span className="text-[#0d0c2c] font-medium">{r.runName}</span>
                  </td>
                  <td className="px-4 py-3.5"><RouteTypeChip kind="middle" /></td>
                  <td className="px-4 py-3.5 text-[#0d0c2c]">
                    {r.fromDepotName || '—'} <span className="text-text-secondary">→</span> {r.toDepotName || '—'}
                  </td>
                  <td className="px-4 py-3.5 text-text-secondary">{r.startTime || '—'}</td>
                  <td className="px-4 py-3.5 text-text-secondary">{r.despatchTime || '—'}</td>
                  {/* Fixes §5 — polymorphic default target: name + Courier/Agent/NP chip. */}
                  <td className="px-4 py-3.5">
                    {r.defaultTargetName ? (
                      <div>
                        <div className="text-[#0d0c2c] flex items-center gap-1.5">
                          {r.defaultTargetName}
                          {r.defaultTargetType && <TargetTypeChip type={r.defaultTargetType} />}
                        </div>
                        {r.defaultTargetHint && <div className="text-[11px] text-text-secondary">{r.defaultTargetHint}</div>}
                      </div>
                    ) : <span className="text-text-secondary">— Unbound —</span>}
                  </td>
                  {/* Used by Schedules — click opens the schedule-binding list (Fix 7).
                      stopPropagation so it doesn't also open the edit panel. */}
                  <td className="px-4 py-3.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSchedRun(r); }}
                      disabled={r.usedBySchedulesCount === 0}
                      className="text-text-secondary enabled:hover:text-brand-cyan disabled:cursor-default"
                      title={r.usedBySchedulesCount === 0 ? 'Not bound to any schedule' : 'View schedules using this run'}
                    >
                      <span className="text-[#0d0c2c] font-display font-semibold">{r.usedBySchedulesCount}</span>
                      <span className="text-[11px] ml-1">schedule{r.usedBySchedulesCount === 1 ? '' : 's'}</span>
                    </button>
                  </td>
                  {/* Mapped Stops — click drills into the per-job list + Speed modal (§5).
                      stopPropagation (Fix 3) so the drill-down doesn't also open the edit panel. */}
                  <td className="px-4 py-3.5">
                    <button onClick={(e) => { e.stopPropagation(); setDrillRun(r); }} className="text-text-secondary hover:text-brand-cyan" title="View mapped stops">
                      <span className="text-[#0d0c2c] font-display font-semibold">{r.mappedStopsCount}</span>
                      <span className="text-[11px] ml-1">stop{r.mappedStopsCount === 1 ? '' : 's'}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3.5">
                    {r.active
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800">Active</span>
                      : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 text-slate-700">Inactive</span>}
                  </td>
                  {/* Fixes 3+4: Edit removed (whole-row click); Delete stays panel-only;
                      Actions collapses to a ⋯ overflow with Copy. */}
                  <td className="px-4 py-3.5 text-right">
                    <RowActionsMenu actions={[{ label: 'Copy', onClick: () => handleCopy(r) }]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && lookups && (
        <LinehaulEditModal
          run={editing === 'new' ? null : editing}
          lookups={lookups}
          targets={targets}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}

      {drillRun && (
        <MappedStopsDrilldown
          run={{ id: drillRun.id, runName: drillRun.runName, fromDepotName: drillRun.fromDepotName, toDepotName: drillRun.toDepotName }}
          onClose={() => setDrillRun(null)}
        />
      )}

      {schedRun && (
        <LinehaulSchedulesDrilldown run={schedRun} onClose={() => setSchedRun(null)} />
      )}
    </div>
  );
}

// ─── "Used by Schedules" drill-down (Fix 7) ────────────────────────────────
// Reusable list of the schedules binding a run + an Open↗ deep-link into
// DespatchWeb's Recurring Jobs (schedule) editor. Rendered both in the
// cell-click side panel and inside the run's edit modal (AR-Fix7.2).
function LinehaulSchedulesList({ runId }: { runId: number }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<LinehaulScheduleBinding[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scheduleEditorUrl = user.despatchWebBaseUrl ? `${user.despatchWebBaseUrl}/#!/recurringJobs` : null;

  useEffect(() => {
    let alive = true;
    linehaulService.schedulesForRun(runId)
      .then((r) => { if (alive) setRows(r); })
      .catch((e: unknown) => { if (alive) setError(extractLinehaulError(e, 'Failed to load schedules')); });
    return () => { alive = false; };
  }, [runId]);

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (rows === null) return <div className="py-6 text-center text-sm text-text-secondary">Loading…</div>;
  if (rows.length === 0) return <div className="py-6 text-center text-sm text-text-secondary">Not bound to any schedule.</div>;

  return (
    <ul className="divide-y divide-border">
      {rows.map((s, i) => (
        <li key={`${s.scheduleId ?? 'x'}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <div className="text-sm text-[#0d0c2c] truncate">{s.name}</div>
            {s.weekDay && <div className="text-[11px] text-text-secondary">{s.weekDay}</div>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${s.active ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
              {s.active ? 'Active' : 'Inactive'}
            </span>
            {scheduleEditorUrl && (
              <a href={scheduleEditorUrl} target="_blank" rel="noopener noreferrer"
                className="text-[12px] text-brand-cyan hover:underline whitespace-nowrap" title="Open in DespatchWeb">
                Open ↗
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function LinehaulSchedulesDrilldown({ run, onClose }: { run: TenantLinehaulRun; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-xl flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#0d0c2c]">Schedules using this run</h2>
            <p className="text-[12px] text-text-secondary mt-0.5">{run.runName}</p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-[#0d0c2c] text-2xl leading-none w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-3">
          <LinehaulSchedulesList runId={run.id} />
        </div>
      </div>
    </div>
  );
}

// ─── Edit / create modal ──────────────────────────────────────────────────
function LinehaulEditModal({
  run,
  lookups,
  targets,
  onClose,
  onSaved,
}: {
  run: TenantLinehaulRun | null;
  lookups: LinehaulLookups;
  targets: AssignableTargets | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [runName, setRunName] = useState(run?.runName ?? '');
  const [fromDepotId, setFromDepotId] = useState<number>(run?.fromDepotId ?? 0);
  const [toDepotId, setToDepotId] = useState<number>(run?.toDepotId ?? 0);
  const [startTime, setStartTime] = useState(run?.startTime ?? '');
  const [despatchTime, setDespatchTime] = useState(run?.despatchTime ?? '');
  const [target, setTarget] = useState<AssignTargetValue | null>(
    run?.defaultTargetType && run?.defaultTargetId
      ? { type: run.defaultTargetType, id: run.defaultTargetId }
      : null,
  );
  // Fixes §8 — run-level Speed override. 0 = "— Use schedule default —" (null).
  const [speedId, setSpeedId] = useState<number>(run?.speedId ?? 0);
  const [speeds, setSpeeds] = useState<ReportingSpeed[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    rateScheduleService.getSpeeds().then((s) => { if (alive) setSpeeds(s.data); }).catch(() => { /* non-fatal */ });
    return () => { alive = false; };
  }, []);

  // optgroup the speed picker by grouping name (same source as the Job-detail spec).
  const groupedSpeeds = useMemo(() => {
    const m = new Map<string, ReportingSpeed[]>();
    for (const s of speeds) {
      const key = s.groupingName ?? 'Other';
      (m.get(key) ?? m.set(key, []).get(key)!).push(s);
    }
    return [...m.entries()];
  }, [speeds]);

  const sameDepot = fromDepotId > 0 && fromDepotId === toDepotId;
  const despatchBeforeStart = !!startTime && !!despatchTime && despatchTime < startTime;
  const valid = runName.trim().length > 0 && fromDepotId > 0 && toDepotId > 0 && !sameDepot && !despatchBeforeStart;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setErr(null);
    try {
      const payload: TenantLinehaulRunUpsert = {
        runName: runName.trim(),
        fromDepotId,
        toDepotId,
        startTime: startTime || null,
        despatchTime: despatchTime || null,
        defaultTargetType: target?.type ?? null,
        defaultTargetId: target?.id ?? null,
        speedId: speedId > 0 ? speedId : null,
      };
      if (run) {
        await linehaulService.update(run.id, payload);
      } else {
        await linehaulService.create(payload);
      }
      onSaved();
    } catch (e: unknown) {
      setErr(extractLinehaulError(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!run) return;
    if (run.usedBySchedulesCount > 0) {
      setErr(`Remove this run from ${run.usedBySchedulesCount} schedule(s) before deleting.`);
      return;
    }
    if (!confirm(`Delete linehaul run "${run.runName}"? This cannot be undone.`)) return;
    setSaving(true);
    setErr(null);
    try {
      await linehaulService.remove(run.id);
      onSaved();
    } catch (e: unknown) {
      setErr(extractLinehaulError(e, 'Delete failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-[#0d0c2c]">{run ? 'Edit Linehaul Run' : 'New Linehaul Run'}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-[#0d0c2c] text-2xl leading-none w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">×</button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

          <div>
            <label className="block text-[12.5px] font-medium text-text-secondary mb-1">Run name *</label>
            <input value={runName} onChange={(e) => setRunName(e.target.value)} placeholder="e.g. Auckland → Hamilton AM" maxLength={50}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-cyan focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12.5px] font-medium text-text-secondary mb-1">From depot *</label>
              <select value={fromDepotId} onChange={(e) => setFromDepotId(Number(e.target.value))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-cyan focus:outline-none">
                <option value={0}>— Select —</option>
                {lookups.depots.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-text-secondary mb-1">To depot *</label>
              <select value={toDepotId} onChange={(e) => setToDepotId(Number(e.target.value))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-cyan focus:outline-none">
                <option value={0}>— Select —</option>
                {lookups.depots.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          {sameDepot && <p className="text-[11px] text-amber-600">From and To depots must be different.</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12.5px] font-medium text-text-secondary mb-1">Start time</label>
              <TimeField value={startTime} onChange={setStartTime} ariaLabel="Start time" />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-text-secondary mb-1">Despatch time</label>
              <TimeField value={despatchTime} onChange={setDespatchTime} ariaLabel="Despatch time" />
            </div>
          </div>
          {despatchBeforeStart && <p className="text-[11px] text-amber-600">Despatch time must be at or after the start time.</p>}

          {/* Fixes §5 — polymorphic default target (Courier / Agent / NP). */}
          <div>
            <label className="block text-[12.5px] font-medium text-text-secondary mb-1">Default assigned to</label>
            <AssignTargetPicker targets={targets} value={target} onChange={setTarget} />
            <p className="text-[11px] text-text-secondary mt-1">The run's default Courier, Agent, or Network Partner. Day-by-day overrides live on the Linehaul Roster.</p>
          </div>

          {/* Fixes §8 — run-level Speed (service level). Empty = inherit the schedule's speed. */}
          <div>
            <label className="block text-[12.5px] font-medium text-text-secondary mb-1">Speed (service level)</label>
            <select value={speedId} onChange={(e) => setSpeedId(Number(e.target.value))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-cyan focus:outline-none">
              <option value={0}>— Use schedule default —</option>
              {groupedSpeeds.map(([groupName, items]) => (
                <optgroup key={groupName} label={groupName}>
                  {items.map((s) => <option key={s.id} value={s.id}>{s.shortName} · {s.name}</option>)}
                </optgroup>
              ))}
            </select>
            <p className="text-[11px] text-text-secondary mt-1">Overrides the schedule's speed for jobs booked against this run. Leave on default to inherit.</p>
          </div>

          {run && (
            <div>
              <label className="block text-[12.5px] font-medium text-text-secondary mb-1">Used by schedules</label>
              {/* Fix 7 — the same schedule-binding list as the cell drill-down. */}
              <div className="border border-border rounded-lg px-3">
                <LinehaulSchedulesList runId={run.id} />
              </div>
              <p className="text-[11px] text-text-secondary mt-1">Bindings are managed in the Schedule editor (DespatchWeb).</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border bg-slate-50 flex items-center justify-between gap-2">
          <div>
            {run && (
              <button onClick={remove} disabled={saving || run.usedBySchedulesCount > 0}
                title={run.usedBySchedulesCount > 0 ? 'Remove this run from its schedule(s) before deleting' : undefined}
                className="px-5 py-2 text-[13px] text-red-600 hover:bg-red-50 rounded-full font-medium disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-5 py-2 text-[13px] text-text-secondary hover:text-[#0d0c2c] hover:bg-white rounded-full font-medium">Cancel</button>
            <button onClick={save} disabled={!valid || saving}
              className="bg-brand-cyan text-[#0d0c2c] font-medium text-[13px] px-5 py-2 rounded-full disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed hover:shadow-cyan-glow transition-shadow">
              {saving ? 'Saving…' : run ? 'Save Changes' : 'Create Run'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
