// ClientType × Feature visibility matrix — DF-Admin-only.
// Backed by GET / PUT /api/admin/client-type-features (Phase 5+31 R2 §2).
//
// Rows = features (grouped by Category: MenuItem / HubTile / …)
// Columns = ClientTypes (Internal / Customer / NetworkPartner / Tenant / DFRNTAdmin)
// Each cell is a toggle. Clicking does an optimistic UI flip + PUT; on
// error the cell reverts and the banner shows the message.
//
// "Visible" semantics: a row in dbo.ClientTypeFeature with Visible=1 means
// the feature is shown to users whose tucClient.ClientTypeId matches.
// Missing rows are treated as Visible=false by the resolver. Toggling an
// absent cell to true UPSERTS a row; toggling true→false either updates
// the row or, for absent cells, inserts Visible=false (the resolver
// excludes both equally).
//
// Important UX note: the resolver's DF-Admin bypass returns the UNION of
// every visible feature key across all ClientTypes. That means toggling a
// feature off for ClientTypeId=5 (DFRNTAdmin) won't change what YOU see
// in the sidebar / tiles — admins always see anything visible anywhere.
// To actually hide a feature from your own view, you'd need to toggle it
// off across every ClientType (or log in as a non-admin user to test).
import { useState, useEffect, useCallback, useMemo } from 'react';
import { featuresApi, type FeatureMatrix, type FeatureMatrixCell } from '@/services/api';

type CellKey = `${number}|${string}`;
const cellKey = (clientTypeId: number, featureKey: string): CellKey =>
  `${clientTypeId}|${featureKey}`;

export default function FeatureMatrixPage() {
  const [data, setData] = useState<FeatureMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-cell save-in-flight set so toggling cell A doesn't block cell B.
  const [busy, setBusy] = useState<Set<CellKey>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const matrix = await featuresApi.getMatrix();
      setData(matrix);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load feature matrix');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Lookup map (ClientTypeId, FeatureKey) → Visible for O(1) cell rendering.
  // Absent entries render as Visible=false.
  const cellLookup = useMemo(() => {
    const m = new Map<CellKey, boolean>();
    if (data) {
      for (const c of data.matrix) {
        m.set(cellKey(c.clientTypeId, c.featureKey), c.visible);
      }
    }
    return m;
  }, [data]);

  // Group features by Category so the table renders MenuItem rows together,
  // then HubTile rows together, etc. Categories without rows are skipped.
  const featuresByCategory = useMemo(() => {
    const groups = new Map<string, FeatureMatrix['features']>();
    if (data) {
      for (const f of data.features) {
        const cat = f.category ?? '(Uncategorised)';
        const existing = groups.get(cat) ?? [];
        existing.push(f);
        groups.set(cat, existing);
      }
    }
    // Sort categories alphabetically; within each, sort features by DisplayName.
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, feats]) => ({
        category: cat,
        features: [...feats].sort((a, b) => a.displayName.localeCompare(b.displayName)),
      }));
  }, [data]);

  const toggleCell = useCallback(async (clientTypeId: number, featureKey: string) => {
    if (!data) return;
    const key = cellKey(clientTypeId, featureKey);
    const wasVisible = cellLookup.get(key) ?? false;
    const nextVisible = !wasVisible;

    // Optimistic local flip — splice the cell into data.matrix (or update
    // the existing row in place).
    setData(prev => {
      if (!prev) return prev;
      const existingIdx = prev.matrix.findIndex(
        c => c.clientTypeId === clientTypeId && c.featureKey === featureKey
      );
      const nextMatrix = [...prev.matrix];
      if (existingIdx >= 0) {
        nextMatrix[existingIdx] = { ...nextMatrix[existingIdx], visible: nextVisible };
      } else {
        nextMatrix.push({ clientTypeId, featureKey, visible: nextVisible });
      }
      return { ...prev, matrix: nextMatrix };
    });
    setBusy(s => { const n = new Set(s); n.add(key); return n; });

    try {
      await featuresApi.setVisibility(clientTypeId, featureKey, nextVisible);
    } catch (e: any) {
      // Revert
      setData(prev => {
        if (!prev) return prev;
        const existingIdx = prev.matrix.findIndex(
          c => c.clientTypeId === clientTypeId && c.featureKey === featureKey
        );
        if (existingIdx < 0) return prev;
        const nextMatrix = [...prev.matrix];
        nextMatrix[existingIdx] = { ...nextMatrix[existingIdx], visible: wasVisible };
        return { ...prev, matrix: nextMatrix };
      });
      setError(e?.message ?? 'Failed to save toggle');
    } finally {
      setBusy(s => { const n = new Set(s); n.delete(key); return n; });
    }
  }, [data, cellLookup]);

  if (loading) {
    return (
      <div className="max-w-5xl">
        <h2 className="text-xl font-bold text-text-primary">Feature Visibility Matrix</h2>
        <p className="text-sm text-text-secondary mt-4">Loading…</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="max-w-5xl">
        <h2 className="text-xl font-bold text-text-primary">Feature Visibility Matrix</h2>
        <p className="text-sm text-red-600 mt-4">{error ?? 'No data loaded.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary">Feature Visibility Matrix</h2>
        <p className="text-sm text-text-secondary mt-1">
          Toggle which features each ClientType can see. Changes save immediately.
        </p>
        <p className="text-xs text-text-muted mt-2">
          Note: as DF Admin you see the union of every visible feature across all ClientTypes,
          so toggles here may not affect your own sidebar/tiles directly — they affect what
          Tenant / NP / Customer users see.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-300 bg-red-50 text-sm text-red-800 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-bold">×</button>
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-text-primary sticky left-0 bg-gray-50 z-10 min-w-[280px]">
                Feature
              </th>
              {data.clientTypes.map(ct => (
                <th key={ct.id} className="text-center px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                  {ct.name}
                  <div className="text-[10px] text-text-muted font-normal">id={ct.id}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featuresByCategory.map(({ category, features }) => (
              <>
                <tr key={`cat-${category}`} className="bg-gray-100">
                  <td colSpan={1 + data.clientTypes.length}
                      className="px-4 py-2 text-xs uppercase tracking-wide text-text-muted font-semibold sticky left-0">
                    {category}
                  </td>
                </tr>
                {features.map(f => (
                  <tr key={f.featureKey} className="border-b border-border hover:bg-gray-50">
                    <td className="px-4 py-3 sticky left-0 bg-white">
                      <div className="text-sm font-medium text-text-primary">{f.displayName}</div>
                      <div className="text-[11px] text-text-muted font-mono">{f.featureKey}</div>
                    </td>
                    {data.clientTypes.map(ct => {
                      const k = cellKey(ct.id, f.featureKey);
                      const visible = cellLookup.get(k) ?? false;
                      const isBusy = busy.has(k);
                      return (
                        <td key={ct.id} className="text-center px-4 py-3">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={visible}
                            aria-label={`${f.displayName} for ${ct.name}`}
                            disabled={isBusy}
                            onClick={() => toggleCell(ct.id, f.featureKey)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/40 ${
                              visible ? 'bg-[#3bc7f4]' : 'bg-gray-300'
                            } ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                visible ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
