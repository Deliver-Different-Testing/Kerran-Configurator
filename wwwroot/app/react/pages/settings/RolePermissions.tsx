// Role × Permission visibility matrix — DF-Admin-only.
// Backed by GET / PUT /api/admin/role-permissions (Phase 5+31 R3).
//
// Rows = permissions (grouped by Category: View / Action / Manage / …)
// Columns = roles (NpAdmin / NpDispatcher / NpReadOnly, sorted by ContactRoleId)
// Each cell is a toggle bound to the GLOBAL DEFAULT row for that
// (ContactRoleId, PermissionKey) pair (ClientId IS NULL). Per-client
// overrides exist in the schema + resolver but the UI doesn't expose
// them yet — first iteration is DF admin editing global defaults.
//
// Click = optimistic UI flip + PUT { allowed, clientId: null }; on error
// the cell reverts and the banner shows the message.
//
// "Allowed" semantics: a RolePermission row with Allowed=1 (global
// default) means the role gets that permission. Allowed=0 explicitly
// denies (useful for per-client overrides; rarely needed on global
// defaults). Missing row defaults to Allowed=false at the resolver.
//
// Important UX note: as DF Admin you bypass the matrix at runtime (the
// resolver returns the full catalog), so toggles here won't change your
// own enforcement — they affect NpAdmin / NpDispatcher / NpReadOnly users.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { rolePermissionsApi, type RolePermissionMatrix, type RolePermissionCellDto } from '@/services/api';

type CellKey = `${number}|${string}`;
const cellKey = (contactRoleId: number, permissionKey: string): CellKey =>
  `${contactRoleId}|${permissionKey}`;

export default function RolePermissionsPage() {
  const [data, setData] = useState<RolePermissionMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-cell save-in-flight set so toggling cell A doesn't block cell B.
  const [busy, setBusy] = useState<Set<CellKey>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const matrix = await rolePermissionsApi.getMatrix();
      setData(matrix);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load role-permission matrix');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Lookup of GLOBAL DEFAULT rows only (ClientId IS NULL). Per-client
  // override rows in data.matrix are ignored by this UI for now.
  const globalLookup = useMemo(() => {
    const m = new Map<CellKey, boolean>();
    if (data) {
      for (const c of data.matrix) {
        if (c.clientId === null) {
          m.set(cellKey(c.contactRoleId, c.permissionKey), c.allowed);
        }
      }
    }
    return m;
  }, [data]);

  // Group permissions by Category for visual structure (View / Action / Manage).
  const permissionsByCategory = useMemo(() => {
    const groups = new Map<string, RolePermissionMatrix['permissions']>();
    if (data) {
      for (const p of data.permissions) {
        const cat = p.category ?? '(Uncategorised)';
        const existing = groups.get(cat) ?? [];
        existing.push(p);
        groups.set(cat, existing);
      }
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, perms]) => ({
        category: cat,
        permissions: [...perms].sort((a, b) => a.displayName.localeCompare(b.displayName)),
      }));
  }, [data]);

  const toggleCell = useCallback(async (contactRoleId: number, permissionKey: string) => {
    if (!data) return;
    const key = cellKey(contactRoleId, permissionKey);
    const wasAllowed = globalLookup.get(key) ?? false;
    const nextAllowed = !wasAllowed;

    // Optimistic local flip — upsert into data.matrix as a global-default
    // row (clientId=null). If a global row already exists for this cell,
    // update Allowed in place; otherwise append.
    setData(prev => {
      if (!prev) return prev;
      const idx = prev.matrix.findIndex(
        c => c.contactRoleId === contactRoleId
          && c.permissionKey === permissionKey
          && c.clientId === null
      );
      const next = [...prev.matrix];
      if (idx >= 0) {
        next[idx] = { ...next[idx], allowed: nextAllowed };
      } else {
        next.push({ contactRoleId, permissionKey, allowed: nextAllowed, clientId: null });
      }
      return { ...prev, matrix: next };
    });
    setBusy(s => { const n = new Set(s); n.add(key); return n; });

    try {
      await rolePermissionsApi.setPermission(contactRoleId, permissionKey, nextAllowed, null);
    } catch (e: any) {
      // Revert
      setData(prev => {
        if (!prev) return prev;
        const idx = prev.matrix.findIndex(
          c => c.contactRoleId === contactRoleId
            && c.permissionKey === permissionKey
            && c.clientId === null
        );
        if (idx < 0) return prev;
        const next = [...prev.matrix];
        next[idx] = { ...next[idx], allowed: wasAllowed };
        return { ...prev, matrix: next };
      });
      setError(e?.message ?? 'Failed to save toggle');
    } finally {
      setBusy(s => { const n = new Set(s); n.delete(key); return n; });
    }
  }, [data, globalLookup]);

  if (loading) {
    return (
      <div>
        <h2 className="text-xl font-bold text-text-primary">Role Permissions Matrix</h2>
        <p className="text-sm text-text-secondary mt-4">Loading…</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <h2 className="text-xl font-bold text-text-primary">Role Permissions Matrix</h2>
        <p className="text-sm text-red-600 mt-4">{error ?? 'No data loaded.'}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary">Role Permissions Matrix</h2>
        <p className="text-sm text-text-secondary mt-1">
          Configure which actions each role can perform. Changes save immediately.
        </p>
        <p className="text-xs text-text-muted mt-2">
          Editing global defaults only. Per-client overrides (where a specific NP or tenant
          can be granted/denied a permission that differs from the role's default) exist in
          the schema but aren't editable from here yet — coming in a future iteration.
        </p>
        <p className="text-xs text-text-muted mt-2">
          Note: as DF Admin you bypass the matrix at runtime, so toggles here won't change
          your own access — they affect NpAdmin / NpDispatcher / NpReadOnly users.
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
                Permission
              </th>
              {data.roles.map(r => (
                <th key={r.contactRoleId} className="text-center px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                  {r.name}
                  <div className="text-[10px] text-text-muted font-normal">id={r.contactRoleId}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissionsByCategory.map(({ category, permissions }) => (
              <>
                <tr key={`cat-${category}`} className="bg-gray-100">
                  <td colSpan={1 + data.roles.length}
                      className="px-4 py-2 text-xs uppercase tracking-wide text-text-muted font-semibold sticky left-0">
                    {category}
                  </td>
                </tr>
                {permissions.map(p => (
                  <tr key={p.permissionKey} className="border-b border-border hover:bg-gray-50">
                    <td className="px-4 py-3 sticky left-0 bg-white">
                      <div className="text-sm font-medium text-text-primary">{p.displayName}</div>
                      <div className="text-[11px] text-text-muted font-mono">{p.permissionKey}</div>
                    </td>
                    {data.roles.map(r => {
                      const k = cellKey(r.contactRoleId, p.permissionKey);
                      const allowed = globalLookup.get(k) ?? false;
                      const isBusy = busy.has(k);
                      return (
                        <td key={r.contactRoleId} className="text-center px-4 py-3">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={allowed}
                            aria-label={`${p.displayName} for ${r.name}`}
                            disabled={isBusy}
                            onClick={() => toggleCell(r.contactRoleId, p.permissionKey)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/40 ${
                              allowed ? 'bg-[#3bc7f4]' : 'bg-gray-300'
                            } ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                allowed ? 'translate-x-4' : 'translate-x-0'
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
