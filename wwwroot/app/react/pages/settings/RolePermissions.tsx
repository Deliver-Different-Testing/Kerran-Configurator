// Role × Permission matrix — DF-Admin-only (Unified Permissions §8.3).
// Upgraded from the R3 on/off grid to the graded tri-state model:
//   • rows grouped under tier-1 hub-tile headers (§8.3.2)
//   • tri-state cells None/View/Edit/Action (§8.3.3) cycling on click
//   • ClientType tabs filter the role columns (§8.3.1)
//   • cells display the RESOLVED level (tile grant cascades to children
//     unless a child is set explicitly); explicit cells carry a dot.
//
// Editing writes the GLOBAL DEFAULT row (ClientId IS NULL) via
// PUT /api/admin/role-permissions/{roleId}/{permKey} with accessLevel.
// Per-client overrides exist in the schema/resolver but aren't editable here.
//
// As DF Admin you bypass the matrix at runtime, so toggles here affect the
// target roles' users, not your own access.
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  rolePermissionsApi, rolesApi,
  type RolePermissionMatrix, type ClientTypeRef, type RoleListItem, type ClientRef,
} from '@/services/api';
import { clampAccess, type AccessLevel } from '@/data/accessLevels';
import TriStateCell from '@/components/permissions/TriStateCell';

type CellKey = `${number}|${string}`;
const cellKey = (roleId: number, permKey: string): CellKey => `${roleId}|${permKey}`;

export default function RolePermissionsPage() {
  const [data, setData] = useState<RolePermissionMatrix | null>(null);
  const [clientTypes, setClientTypes] = useState<ClientTypeRef[]>([]);
  const [roleMeta, setRoleMeta] = useState<RoleListItem[]>([]);
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [activeCt, setActiveCt] = useState<number | 'all'>('all');
  // null = editing global defaults; a client id = editing that client's overrides (§8.3.1).
  const [scopeClientId, setScopeClientId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<CellKey>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [matrix, cts, roles, cls] = await Promise.all([
        rolePermissionsApi.getMatrix(),
        rolesApi.clientTypes(),
        rolesApi.list(),
        rolesApi.clients(),
      ]);
      setData(matrix);
      setClientTypes(cts);
      setRoleMeta(roles);
      setClients(cls);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load role-permission matrix');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Explicit levels for the active scope: global defaults (clientId null),
  // overlaid with the selected client's override rows when a client is chosen.
  const explicit = useMemo(() => {
    const m = new Map<CellKey, AccessLevel>();
    if (!data) return m;
    const accessTypeOf = new Map(data.permissions.map(p => [p.permissionKey, p.accessType]));
    const lvlOf = (c: RolePermissionMatrix['matrix'][number]) =>
      clampAccess(c.accessLevel ?? (c.allowed ? (accessTypeOf.get(c.permissionKey) ?? 2) : 0));
    for (const c of data.matrix) if (c.clientId === null) m.set(cellKey(c.contactRoleId, c.permissionKey), lvlOf(c));
    if (scopeClientId != null)
      for (const c of data.matrix) if (c.clientId === scopeClientId) m.set(cellKey(c.contactRoleId, c.permissionKey), lvlOf(c));
    return m;
  }, [data, scopeClientId]);

  // Cells that carry a per-client override row for the selected client (drives
  // the "override" dot — distinct from inherited). Empty in Global mode.
  const overrideKeys = useMemo(() => {
    const s = new Set<CellKey>();
    if (data && scopeClientId != null)
      for (const c of data.matrix) if (c.clientId === scopeClientId) s.add(cellKey(c.contactRoleId, c.permissionKey));
    return s;
  }, [data, scopeClientId]);

  const parentOf = useMemo(() => {
    const m = new Map<string, string | null>();
    data?.permissions.forEach(p => m.set(p.permissionKey, p.parentKey));
    return m;
  }, [data]);

  // Resolved level mirroring the backend (cascade + explicit-None walk-up).
  const resolve = useCallback((roleId: number, key: string): AccessLevel => {
    // walk-up: explicit None ancestor denies
    let anc = parentOf.get(key) ?? null;
    while (anc) {
      const al = explicit.get(cellKey(roleId, anc));
      if (al === 0) return 0;
      anc = parentOf.get(anc) ?? null;
    }
    const own = explicit.get(cellKey(roleId, key));
    if (own !== undefined) return own;
    // cascade from nearest ancestor with an explicit grant
    let p = parentOf.get(key) ?? null;
    while (p) {
      const pl = explicit.get(cellKey(roleId, p));
      if (pl !== undefined) return pl;
      p = parentOf.get(p) ?? null;
    }
    return 0;
  }, [explicit, parentOf]);

  // Build the tier-1 grouped tree for display.
  const groups = useMemo(() => {
    if (!data) return [];
    const tiles = data.permissions
      .filter(p => p.tier === 1 || p.parentKey === null && p.tier === 1)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const leavesByParent = new Map<string, typeof data.permissions>();
    for (const p of data.permissions) {
      if (p.parentKey) {
        const arr = leavesByParent.get(p.parentKey) ?? [];
        arr.push(p);
        leavesByParent.set(p.parentKey, arr);
      }
    }
    const tileKeys = new Set(tiles.map(t => t.permissionKey));
    const orphans = data.permissions.filter(p => p.tier !== 1 && (!p.parentKey || !tileKeys.has(p.parentKey)));
    const result = tiles.map(t => ({
      tile: t,
      children: (leavesByParent.get(t.permissionKey) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    }));
    if (orphans.length) {
      result.push({ tile: null as any, children: orphans.sort((a, b) => a.sortOrder - b.sortOrder) });
    }
    return result;
  }, [data]);

  // Role columns, filtered by the active ClientType tab.
  const roleClientTypes = useMemo(
    () => new Map(roleMeta.map(r => [r.contactRoleId, r.clientTypeIds])),
    [roleMeta],
  );
  const roles = useMemo(() => {
    if (!data) return [];
    if (activeCt === 'all') return data.roles;
    return data.roles.filter(r => (roleClientTypes.get(r.contactRoleId) ?? []).includes(activeCt));
  }, [data, activeCt, roleClientTypes]);

  const setCell = useCallback(async (roleId: number, permKey: string, next: AccessLevel) => {
    const key = cellKey(roleId, permKey);
    // Previous value of the row we're about to write (this scope's row), for revert.
    const prevRow = data?.matrix.find(c => c.contactRoleId === roleId && c.permissionKey === permKey && c.clientId === scopeClientId);
    const prevLevel = prevRow ? clampAccess(prevRow.accessLevel ?? (prevRow.allowed ? 2 : 0)) : undefined;
    const cid = scopeClientId;
    // optimistic — target the row for the ACTIVE scope (null = global, id = override)
    setData(d => {
      if (!d) return d;
      const idx = d.matrix.findIndex(c => c.contactRoleId === roleId && c.permissionKey === permKey && c.clientId === cid);
      const matrix = [...d.matrix];
      if (idx >= 0) matrix[idx] = { ...matrix[idx], accessLevel: next, allowed: next >= 1 };
      else matrix.push({ contactRoleId: roleId, permissionKey: permKey, allowed: next >= 1, accessLevel: next, clientId: cid });
      return { ...d, matrix };
    });
    setBusy(s => new Set(s).add(key));
    try {
      await rolePermissionsApi.setPermission(roleId, permKey, next, cid);
    } catch (e: any) {
      setData(d => {
        if (!d) return d;
        const idx = d.matrix.findIndex(c => c.contactRoleId === roleId && c.permissionKey === permKey && c.clientId === cid);
        if (idx < 0) return d;
        const matrix = [...d.matrix];
        matrix[idx] = { ...matrix[idx], accessLevel: prevLevel ?? 0, allowed: (prevLevel ?? 0) >= 1 };
        return { ...d, matrix };
      });
      setError(e?.message ?? 'Failed to save');
    } finally {
      setBusy(s => { const n = new Set(s); n.delete(key); return n; });
    }
  }, [data, scopeClientId]);

  // Dot marker: in Global mode = explicitly-set cell; in client mode = a
  // per-client override (differs from / overrides the global default).
  const isExplicit = useCallback(
    (k: CellKey) => (scopeClientId == null ? explicit.has(k) : overrideKeys.has(k)),
    [scopeClientId, explicit, overrideKeys],
  );

  if (loading) return <div><h2 className="text-xl font-bold text-text-primary">Role Permissions Matrix</h2><p className="text-sm text-text-secondary mt-4">Loading…</p></div>;
  if (!data) return <div><h2 className="text-xl font-bold text-text-primary">Role Permissions Matrix</h2><p className="text-sm text-red-600 mt-4">{error ?? 'No data loaded.'}</p></div>;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-text-primary">Role Permissions Matrix</h2>
        <p className="text-sm text-text-secondary mt-1">
          Set what each role can do per hub tile. Cells show the resolved level — a tile grant
          cascades to its items unless an item is set lower. Changes save immediately.
        </p>
        <p className="text-xs text-text-muted mt-2">
          {scopeClientId == null
            ? 'Editing GLOBAL DEFAULTS. As DF Admin you bypass the matrix at runtime, so these toggles affect the target roles’ users, not your own access.'
            : `Editing OVERRIDES for ${clients.find(c => c.id === scopeClientId)?.name ?? `client ${scopeClientId}`}. Cells without an override (no dot) inherit the global default; setting a cell writes a per-client override.`}
        </p>
      </div>

      {/* Per-client override overlay (§8.3.1) */}
      <div className="flex items-center gap-2 mb-3">
        <label className="text-sm text-text-secondary">Scope:</label>
        <select
          value={scopeClientId ?? ''}
          onChange={e => setScopeClientId(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-1.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/40"
        >
          <option value="">Global Default</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {scopeClientId != null && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Per-client overrides</span>
        )}
      </div>

      {/* ClientType tabs (§8.3.1) — filter role COLUMNS. The spec's row-filter
          half (hide permission rows per ClientTypeFeature) was DROPPED by Steve
          2026-06-05: permission tier-1 tiles ≠ the Feature catalog, and column
          filtering is the useful part. Do not re-add row-filtering. */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setActiveCt('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium ${activeCt === 'all' ? 'bg-[#3bc7f4] text-white' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'}`}
        >All ClientTypes</button>
        {clientTypes.map(ct => (
          <button
            key={ct.id}
            onClick={() => setActiveCt(ct.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${activeCt === ct.id ? 'bg-[#3bc7f4] text-white' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'}`}
          >{ct.name}</button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-300 bg-red-50 text-sm text-red-800 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-bold">×</button>
        </div>
      )}

      {roles.length === 0 ? (
        <p className="text-sm text-text-muted">No roles apply to this ClientType.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-text-primary sticky left-0 bg-gray-50 z-10 min-w-[280px]">Permission</th>
                {roles.map(r => (
                  <th key={r.contactRoleId} className="text-center px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                    {r.name}
                    <div className="text-[10px] text-text-muted font-normal">id={r.contactRoleId}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(({ tile, children }) => (
                <>
                  {tile && (
                    <tr key={`tile-${tile.permissionKey}`} className="bg-gray-100 border-b border-border">
                      <td className="px-4 py-2 font-semibold text-text-primary uppercase tracking-wide text-xs sticky left-0 bg-gray-100">
                        {tile.displayName}
                      </td>
                      {roles.map(r => (
                        <td key={r.contactRoleId} className="text-center px-3 py-2">
                          <TriStateCell
                            level={resolve(r.contactRoleId, tile.permissionKey)}
                            accessType={tile.accessType}
                            explicit={isExplicit(cellKey(r.contactRoleId, tile.permissionKey))}
                            busy={busy.has(cellKey(r.contactRoleId, tile.permissionKey))}
                            label={`${tile.displayName} for ${r.name}`}
                            onChange={(next) => setCell(r.contactRoleId, tile.permissionKey, next)}
                          />
                        </td>
                      ))}
                    </tr>
                  )}
                  {children.map(p => (
                    <tr key={p.permissionKey} className="border-b border-border hover:bg-gray-50">
                      <td className="px-4 py-3 sticky left-0 bg-white">
                        <div className="text-sm font-medium text-text-primary pl-4">{p.displayName}</div>
                        <div className="text-[11px] text-text-muted font-mono pl-4">{p.permissionKey}</div>
                      </td>
                      {roles.map(r => (
                        <td key={r.contactRoleId} className="text-center px-3 py-3">
                          <TriStateCell
                            level={resolve(r.contactRoleId, p.permissionKey)}
                            accessType={p.accessType}
                            explicit={isExplicit(cellKey(r.contactRoleId, p.permissionKey))}
                            busy={busy.has(cellKey(r.contactRoleId, p.permissionKey))}
                            label={`${p.displayName} for ${r.name}`}
                            onChange={(next) => setCell(r.contactRoleId, p.permissionKey, next)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-text-muted mt-3">
        Pill: None (grey) · View (blue) · Edit (green) · Action (purple). Click a cell to cycle.
        The amber dot marks a cell set explicitly — {scopeClientId == null ? 'not inherited from its hub tile' : 'a per-client override of the global default'}.
      </p>
    </div>
  );
}
