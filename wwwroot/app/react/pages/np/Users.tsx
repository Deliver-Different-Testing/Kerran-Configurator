import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUsers } from '@/hooks/useUsers';
import {
  userService,
  type NpUserDetail, type NpRoleOption, type NpRelationshipType,
  type NpResolvedTile, type NpUserSavePayload, type NpContactAudit,
} from '@/services/np_userService';
import { usePermissions } from '@/hooks/usePermissions';
import StatusBadge from '@/components/common/StatusBadge';
import { ACCESS_LABEL, clampAccess, type AccessLevel } from '@/data/accessLevels';
import type { User } from '@/types';

// Unified Permissions §8.1 — Users list + 3-tab Contact modal (Profile /
// Permissions / History). Roles are real multi-select assignments; the CRM
// label is a separate RelationshipType. History has no audit source yet (stub).

const PILL: Record<AccessLevel, string> = {
  0: 'bg-surface-light text-text-muted border border-border',
  1: 'bg-brand-cyan/10 text-brand-cyan',
  2: 'bg-green-50 text-success',
  3: 'bg-purple-100 text-purple-700',
};

export default function Users() {
  const navigate = useNavigate();
  const { users, refresh } = useUsers();
  const { permissions } = usePermissions();
  const canManageUsers = permissions === null || permissions.has('manage-users');

  // null = closed, 'new' = add, number = editing that contact id.
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Users</h2>
        {canManageUsers && (
          <div className="flex gap-2">
            <button onClick={() => navigate('/users/import')} className="bg-white text-brand-cyan border border-border px-4 py-2 rounded-md text-sm hover:bg-surface-cream transition-all">
              Import from Spreadsheet
            </button>
            <button onClick={() => setEditing('new')} className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow">
              + Add User
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className="mb-4 p-3 rounded-md bg-green-50 border border-green-200 text-sm text-green-800 flex items-start justify-between gap-3">
          <div>{toast}</div>
          <button onClick={() => setToast(null)} className="text-green-700 hover:text-green-900 font-bold leading-none" aria-label="Dismiss">×</button>
        </div>
      )}
      <p className="text-text-secondary text-sm mb-5">
        Manage who can access your NP portal. Assign roles to control what each team member can see and do.
      </p>

      <div className="bg-white border border-border rounded-lg overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Name', 'Client / NP', 'UserName', 'Role(s)', 'Status', 'Last Login', ''].map(h => (
                <th key={h} className="text-left text-xs text-text-secondary uppercase tracking-wide px-3 py-2.5 border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u: User) => (
              <tr key={u.id} className="hover:bg-surface-cream">
                <td className="px-3 py-2.5 text-sm border-b border-border font-bold">{u.name}</td>
                <td className="px-3 py-2.5 text-sm border-b border-border text-text-secondary">{u.clientName || '—'}</td>
                <td className="px-3 py-2.5 text-sm border-b border-border">{u.email}</td>
                <td className="px-3 py-2.5 text-sm border-b border-border">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length === 0
                      ? <span className="text-text-muted text-xs">No role</span>
                      : u.roles.map(r => (
                        <span key={r.id} className="px-2.5 py-0.5 rounded-lg text-xs bg-brand-cyan/10 text-brand-cyan">{r.name}</span>
                      ))}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-sm border-b border-border"><StatusBadge status={u.status} /></td>
                <td className="px-3 py-2.5 text-[13px] text-text-secondary border-b border-border">{u.lastLogin}</td>
                <td className="px-3 py-2.5 border-b border-border">
                  {canManageUsers && (
                    <button onClick={() => setEditing(Number(u.id))} className="bg-transparent border border-border text-text-primary px-2.5 py-1 rounded-md text-xs hover:border-brand-cyan hover:text-brand-cyan transition-all">
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-text-muted text-sm">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <ContactModal
          contactId={editing}
          onClose={(msg) => { setEditing(null); if (msg) setToast(msg); refresh(); }}
        />
      )}
    </>
  );
}

// ---- 3-tab Contact modal --------------------------------------------------

type Tab = 'profile' | 'permissions' | 'history';

const emptyDraft: NpUserSavePayload & { clientName: string } = {
  firstName: '', lastName: '', email: '', jobTitle: '', mobile: '', directDial: '',
  notes: '', relationshipTypeId: null, roleIds: [], status: 'active', clientName: '',
};

function ContactModal({ contactId, onClose }: { contactId: number | 'new'; onClose: (toast?: string) => void }) {
  const isNew = contactId === 'new';
  const [tab, setTab] = useState<Tab>('profile');
  const [draft, setDraft] = useState<NpUserSavePayload & { clientName: string }>({ ...emptyDraft });
  const [roles, setRoles] = useState<NpRoleOption[]>([]);
  const [relTypes, setRelTypes] = useState<NpRelationshipType[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [r, rt] = await Promise.all([userService.getAssignableRoles(), userService.getRelationshipTypes()]);
        setRoles(r); setRelTypes(rt);
        if (!isNew) {
          const d: NpUserDetail = await userService.getDetail(contactId);
          setDraft({
            firstName: d.firstName, lastName: d.lastName, email: d.email, jobTitle: d.jobTitle,
            mobile: d.mobile, directDial: d.directDial, notes: d.notes,
            relationshipTypeId: d.relationshipTypeId, roleIds: d.roleIds, status: d.status,
            clientName: d.clientName,
          });
        }
      } catch (e: any) {
        setError(e?.response?.data?.error ?? e?.message ?? 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [contactId, isNew]);

  const set = (patch: Partial<typeof draft>) => setDraft(d => ({ ...d, ...patch }));
  const toggleRole = (id: number) =>
    setDraft(d => ({ ...d, roleIds: d.roleIds.includes(id) ? d.roleIds.filter(x => x !== id) : [...d.roleIds, id] }));

  const canSave = (draft.firstName.trim() || draft.lastName.trim()) && draft.email.trim() && !saving;

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const payload: NpUserSavePayload = {
        firstName: draft.firstName, lastName: draft.lastName, email: draft.email,
        jobTitle: draft.jobTitle, mobile: draft.mobile, directDial: draft.directDial,
        notes: draft.notes, relationshipTypeId: draft.relationshipTypeId,
        roleIds: draft.roleIds, status: draft.status,
      };
      if (isNew) {
        const { message } = await userService.create({
          firstName: draft.firstName, lastName: draft.lastName, email: draft.email,
          roleIds: draft.roleIds, relationshipTypeId: draft.relationshipTypeId,
          jobTitle: draft.jobTitle, mobile: draft.mobile,
        });
        onClose(message ?? `Invite sent to ${draft.email}.`);
      } else {
        await userService.update(contactId, payload);
        onClose('Changes saved.');
      }
    } catch (e: any) {
      setError(e?.response?.data?.messages?.[0]?.message ?? e?.response?.data?.error ?? e?.message ?? 'Failed to save');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-bold text-text-primary">{isNew ? 'Add User' : 'Edit User'}</h3>
          <button onClick={() => onClose()} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
        </div>

        <div className="flex gap-1 px-6 pt-3 border-b border-border">
          {([['profile', 'Profile'], ['permissions', 'Permissions'], ['history', 'History']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-brand-cyan text-brand-cyan' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">⚠️ {error}</div>}
          {loading ? <p className="text-sm text-text-muted">Loading…</p>
            : tab === 'profile' ? (
              <ProfileTab draft={draft} set={set} roles={roles} relTypes={relTypes} toggleRole={toggleRole} isNew={isNew} />
            ) : tab === 'permissions' ? (
              <PermissionsTab contactId={contactId} />
            ) : (
              <HistoryTab contactId={contactId} />
            )}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border">
          <button onClick={() => onClose()} disabled={saving} className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all disabled:opacity-50">Cancel</button>
          <button onClick={save} disabled={!canSave} className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow disabled:opacity-50">
            {saving ? 'Saving…' : isNew ? 'Add User' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ draft, set, roles, relTypes, toggleRole, isNew }: {
  draft: NpUserSavePayload & { clientName: string };
  set: (patch: Partial<NpUserSavePayload & { clientName: string }>) => void;
  roles: NpRoleOption[]; relTypes: NpRelationshipType[];
  toggleRole: (id: number) => void; isNew: boolean;
}) {
  const Field = (label: string, value: string, onChange: (v: string) => void, type = 'text') => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-text-secondary uppercase tracking-wide">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {Field('First Name', draft.firstName, v => set({ firstName: v }))}
        {Field('Last Name', draft.lastName, v => set({ lastName: v }))}
        {Field('Email (Username)', draft.email, v => set({ email: v }), 'email')}
        {Field('Job Title', draft.jobTitle, v => set({ jobTitle: v }))}
        {Field('Mobile', draft.mobile, v => set({ mobile: v }))}
        {Field('Direct Dial', draft.directDial, v => set({ directDial: v }))}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-secondary uppercase tracking-wide">Relationship Type</label>
        <select value={draft.relationshipTypeId ?? ''} onChange={e => set({ relationshipTypeId: e.target.value ? Number(e.target.value) : null })}>
          <option value="">— None —</option>
          {relTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
        </select>
        <span className="text-xs text-text-muted">CRM label only — does not affect permissions.</span>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-secondary uppercase tracking-wide">Role(s)</label>
        <div className="flex flex-wrap gap-2">
          {roles.length === 0 ? <span className="text-text-muted text-xs">No assignable roles.</span>
            : roles.map(r => {
              const on = draft.roleIds.includes(r.id);
              return (
                <button key={r.id} type="button" onClick={() => toggleRole(r.id)} title={r.description}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-brand-cyan text-brand-dark border-brand-cyan' : 'bg-white text-text-secondary border-border hover:border-brand-cyan'}`}>
                  {on ? '✓ ' : ''}{r.name}
                </button>
              );
            })}
        </div>
        <span className="text-xs text-text-muted">Select one or more — the user gets the most permissive access across all assigned roles.</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-secondary uppercase tracking-wide">Status</label>
          <select value={draft.status} onChange={e => set({ status: e.target.value as 'active' | 'inactive' })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-secondary uppercase tracking-wide">Client</label>
          <input type="text" value={isNew ? 'Your NP (set on save)' : (draft.clientName || '—')} readOnly className="opacity-80 cursor-not-allowed" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-secondary uppercase tracking-wide">Notes</label>
        <textarea rows={2} value={draft.notes} onChange={e => set({ notes: e.target.value })} />
      </div>
    </div>
  );
}

function PermissionsTab({ contactId }: { contactId: number | 'new' }) {
  const [tiles, setTiles] = useState<NpResolvedTile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contactId === 'new') return;
    userService.getResolvedPermissions(contactId)
      .then(setTiles)
      .catch((e: any) => setError(e?.message ?? 'Failed to load permissions'));
  }, [contactId]);

  if (contactId === 'new') return <p className="text-sm text-text-muted">Save the user first to see resolved permissions.</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!tiles) return <p className="text-sm text-text-muted">Loading…</p>;

  const pill = (lvl: number) => {
    const l = clampAccess(lvl);
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PILL[l]}`}>{ACCESS_LABEL[l]}</span>;
  };

  return (
    <div>
      <p className="text-sm text-text-secondary mb-3">What this user can actually do — the union of their roles after cascade. Read-only; change roles on the Profile tab.</p>
      <div className="space-y-3">
        {tiles.map(t => (
          <div key={t.key} className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-surface-cream px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-primary">{t.displayName}</span>
              {pill(t.level)}
            </div>
            {t.items.map(i => (
              <div key={i.key} className="flex items-center justify-between px-3 py-2 border-t border-border">
                <span className="text-sm text-text-primary pl-3">{i.displayName}</span>
                {pill(i.level)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryTab({ contactId }: { contactId: number | 'new' }) {
  const [rows, setRows] = useState<NpContactAudit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contactId === 'new') return;
    userService.getHistory(contactId)
      .then(setRows)
      .catch((e: any) => setError(e?.message ?? 'Failed to load history'));
  }, [contactId]);

  if (contactId === 'new') return <p className="text-sm text-text-muted">History appears after the user is created.</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!rows) return <p className="text-sm text-text-muted">Loading…</p>;
  if (rows.length === 0) return <p className="text-sm text-text-muted py-6 text-center">No changes recorded yet.</p>;

  const fmt = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toLocaleString(); };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {['When', 'Field', 'Old', 'New', 'Changed by'].map(h => (
              <th key={h} className="text-left text-xs text-text-secondary uppercase tracking-wide px-3 py-2 border-b border-border">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-surface-cream">
              <td className="px-3 py-2 border-b border-border text-[13px] text-text-secondary whitespace-nowrap">{fmt(r.changedAt)}</td>
              <td className="px-3 py-2 border-b border-border font-medium">{r.field}</td>
              <td className="px-3 py-2 border-b border-border text-text-secondary">{r.oldValue || '—'}</td>
              <td className="px-3 py-2 border-b border-border">{r.newValue || '—'}</td>
              <td className="px-3 py-2 border-b border-border text-text-secondary">{r.changedBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
