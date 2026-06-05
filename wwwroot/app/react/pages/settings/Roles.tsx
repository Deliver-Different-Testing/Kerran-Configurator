// Role Management — DF-Admin-only (Unified Permissions §8.2).
// Roles list page + three-tab Role Detail modal (Details / Applies To /
// Permissions). Backed by /api/admin/roles + /client-types + the
// /api/admin/role-permissions matrix PUT for the per-role tri-state grid.
//
// Scope note: this DF-admin page creates GLOBAL DEFAULT roles (TenantClientId
// null). Per-tenant roles are created from tenant context (§8.5, post-Phase E),
// so the Scope radio is shown read-only here.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  rolesApi,
  type RoleListItem, type RoleDetail, type ClientTypeRef,
  type RolePermissionsForRole, rolePermissionsApi,
} from '@/services/api';
import { clampAccess, type AccessLevel } from '@/data/accessLevels';
import TriStateCell from '@/components/permissions/TriStateCell';

type ScopeFilter = 'all' | 'global' | 'tenant';

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [clientTypes, setClientTypes] = useState<ClientTypeRef[]>([]);
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, cts] = await Promise.all([rolesApi.list(), rolesApi.clientTypes()]);
      setRoles(r);
      setClientTypes(cts);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ctName = useMemo(() => new Map(clientTypes.map(c => [c.id, c.name])), [clientTypes]);

  const filtered = useMemo(() => {
    let list = roles;
    if (scope === 'global') list = list.filter(r => r.tenantClientId === null);
    else if (scope === 'tenant') list = list.filter(r => r.tenantClientId !== null);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(r => r.name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q));
    return list;
  }, [roles, scope, search]);

  const counts = useMemo(() => ({
    all: roles.length,
    global: roles.filter(r => r.tenantClientId === null).length,
    tenant: roles.filter(r => r.tenantClientId !== null).length,
  }), [roles]);

  const closeModal = useCallback((reload: boolean) => {
    setEditingId(null);
    if (reload) load();
  }, [load]);

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Roles</h2>
          <p className="text-sm text-text-secondary mt-1">
            Define roles and which ClientTypes they apply to. Permissions for each role are set
            on the role's Permissions tab (or in the Role Permissions matrix).
          </p>
        </div>
        <button
          onClick={() => setEditingId('new')}
          className="px-4 py-2 rounded-lg bg-[#3bc7f4] text-white text-sm font-medium hover:bg-[#2bb5e2]"
        >+ Add Role</button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['all', 'global', 'tenant'] as ScopeFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${scope === s ? 'bg-[#3bc7f4] text-white' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'}`}
          >
            {s === 'all' ? 'All' : s === 'global' ? 'Global Defaults' : 'Per-Tenant'} ({counts[s]})
          </button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search roles…"
          className="ml-auto px-3 py-1.5 rounded-lg border border-border text-sm w-56 focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/40"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-300 bg-red-50 text-sm text-red-800 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-bold">×</button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-text-primary">Role Name</th>
              <th className="text-left px-4 py-3 font-medium text-text-primary">Scope</th>
              <th className="text-left px-4 py-3 font-medium text-text-primary">Applies To</th>
              <th className="text-center px-4 py-3 font-medium text-text-primary">Contacts</th>
              <th className="text-center px-4 py-3 font-medium text-text-primary">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-text-muted">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-text-muted">No roles.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.contactRoleId} className="border-b border-border hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-semibold text-text-primary">{r.name}</div>
                  {r.description && <div className="text-xs text-text-muted">{r.description}</div>}
                </td>
                <td className="px-4 py-3 text-text-secondary">{r.scopeLabel}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {r.clientTypeIds.length === 0
                      ? <span className="text-xs text-text-muted">—</span>
                      : r.clientTypeIds.map(id => (
                        <span key={id} className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-text-secondary">
                          {ctName.get(id) ?? `#${id}`}
                        </span>
                      ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-text-secondary">{r.contactCount}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                    {r.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditingId(r.contactRoleId)} className="text-[#3bc7f4] hover:underline text-sm font-medium">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId !== null && (
        <RoleDetailModal
          roleId={editingId}
          clientTypes={clientTypes}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

// ---- Role Detail modal ----------------------------------------------------

type Tab = 'details' | 'appliesTo' | 'permissions';

function RoleDetailModal({
  roleId, clientTypes, onClose,
}: {
  roleId: number | 'new';
  clientTypes: ClientTypeRef[];
  onClose: (reload: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>('details');
  const [detail, setDetail] = useState<RoleDetail | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedCts, setSelectedCts] = useState<Set<number>>(new Set());
  const [currentId, setCurrentId] = useState<number | 'new'>(roleId);
  const [loading, setLoading] = useState(roleId !== 'new');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (roleId === 'new') return;
    (async () => {
      setLoading(true);
      try {
        const d = await rolesApi.get(roleId);
        setDetail(d);
        setName(d.name);
        setDescription(d.description ?? '');
        setIsActive(d.isActive);
        setSelectedCts(new Set(d.clientTypeIds));
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load role');
      } finally {
        setLoading(false);
      }
    })();
  }, [roleId]);

  const toggleCt = (id: number) => {
    setSelectedCts(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setDirty(true);
  };

  const canSave = name.trim().length > 0 && selectedCts.size > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (currentId === 'new') {
        const created = await rolesApi.create({
          name: name.trim(),
          description: description || null,
          tenantClientId: null,
          clientTypeIds: [...selectedCts],
        });
        setDetail(created);
        setCurrentId(created.contactRoleId);
        setDirty(false);
        // Stay open in edit mode so permissions can be set on the new role.
        setTab('permissions');
      } else {
        await rolesApi.update(currentId, {
          name: name.trim(),
          description: description || null,
          isActive,
          clientTypeIds: [...selectedCts],
        });
        setDirty(false);
        onClose(true);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (currentId === 'new') return;
    if (!window.confirm(`Deactivate role "${name}"? It stays in the database but is hidden from pickers and excluded from new permission lookups.`)) return;
    setSaving(true);
    try {
      await rolesApi.deactivate(currentId);
      onClose(true);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to deactivate');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => onClose(false)}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-bold text-text-primary">
            {currentId === 'new' ? 'Add Role' : `Edit Role — ${name}`}
          </h3>
          <button onClick={() => onClose(false)} className="text-text-muted hover:text-text-primary text-xl">×</button>
        </div>

        <div className="flex gap-1 px-6 pt-3 border-b border-border">
          {([['details', 'Details'], ['appliesTo', 'Applies To'], ['permissions', 'Permissions']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-[#3bc7f4] text-[#3bc7f4]' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >{label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 p-3 rounded-lg border border-red-300 bg-red-50 text-sm text-red-800">{error}</div>
          )}
          {loading ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : tab === 'details' ? (
            <div className="space-y-4 max-w-lg">
              <label className="block">
                <span className="text-sm font-medium text-text-primary">Role Name *</span>
                <input
                  value={name} maxLength={80}
                  onChange={e => { setName(e.target.value); setDirty(true); }}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/40"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-text-primary">Description</span>
                <textarea
                  value={description} rows={3}
                  onChange={e => { setDescription(e.target.value); setDirty(true); }}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/40"
                  placeholder="Internal-only helper text shown in the roles list and role picker."
                />
              </label>
              <div>
                <span className="text-sm font-medium text-text-primary">Scope</span>
                <p className="mt-1 text-sm text-text-secondary">
                  Global Default (DFRNT)
                  <span className="block text-xs text-text-muted">
                    Per-tenant roles are created from tenant context (coming with tenant self-service).
                  </span>
                </p>
              </div>
              {currentId !== 'new' && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isActive} onChange={e => { setIsActive(e.target.checked); setDirty(true); }} />
                  <span className="text-sm text-text-primary">Active</span>
                </label>
              )}
            </div>
          ) : tab === 'appliesTo' ? (
            <div>
              <p className="text-sm text-text-secondary mb-3">Which ClientTypes can this role be assigned to? (at least one)</p>
              <div className="space-y-2 max-w-md">
                {clientTypes.map(ct => (
                  <label key={ct.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                    <input type="checkbox" checked={selectedCts.has(ct.id)} onChange={() => toggleCt(ct.id)} />
                    <span className="text-sm text-text-primary">{ct.name}</span>
                    <span className="text-xs text-text-muted">({ct.id})</span>
                  </label>
                ))}
              </div>
              {selectedCts.size === 0 && (
                <p className="mt-3 text-xs text-amber-600">Select at least one ClientType to enable Save.</p>
              )}
            </div>
          ) : (
            <RolePermissionsTab roleId={currentId} />
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <div>
            {currentId !== 'new' && (
              <button onClick={deactivate} disabled={saving} className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50">
                Deactivate Role
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onClose(dirty ? false : false)} className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-gray-50">Cancel</button>
            <button onClick={save} disabled={!canSave} className="px-4 py-2 rounded-lg bg-[#3bc7f4] text-white text-sm font-medium hover:bg-[#2bb5e2] disabled:opacity-50">
              {saving ? 'Saving…' : currentId === 'new' ? 'Create Role' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Permissions tab (single-role tri-state, §8.2.2 Tab 3) ----------------

function RolePermissionsTab({ roleId }: { roleId: number | 'new' }) {
  const [data, setData] = useState<RolePermissionsForRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (roleId === 'new') { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        setData(await rolesApi.getPermissions(roleId));
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load permissions');
      } finally {
        setLoading(false);
      }
    })();
  }, [roleId]);

  const explicit = useMemo(() => {
    const m = new Map<string, AccessLevel>();
    if (!data) return m;
    const at = new Map(data.permissions.map(p => [p.permissionKey, p.accessType]));
    for (const c of data.cells) {
      if (c.clientId !== null) continue;
      m.set(c.permissionKey, clampAccess(c.accessLevel ?? (c.allowed ? (at.get(c.permissionKey) ?? 2) : 0)));
    }
    return m;
  }, [data]);

  const parentOf = useMemo(() => {
    const m = new Map<string, string | null>();
    data?.permissions.forEach(p => m.set(p.permissionKey, p.parentKey));
    return m;
  }, [data]);

  const resolve = useCallback((key: string): AccessLevel => {
    let anc = parentOf.get(key) ?? null;
    while (anc) { if (explicit.get(anc) === 0) return 0; anc = parentOf.get(anc) ?? null; }
    const own = explicit.get(key);
    if (own !== undefined) return own;
    let p = parentOf.get(key) ?? null;
    while (p) { const pl = explicit.get(p); if (pl !== undefined) return pl; p = parentOf.get(p) ?? null; }
    return 0;
  }, [explicit, parentOf]);

  const groups = useMemo(() => {
    if (!data) return [];
    const tiles = data.permissions.filter(p => p.tier === 1).sort((a, b) => a.sortOrder - b.sortOrder);
    const byParent = new Map<string, typeof data.permissions>();
    data.permissions.forEach(p => { if (p.parentKey) { const a = byParent.get(p.parentKey) ?? []; a.push(p); byParent.set(p.parentKey, a); } });
    return tiles.map(t => ({ tile: t, children: (byParent.get(t.permissionKey) ?? []).sort((a, b) => a.sortOrder - b.sortOrder) }));
  }, [data]);

  const setCell = async (key: string, next: AccessLevel, accessType: number) => {
    if (roleId === 'new' || !data) return;
    const prev = explicit.get(key);
    setData(d => d ? { ...d, cells: upsertCell(d.cells, key, next) } : d);
    setBusy(s => new Set(s).add(key));
    try {
      await rolePermissionsApi.setPermission(roleId, key, next, null);
    } catch (e: any) {
      setData(d => d ? { ...d, cells: upsertCell(d.cells, key, prev ?? 0) } : d);
      setError(e?.message ?? 'Failed to save');
    } finally {
      setBusy(s => { const n = new Set(s); n.delete(key); return n; });
    }
    void accessType;
  };

  if (roleId === 'new') return <p className="text-sm text-text-muted">Create the role first, then set its permissions here.</p>;
  if (loading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!data) return <p className="text-sm text-red-600">{error ?? 'No data.'}</p>;

  return (
    <div>
      {error && <div className="mb-3 p-2 rounded border border-red-300 bg-red-50 text-sm text-red-800">{error}</div>}
      <div className="space-y-3">
        {groups.map(({ tile, children }) => (
          <div key={tile.permissionKey} className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-gray-100 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-primary">{tile.displayName}</span>
              <TriStateCell
                level={resolve(tile.permissionKey)} accessType={tile.accessType}
                explicit={explicit.has(tile.permissionKey)} busy={busy.has(tile.permissionKey)}
                label={tile.displayName}
                onChange={(n) => setCell(tile.permissionKey, n, tile.accessType)}
              />
            </div>
            {children.map(p => (
              <div key={p.permissionKey} className="flex items-center justify-between px-3 py-2 border-t border-border">
                <div className="pl-3">
                  <div className="text-sm text-text-primary">{p.displayName}</div>
                  <div className="text-[11px] text-text-muted font-mono">{p.permissionKey}</div>
                </div>
                <TriStateCell
                  level={resolve(p.permissionKey)} accessType={p.accessType}
                  explicit={explicit.has(p.permissionKey)} busy={busy.has(p.permissionKey)}
                  label={p.displayName}
                  onChange={(n) => setCell(p.permissionKey, n, p.accessType)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-text-muted mt-3">None · View · Edit · Action. A tile grant cascades to its items unless an item is set lower. Changes save immediately.</p>
    </div>
  );
}

function upsertCell(cells: RolePermissionsForRole['cells'], key: string, level: AccessLevel) {
  const idx = cells.findIndex(c => c.permissionKey === key && c.clientId === null);
  const next = [...cells];
  if (idx >= 0) next[idx] = { ...next[idx], accessLevel: level, allowed: level >= 1 };
  else next.push({ permissionKey: key, allowed: level >= 1, accessLevel: level, clientId: null });
  return next;
}
