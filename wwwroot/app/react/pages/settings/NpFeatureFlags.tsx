// Per-NP Feature Flags — DF-Admin-only.
// Backed by GET/PUT /api/v1/np/feature-config (Phase 5+26).
// Toggle = immediate optimistic save; on error the row reverts and the
// banner shows the message. NPs without an explicit config row are
// rendered with a * after the name and saved on first toggle (the backend
// upserts).
import { useState, useEffect, useCallback } from 'react';
import { npFeatureConfigService } from '@/services/np_featureConfigService';
import type { NpFeatureConfig, NpFeatureConfigUpsert } from '@/types';

type GateKey = keyof NpFeatureConfigUpsert;

interface GateDef {
  key: GateKey;
  short: string;        // column header
  label: string;        // tooltip / aria
}

const GATES: GateDef[] = [
  { key: 'canCreateTasks',      short: 'Tasks',       label: 'Can create tasks' },
  { key: 'canAddStops',         short: 'Stops',       label: 'Can add stops to jobs' },
  { key: 'canSeeFlightInfo',    short: 'Flight',      label: 'Can see flight info' },
  { key: 'canAccessScheduler',  short: 'Scheduler',   label: 'Can access the scheduler' },
  { key: 'canManageApplicants', short: 'Applicants',  label: 'Can manage recruitment applicants' },
  { key: 'multiClientEnabled',  short: 'Multi-Client', label: 'Multi-client enabled' },
  { key: 'autoDispatchEnabled', short: 'Auto-Disp.',  label: 'Auto-dispatch enabled' },
];

function MiniToggle({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/40 ${
        checked ? 'bg-[#3bc7f4]' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function NpFeatureFlags() {
  const [rows, setRows] = useState<NpFeatureConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tracks per-(agentId, key) save-in-flight so the toggle is disabled
  // while the PUT is running. Allows simultaneous edits across different
  // rows / different gates without blocking the whole table.
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await npFeatureConfigService.list();
      setRows(data);
    } catch (e: any) {
      setError(e?.response?.data?.messages?.[0]?.message || e?.message || 'Failed to load feature configs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async (row: NpFeatureConfig, key: GateKey) => {
    const busyKey = `${row.agentId}::${key}`;
    const prev = row;
    // Optimistic local flip.
    const nextRow: NpFeatureConfig = { ...row, [key]: !row[key], hasConfigRow: true };
    setRows(rs => rs.map(r => r.agentId === row.agentId ? nextRow : r));
    setBusy(s => { const n = new Set(s); n.add(busyKey); return n; });

    try {
      const payload: NpFeatureConfigUpsert = {
        canCreateTasks: nextRow.canCreateTasks,
        canAddStops: nextRow.canAddStops,
        canSeeFlightInfo: nextRow.canSeeFlightInfo,
        canAccessScheduler: nextRow.canAccessScheduler,
        canManageApplicants: nextRow.canManageApplicants,
        multiClientEnabled: nextRow.multiClientEnabled,
        autoDispatchEnabled: nextRow.autoDispatchEnabled,
      };
      const saved = await npFeatureConfigService.upsert(row.agentId, payload);
      setRows(rs => rs.map(r => r.agentId === row.agentId ? saved : r));
    } catch (e: any) {
      // Revert + surface the message.
      setRows(rs => rs.map(r => r.agentId === row.agentId ? prev : r));
      setError(e?.response?.data?.messages?.[0]?.message || e?.message || 'Failed to save toggle');
    } finally {
      setBusy(s => { const n = new Set(s); n.delete(busyKey); return n; });
    }
  }, []);

  const explicitCount = rows.filter(r => r.hasConfigRow).length;
  const defaultCount = rows.length - explicitCount;

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Per-NP Feature Flags</h2>
          <p className="text-sm text-text-secondary mt-1">
            Toggle features per network partner. Toggling saves immediately.{' '}
            <span className="text-text-muted">
              NPs marked with <span className="font-mono">*</span> have no explicit config row — shown values are schema defaults; first toggle promotes them to an explicit row.
            </span>
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-sm text-text-muted hover:text-text-secondary px-3 py-1.5 rounded border border-border hover:border-border-hover transition-colors shrink-0 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800 flex items-start justify-between gap-3">
          <div>
            <span className="font-semibold">Error:</span> {error}
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 font-bold text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-text-muted p-8 text-center">Loading network partners…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-text-muted p-8 text-center border border-border rounded-lg bg-white">
          No network partners found for this tenant.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border border-border rounded-lg bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-light">
                  <th className="text-left px-4 py-3 font-semibold text-text-primary sticky left-0 bg-surface-light z-10">Network Partner</th>
                  {GATES.map(g => (
                    <th key={g.key} className="text-center px-3 py-3 font-semibold text-text-primary whitespace-nowrap" title={g.label}>
                      {g.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.agentId} className="border-b border-border last:border-0 hover:bg-[#f4f2f1]/50 transition-colors">
                    <td className="px-4 py-3 sticky left-0 bg-white z-10">
                      <div className="font-medium text-text-primary">
                        {row.agentName || `Agent #${row.agentId}`}
                        {!row.hasConfigRow && (
                          <span className="ml-1 text-text-muted font-mono" title="No explicit config row — showing schema defaults">*</span>
                        )}
                      </div>
                      <div className="text-xs text-text-muted">
                        ID {row.agentId}
                        {row.updatedDate && (
                          <span className="ml-2">· Updated {new Date(row.updatedDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    </td>
                    {GATES.map(g => {
                      const busyKey = `${row.agentId}::${g.key}`;
                      return (
                        <td key={g.key} className="px-3 py-3 text-center">
                          <MiniToggle
                            checked={row[g.key]}
                            onChange={() => toggle(row, g.key)}
                            disabled={busy.has(busyKey)}
                            ariaLabel={`${g.label} for ${row.agentName}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-xs text-text-muted">
            {rows.length} network partner{rows.length === 1 ? '' : 's'} ·{' '}
            {explicitCount} explicit row{explicitCount === 1 ? '' : 's'}
            {defaultCount > 0 && <> · {defaultCount} on schema defaults</>}
          </div>
        </>
      )}
    </div>
  );
}
