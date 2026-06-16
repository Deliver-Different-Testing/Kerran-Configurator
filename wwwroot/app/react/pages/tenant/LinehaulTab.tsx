import { useCallback, useEffect, useState } from 'react';
import { RouteTypeChip } from '@/components/tenant/RouteTypeChip';
import {
  linehaulService,
  extractLinehaulError,
  TenantLinehaulRun,
  TenantLinehaulRunUpsert,
  LinehaulLookups,
} from '@/services/tenant_linehaulService';

// ─── Linehaul tab (Recurring Routes spec §3) ──────────────────────────────
// Full inline CRUD over depot-to-depot middle-mile runs. Mirrors the Routes
// tab's table/lozenge/modal chrome. No DespatchWeb / ClientManager hops.
export function LinehaulTab() {
  const [runs, setRuns] = useState<TenantLinehaulRun[]>([]);
  const [lookups, setLookups] = useState<LinehaulLookups | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TenantLinehaulRun | 'new' | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, l] = await Promise.all([linehaulService.list(), linehaulService.lookups()]);
      setRuns(r);
      setLookups(l);
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
                <th className="px-4 py-3">Default Driver</th>
                <th className="px-4 py-3">Used by Schedules</th>
                <th className="px-4 py-3">Mapped Stops</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-slate-50">
                  <td className="px-4 py-3.5">
                    <button onClick={() => setEditing(r)} className="text-[#0d0c2c] font-medium hover:text-brand-cyan">{r.runName}</button>
                  </td>
                  <td className="px-4 py-3.5"><RouteTypeChip kind="middle" /></td>
                  <td className="px-4 py-3.5 text-[#0d0c2c]">
                    {r.fromDepotName || '—'} <span className="text-text-secondary">→</span> {r.toDepotName || '—'}
                  </td>
                  <td className="px-4 py-3.5 text-text-secondary">{r.startTime || '—'}</td>
                  <td className="px-4 py-3.5 text-text-secondary">{r.despatchTime || '—'}</td>
                  <td className="px-4 py-3.5 text-text-secondary">{r.defaultDriverName || <span className="text-text-secondary">— Unbound —</span>}</td>
                  <td className="px-4 py-3.5 text-text-secondary">
                    <span className="text-[#0d0c2c] font-display font-semibold">{r.usedBySchedulesCount}</span>
                    <span className="text-[11px] ml-1">schedule{r.usedBySchedulesCount === 1 ? '' : 's'}</span>
                  </td>
                  {/* Mapped Stops — cursor-pointer telegraphs the §5 drill-down; inert until that ships. */}
                  <td className="px-4 py-3.5 text-text-secondary cursor-pointer" title="Mapped stops drill-down (coming soon)">
                    <span className="text-[#0d0c2c] font-display font-semibold">{r.mappedStopsCount}</span>
                    <span className="text-[11px] ml-1">stop{r.mappedStopsCount === 1 ? '' : 's'}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    {r.active
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800">Active</span>
                      : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 text-slate-700">Inactive</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right text-[12.5px] space-x-3">
                    <button onClick={() => handleCopy(r)} className="text-text-secondary hover:text-brand-cyan font-medium">Copy</button>
                    <button onClick={() => setEditing(r)} className="text-text-secondary hover:text-brand-cyan font-medium">Edit</button>
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
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Edit / create modal ──────────────────────────────────────────────────
function LinehaulEditModal({
  run,
  lookups,
  onClose,
  onSaved,
}: {
  run: TenantLinehaulRun | null;
  lookups: LinehaulLookups;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [runName, setRunName] = useState(run?.runName ?? '');
  const [fromDepotId, setFromDepotId] = useState<number>(run?.fromDepotId ?? 0);
  const [toDepotId, setToDepotId] = useState<number>(run?.toDepotId ?? 0);
  const [startTime, setStartTime] = useState(run?.startTime ?? '');
  const [despatchTime, setDespatchTime] = useState(run?.despatchTime ?? '');
  const [courierId, setCourierId] = useState<number>(run?.courierId ?? 0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
        courierId: courierId > 0 ? courierId : null,
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
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-cyan focus:outline-none" />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-text-secondary mb-1">Despatch time</label>
              <input type="time" value={despatchTime} onChange={(e) => setDespatchTime(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-cyan focus:outline-none" />
            </div>
          </div>
          {despatchBeforeStart && <p className="text-[11px] text-amber-600">Despatch time must be at or after the start time.</p>}

          <div>
            <label className="block text-[12.5px] font-medium text-text-secondary mb-1">Default driver</label>
            <select value={courierId} onChange={(e) => setCourierId(Number(e.target.value))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-cyan focus:outline-none">
              <option value={0}>— Unbound —</option>
              {lookups.couriers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
            </select>
            <p className="text-[11px] text-text-secondary mt-1">The run's default driver. Day-by-day overrides live on the Linehaul Roster.</p>
          </div>

          {run && (
            <div>
              <label className="block text-[12.5px] font-medium text-text-secondary mb-1">Used by schedules</label>
              <p className="text-sm text-[#0d0c2c]">
                {run.usedBySchedulesCount === 0
                  ? <span className="text-text-secondary">Not bound to any schedule.</span>
                  : `${run.usedBySchedulesCount} active schedule binding${run.usedBySchedulesCount === 1 ? '' : 's'} (managed in the Schedule editor).`}
              </p>
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
