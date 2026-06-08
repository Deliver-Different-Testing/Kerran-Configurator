// ClientType × Feature visibility matrix — DF-Admin-only.
// Backed by GET / PUT /api/admin/client-type-features (Phase 5+31 R2 §2).
//
// Layout: cascade tree (Steve 2026-06-07).
//   Root tier (HubTile)
//     └── MenuItem
//          └── Tab
//               └── Item / Feature / Leaf row
//
// The tree is built from the flat feature list using `parentKey`. The schema
// supports arbitrary depth via Permission.ParentKey + Permission.Tier — see
// PERMISSIONS-UNIFIED-ARCHITECTURE-SPEC §4.2. That means AdminManager's
// 4-tier shape (Business → System → Location Management → Zipcodes) lands
// naturally without any UI special-casing.
//
// Backward compatibility: when no feature in the response has parentKey set
// the UI falls back to the legacy flat-by-Category rendering. That lets the
// backend roll cascade data out one tile at a time without breaking the page.
//
// "Visible" semantics (unchanged): a row in dbo.ClientTypeFeature with
// Visible=1 means the feature is shown to users whose tucClient.ClientTypeId
// matches. Missing rows are treated as Visible=false by the resolver.
//
// DF-Admin UX note: the resolver's admin bypass returns the UNION of every
// visible feature key across all ClientTypes, so toggling a feature off for
// ClientTypeId=5 (DFRNTAdmin) won't change what YOU see in the sidebar —
// admins always see anything visible anywhere. To verify a hide, log in as
// a non-admin user.
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { featuresApi, type FeatureMatrix, type FeatureMatrixFeature } from '@/services/api';

type CellKey = `${number}|${string}`;
const cellKey = (clientTypeId: number, featureKey: string): CellKey =>
  `${clientTypeId}|${featureKey}`;

// DFRNTAdmin (ClientTypeId=5) bypasses Feature resolution entirely at runtime
// (ClientTypeFeatureResolver — admins see the union of every visible feature),
// so its matrix column has no enforcement effect. We hide it to remove the
// footgun of toggling a column that does nothing. ClientType=5 rows still exist
// in the DB; they're just not editable here.
const DFRNT_ADMIN_CLIENT_TYPE = 5;

// Editable country-scope cell (SEED-SCOPE-ALL-HUBS §2). Free-text comma list of
// ISO codes (e.g. "NZ" or "NZ,AU"); blank = available everywhere. Saves on blur
// / Enter, only when changed. Local state so typing doesn't thrash the matrix.
function CountriesCell({ value, featureKey, onSave }: {
  value: string | null;
  featureKey: string;
  onSave: (featureKey: string, value: string | null) => void;
}) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => { setText(value ?? ''); }, [value]);
  const commit = () => {
    const next = text.trim() === '' ? null : text.trim();
    if (next !== (value ?? null)) onSave(featureKey, next);
  };
  return (
    <td className="px-3 py-2 border-b border-border">
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder="All"
        title="Comma list of ISO country codes (e.g. NZ or NZ,AU). Blank = available everywhere."
        className="w-20 px-2 py-1 text-xs rounded border border-border focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/40"
      />
    </td>
  );
}

interface TreeNode {
  feature: FeatureMatrixFeature;
  depth: number;
  children: TreeNode[];
}

// Build a forest from the flat feature list using parentKey. Orphans whose
// parentKey doesn't resolve to a known feature surface at the root tier so
// nothing is hidden by a data inconsistency.
function buildTree(features: FeatureMatrixFeature[]): TreeNode[] {
  const byKey = new Map<string, FeatureMatrixFeature>();
  for (const f of features) byKey.set(f.featureKey, f);

  const nodes = new Map<string, TreeNode>();
  for (const f of features) {
    nodes.set(f.featureKey, { feature: f, depth: 0, children: [] });
  }

  const roots: TreeNode[] = [];
  for (const f of features) {
    const node = nodes.get(f.featureKey)!;
    const parentKey = f.parentKey ?? null;
    if (parentKey && byKey.has(parentKey)) {
      nodes.get(parentKey)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const setDepth = (n: TreeNode, depth: number) => {
    n.depth = depth;
    n.children.sort(sortNodes);
    for (const c of n.children) setDepth(c, depth + 1);
  };
  roots.sort(sortNodes);
  for (const r of roots) setDepth(r, 0);
  return roots;
}

function sortNodes(a: TreeNode, b: TreeNode): number {
  const so = (a.feature.sortOrder ?? 0) - (b.feature.sortOrder ?? 0);
  if (so !== 0) return so;
  return a.feature.displayName.localeCompare(b.feature.displayName);
}

// Pre-order flatten honouring expanded state. A node appears in the output
// iff every ancestor is expanded (root nodes always appear).
function flattenVisible(roots: TreeNode[], expanded: Set<string>): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children.length > 0 && expanded.has(n.feature.featureKey)) {
        walk(n.children);
      }
    }
  };
  walk(roots);
  return out;
}

function collectKeys(roots: TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (n.children.length > 0) out.push(n.feature.featureKey);
      walk(n.children);
    }
  };
  walk(roots);
  return out;
}

export default function FeatureMatrixPage() {
  const [data, setData] = useState<FeatureMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-cell save-in-flight set so toggling cell A doesn't block cell B.
  const [busy, setBusy] = useState<Set<CellKey>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  // Cascade mode is engaged when at least one feature reports a parentKey —
  // we treat that as the backend opting in. Otherwise fall back to the
  // legacy flat-by-Category layout so a partial backend rollout still works.
  const hasCascade = useMemo(
    () => !!data && data.features.some(f => f.parentKey),
    [data]
  );

  const tree = useMemo<TreeNode[]>(() => {
    if (!data || !hasCascade) return [];
    return buildTree(data.features);
  }, [data, hasCascade]);

  // Default: top tier expanded so the page doesn't open as a wall of
  // collapsed roots. Re-runs whenever a fresh response arrives.
  useEffect(() => {
    if (!hasCascade) return;
    setExpanded(prev => {
      if (prev.size > 0) return prev;
      const next = new Set<string>();
      for (const root of tree) {
        if (root.children.length > 0) next.add(root.feature.featureKey);
      }
      return next;
    });
  }, [hasCascade, tree]);

  const flatRows = useMemo(
    () => (hasCascade ? flattenVisible(tree, expanded) : []),
    [hasCascade, tree, expanded]
  );

  // Legacy fallback: group features by Category for tenants/environments
  // whose backend hasn't surfaced ParentKey yet.
  const featuresByCategory = useMemo(() => {
    if (!data || hasCascade) return [];
    const groups = new Map<string, FeatureMatrix['features']>();
    for (const f of data.features) {
      const cat = f.category ?? '(Uncategorised)';
      const existing = groups.get(cat) ?? [];
      existing.push(f);
      groups.set(cat, existing);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, feats]) => ({
        category: cat,
        features: [...feats].sort((a, b) => a.displayName.localeCompare(b.displayName)),
      }));
  }, [data, hasCascade]);

  const toggleExpanded = useCallback((featureKey: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(featureKey)) next.delete(featureKey);
      else next.add(featureKey);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(collectKeys(tree)));
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const toggleCell = useCallback(async (clientTypeId: number, featureKey: string) => {
    if (!data) return;
    const nextVisible = !(cellLookup.get(cellKey(clientTypeId, featureKey)) ?? false);

    // Cascade: toggling a parent applies the same visibility to ALL its
    // descendants in this column, so the admin doesn't have to click each child.
    // A leaf has no descendants, so targets = [itself] and this behaves as a
    // plain single-cell toggle. (Feature visibility is stored per cell — there's
    // no read-time cascade — so we write each descendant's row explicitly.)
    const childrenByParent = new Map<string, string[]>();
    for (const f of data.features) if (f.parentKey) {
      const a = childrenByParent.get(f.parentKey) ?? []; a.push(f.featureKey); childrenByParent.set(f.parentKey, a);
    }
    const targets: string[] = [];
    const walk = (k: string) => { targets.push(k); for (const c of childrenByParent.get(k) ?? []) walk(c); };
    walk(featureKey);

    // Remember prior visibility per target for revert on failure.
    const prior = new Map(targets.map(k => [k, cellLookup.get(cellKey(clientTypeId, k)) ?? false]));

    // Optimistic: set every target cell in this column to nextVisible.
    setData(prev => {
      if (!prev) return prev;
      const matrix = [...prev.matrix];
      for (const k of targets) {
        const idx = matrix.findIndex(c => c.clientTypeId === clientTypeId && c.featureKey === k);
        if (idx >= 0) matrix[idx] = { ...matrix[idx], visible: nextVisible };
        else matrix.push({ clientTypeId, featureKey: k, visible: nextVisible });
      }
      return { ...prev, matrix };
    });
    setBusy(s => { const n = new Set(s); for (const k of targets) n.add(cellKey(clientTypeId, k)); return n; });

    const results = await Promise.allSettled(
      targets.map(k => featuresApi.setVisibility(clientTypeId, k, nextVisible))
    );

    // Revert only the cells whose PUT failed.
    const failed = targets.filter((_, i) => results[i].status === 'rejected');
    if (failed.length) {
      setData(prev => {
        if (!prev) return prev;
        const matrix = [...prev.matrix];
        for (const k of failed) {
          const idx = matrix.findIndex(c => c.clientTypeId === clientTypeId && c.featureKey === k);
          if (idx >= 0) matrix[idx] = { ...matrix[idx], visible: prior.get(k) ?? false };
        }
        return { ...prev, matrix };
      });
      setError(`Failed to save ${failed.length} of ${targets.length} toggle${targets.length === 1 ? '' : 's'}.`);
    }
    setBusy(s => { const n = new Set(s); for (const k of targets) n.delete(cellKey(clientTypeId, k)); return n; });
  }, [data, cellLookup]);

  // Save a feature's country scope (SEED-SCOPE-ALL-HUBS §2). Optimistic update
  // of the feature row; revert on error. Per-feature, not per-ClientType.
  const saveCountries = useCallback(async (featureKey: string, value: string | null) => {
    const prev = data?.features.find(f => f.featureKey === featureKey)?.availableCountries ?? null;
    setData(d => d ? { ...d, features: d.features.map(f => f.featureKey === featureKey ? { ...f, availableCountries: value } : f) } : d);
    try {
      await featuresApi.setAvailableCountries(featureKey, value);
    } catch (e: any) {
      setData(d => d ? { ...d, features: d.features.map(f => f.featureKey === featureKey ? { ...f, availableCountries: prev } : f) } : d);
      setError(e?.message ?? 'Failed to save country scope');
    }
  }, [data]);

  if (loading) {
    return (
      <div>
        <h2 className="text-xl font-bold text-text-primary">Feature Visibility Matrix</h2>
        <p className="text-sm text-text-secondary mt-4">Loading…</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <h2 className="text-xl font-bold text-text-primary">Feature Visibility Matrix</h2>
        <p className="text-sm text-red-600 mt-4">{error ?? 'No data loaded.'}</p>
      </div>
    );
  }

  // Columns shown in the grid — the DFRNTAdmin column is omitted (see note by
  // DFRNT_ADMIN_CLIENT_TYPE: admins bypass at runtime, so the column is inert).
  const clientTypes = data.clientTypes.filter(ct => ct.id !== DFRNT_ADMIN_CLIENT_TYPE);

  const renderCells = (f: FeatureMatrixFeature) => (
    <>
      {clientTypes.map(ct => {
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
    </>
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary">Feature Visibility Matrix</h2>
        <p className="text-sm text-text-secondary mt-1">
          Toggle which features each ClientType can see. Changes save immediately.
          Toggling a parent cascades to all its children in that column.
        </p>
      </div>

      <div className="mb-4 p-3 rounded-lg border border-sky-200 bg-sky-50 text-sm text-sky-900 flex items-start gap-2">
        <span aria-hidden className="mt-0.5">ℹ️</span>
        <span>
          <strong>DFRNT Admins see every feature</strong> regardless of these toggles — admin
          access is granted at runtime (bypass), not by this matrix. The <em>DFRNTAdmin</em> column
          is hidden here because toggling it has no effect. These switches control what
          <strong> Tenant, Network Partner and Customer</strong> users see.
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-300 bg-red-50 text-sm text-red-800 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-bold">×</button>
        </div>
      )}

      {hasCascade && (
        <div className="mb-3 flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={expandAll}
            className="px-2 py-1 rounded border border-border text-text-secondary hover:bg-gray-50"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2 py-1 rounded border border-border text-text-secondary hover:bg-gray-50"
          >
            Collapse all
          </button>
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-text-primary sticky left-0 bg-gray-50 z-10 min-w-[320px]">
                Feature
              </th>
              {clientTypes.map(ct => (
                <th key={ct.id} className="text-center px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                  {ct.name}
                  <div className="text-[10px] text-text-muted font-normal">id={ct.id}</div>
                </th>
              ))}
              <th className="text-left px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                Countries
                <div className="text-[10px] text-text-muted font-normal">blank = all</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {hasCascade
              ? flatRows.map(node => {
                  const f = node.feature;
                  const hasChildren = node.children.length > 0;
                  const isOpen = expanded.has(f.featureKey);
                  // Indent per tier; first level (depth=0) sits flush. Chevron
                  // column always reserves its 18px so leaf rows line up under
                  // the parent's caret rather than shifting left.
                  const indentPx = node.depth * 18;
                  return (
                    <tr key={f.featureKey} className="border-b border-border hover:bg-gray-50">
                      <td className="px-4 py-3 sticky left-0 bg-white">
                        <div className="flex items-start gap-1" style={{ paddingLeft: indentPx }}>
                          <button
                            type="button"
                            onClick={() => hasChildren && toggleExpanded(f.featureKey)}
                            className={`mt-[2px] w-[18px] text-[11px] text-text-muted ${hasChildren ? 'cursor-pointer hover:text-text-primary' : 'cursor-default opacity-0'}`}
                            aria-expanded={hasChildren ? isOpen : undefined}
                            aria-label={hasChildren ? (isOpen ? 'Collapse' : 'Expand') : undefined}
                            tabIndex={hasChildren ? 0 : -1}
                          >
                            {hasChildren ? (isOpen ? '▾' : '▸') : '·'}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm ${node.depth === 0 ? 'font-semibold text-text-primary' : 'font-medium text-text-primary'}`}>
                              {f.displayName}
                              {hasChildren && (
                                <span className="ml-2 text-[10px] uppercase tracking-wide text-text-muted font-normal">
                                  {node.children.length} child{node.children.length === 1 ? '' : 'ren'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-text-muted font-mono truncate">{f.featureKey}</div>
                            {f.description && (
                              <div className="text-[11px] text-text-secondary mt-0.5">{f.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      {renderCells(f)}
                      <CountriesCell value={f.availableCountries ?? null} featureKey={f.featureKey} onSave={saveCountries} />
                    </tr>
                  );
                })
              : featuresByCategory.map(({ category, features }) => (
                  <Fragment key={`cat-${category}`}>
                    <tr className="bg-gray-100">
                      <td colSpan={2 + clientTypes.length}
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
                        {renderCells(f)}
                        <CountriesCell value={f.availableCountries ?? null} featureKey={f.featureKey} onSave={saveCountries} />
                      </tr>
                    ))}
                  </Fragment>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
