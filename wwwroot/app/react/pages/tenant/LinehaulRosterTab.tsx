import { useCallback, useEffect, useMemo, useState } from 'react';
import { RosterPickerModal } from '@/components/tenant/RosterPickerModal';
import { TargetTypeChip } from '@/components/tenant/TargetTypeChip';
import { AssignTargetValue } from '@/components/common/AssignTargetPicker';
import { routeService, AssignableTargets } from '@/services/tenant_routeService';
import {
  linehaulService,
  extractLinehaulError,
  LinehaulRosterGrid,
  LinehaulRosterRow,
} from '@/services/tenant_linehaulService';

// ─── Linehaul Roster tab (Recurring Routes spec §4 + Fixes §6) ─────────────
// Run × Day target grid backed by Dispatch_LinehaulRunRoster. Each cell can be
// a Courier, Agent, or Network Partner (Fixes §6), recurring weekly (1=Mon..7=Sun)
// in v1. Editing a cell never touches the run's own default target.

const DAYS: { dow: number; label: string }[] = [
  { dow: 1, label: 'Mon' },
  { dow: 2, label: 'Tue' },
  { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' },
  { dow: 5, label: 'Fri' },
  { dow: 6, label: 'Sat' },
  { dow: 7, label: 'Sun' },
];

export function LinehaulRosterTab() {
  const [grid, setGrid] = useState<LinehaulRosterGrid | null>(null);
  const [targets, setTargets] = useState<AssignableTargets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ runId: number; dow: number } | null>(null);

  // filters
  const [runSearch, setRunSearch] = useState('');
  const [driverFilter, setDriverFilter] = useState<number>(0);   // 0 = all (courier match)
  const [activeOnly, setActiveOnly] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, t] = await Promise.all([linehaulService.rosterGrid(), routeService.getAssignableTargets()]);
      setGrid(g);
      setTargets(t);
    } catch (e: unknown) {
      setError(extractLinehaulError(e, 'Failed to load roster'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const rows = useMemo(() => {
    if (!grid) return [];
    const q = runSearch.trim().toLowerCase();
    return grid.rows.filter((r) => {
      if (activeOnly && !r.active) return false;
      if (q && !r.runName.toLowerCase().includes(q)) return false;
      if (driverFilter > 0 && !r.cells.some((c) => c.courierId === driverFilter)) return false;
      return true;
    });
  }, [grid, runSearch, driverFilter, activeOnly]);

  const saveCell = async (row: LinehaulRosterRow, dow: number, value: AssignTargetValue | null) => {
    const cell = row.cells.find((c) => c.dayOfWeek === dow) ?? null;
    setEditing(null);
    try {
      if (value === null) {
        if (cell) await linehaulService.deleteRosterCell(cell.rosterId);
        else return;   // nothing to clear
      } else {
        if (cell && cell.targetType === value.type && cell.targetId === value.id) return;   // no change
        await linehaulService.upsertRosterCell({ linehaulRunId: row.runId, dayOfWeek: dow, targetType: value.type, targetId: value.id });
      }
      await refresh();
    } catch (e: unknown) {
      setError(extractLinehaulError(e, 'Failed to update roster cell'));
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-border bg-white p-10 text-center text-sm text-text-secondary">Loading roster…</div>;
  }

  const editRow = editing ? grid?.rows.find((r) => r.runId === editing.runId) ?? null : null;
  const editCell = editRow && editing ? editRow.cells.find((c) => c.dayOfWeek === editing.dow) ?? null : null;
  // Pre-fill the picker with the cell's current target, else the run's default
  // target (AR-Fix6.2 — first edit pre-fills with the run default, whichever type).
  const editValue: AssignTargetValue | null = editCell?.targetType && editCell?.targetId
    ? { type: editCell.targetType, id: editCell.targetId }
    : (editRow?.defaultTargetType && editRow?.defaultTargetId
        ? { type: editRow.defaultTargetType, id: editRow.defaultTargetId }
        : null);

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input value={runSearch} onChange={(e) => setRunSearch(e.target.value)} placeholder="Search runs…"
          className="border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-cyan focus:outline-none w-56" />
        <select value={driverFilter} onChange={(e) => setDriverFilter(Number(e.target.value))}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-cyan focus:outline-none">
          <option value={0}>All drivers</option>
          {grid?.couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="w-4 h-4 accent-brand-cyan" />
          Active runs only
        </label>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        {(grid?.rows.length ?? 0) === 0 ? (
          <div className="p-10 text-center text-sm text-text-secondary">
            No linehaul runs yet — create one on the <strong>Linehaul</strong> tab first.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-text-secondary">No runs match the current filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border">
              <tr className="text-left text-[12.5px] font-semibold text-text-secondary">
                <th className="px-4 py-3 min-w-[200px]">Run</th>
                {DAYS.map((d) => <th key={d.dow} className="px-3 py-3 text-center min-w-[130px]">{d.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.runId} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-[#0d0c2c]">{row.runName}</div>
                    <div className="text-[11px] text-text-secondary">{row.fromDepotName || '—'} → {row.toDepotName || '—'}</div>
                  </td>
                  {DAYS.map((d) => {
                    const cell = row.cells.find((c) => c.dayOfWeek === d.dow) ?? null;
                    return (
                      <td key={d.dow} className="px-3 py-2 text-center border-l border-border/50">
                        <button
                          onClick={() => setEditing({ runId: row.runId, dow: d.dow })}
                          className={`w-full rounded-md px-2 py-1.5 text-[12.5px] transition-colors flex items-center justify-center gap-1.5 ${
                            cell?.targetName ? 'text-[#0d0c2c] hover:bg-cyan-50' : 'text-text-secondary hover:bg-slate-50'
                          }`}
                          title="Click to assign a Courier / Agent / NP"
                        >
                          {cell?.targetName ? (
                            <>
                              <span>{cell.targetName}</span>
                              {cell.targetType && <TargetTypeChip type={cell.targetType} />}
                            </>
                          ) : '—'}
                          <span className="text-text-secondary text-[10px]">▾</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && editRow && (
        <RosterPickerModal
          title={`${editRow.runName} — ${DAYS.find((x) => x.dow === editing.dow)?.label} assignment`}
          targets={targets}
          value={editValue}
          onClose={() => setEditing(null)}
          onSave={(v) => saveCell(editRow, editing.dow, v)}
        />
      )}

      <p className="text-[12px] text-text-secondary">
        Recurring weekly roster. Editing a cell does not change the run's own default target — set that on the Linehaul tab.
        Date-specific overrides arrive in a later update.
      </p>
    </div>
  );
}
