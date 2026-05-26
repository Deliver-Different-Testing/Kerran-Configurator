import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUsers } from '@/hooks/useUsers';
import { userService } from '@/services/np_userService';
import { useAuth } from '@/context/AuthContext';
import StatusBadge from '@/components/common/StatusBadge';
import Modal from '@/components/common/Modal';
import type { User } from '@/types';

const roleBadgeStyles: Record<string, string> = {
  Admin: 'bg-brand-cyan/10 text-brand-cyan',
  Dispatcher: 'bg-green-50 text-success',
  'Read-Only': 'bg-surface-light text-text-secondary',
};

const permissions = [
  { perm: 'View Dashboard', admin: '✅', dispatcher: '✅', readonly: '✅' },
  { perm: 'View Dispatch Board', admin: '✅', dispatcher: '✅', readonly: '✅' },
  { perm: 'Assign Couriers to Jobs', admin: '✅', dispatcher: '✅', readonly: '❌' },
  { perm: 'Fleet Management', admin: '✅', dispatcher: '✅', readonly: '👁️ View' },
  { perm: 'Add/Edit Couriers', admin: '✅', dispatcher: '✅', readonly: '❌' },
  { perm: 'View Financial Data', admin: '✅', dispatcher: '❌', readonly: '❌' },
  { perm: 'Manage Users', admin: '✅', dispatcher: '❌', readonly: '❌' },
  { perm: 'Edit Settings', admin: '✅', dispatcher: '❌', readonly: '❌' },
  { perm: 'View Reports', admin: '✅', dispatcher: '✅', readonly: '✅' },
];

export default function Users() {
  const navigate = useNavigate();
  const { users, replace, refresh } = useUsers();
  const { npRole } = useAuth();
  const canManageUsers = npRole === 'NpAdmin';
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [draft, setDraft] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Phase 5+28b §B.2 — Add User modal form state.
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Admin');     // Phase 5+27.2 — default to Administrator per Steve
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteToast, setInviteToast] = useState<string | null>(null);

  function openAddUser() {
    setInviteName('');
    setInviteEmail('');
    setInviteRole('Admin');                                   // Phase 5+27.2
    setInviteError(null);
    setInviteToast(null);
    setModalOpen(true);
  }

  function closeAddUser() {
    setModalOpen(false);
    setInviteError(null);
  }

  async function handleSendInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError('Full name and email are both required.');
      return;
    }
    setInviting(true);
    setInviteError(null);
    try {
      const { message } = await userService.create({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteToast(message ?? `Invite sent to ${inviteEmail.trim()}.`);
      setModalOpen(false);
      refresh();
    } catch (e: any) {
      const fromAxios = e?.response?.data?.messages?.[0]?.message;
      setInviteError(fromAxios ?? e?.message ?? 'Failed to send invite.');
    } finally {
      setInviting(false);
    }
  }

  function openEdit(u: User) {
    setEditing(u);
    setDraft({ ...u });
    setSaveError(null);
  }

  function closeEdit() {
    setEditing(null);
    setDraft(null);
    setSaveError(null);
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await userService.update(draft.id, draft);
      replace(updated);
      closeEdit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save user';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Users</h2>
        <div className="flex gap-2">
          {canManageUsers && (
            <>
              <button onClick={() => navigate('/users/import')} className="bg-white text-brand-cyan border border-border px-4 py-2 rounded-md text-sm hover:bg-surface-cream transition-all">
                Import from Spreadsheet
              </button>
              <button onClick={openAddUser} className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow">
                + Add User
              </button>
            </>
          )}
        </div>
      </div>

      {/* Phase 5+28b — post-invite toast surfaces success / partial-failure
          messages from the cascade so the operator knows whether the email
          actually went out. */}
      {inviteToast && (
        <div className="mb-4 p-3 rounded-md bg-green-50 border border-green-200 text-sm text-green-800 flex items-start justify-between gap-3">
          <div>{inviteToast}</div>
          <button onClick={() => setInviteToast(null)} className="text-green-700 hover:text-green-900 font-bold leading-none" aria-label="Dismiss">×</button>
        </div>
      )}
      <p className="text-text-secondary text-sm mb-5">
        Manage who can access your NP portal. Assign roles to control what each team member can see and do.
      </p>

      {/* User Table */}
      <div className="bg-white border border-border rounded-lg overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Name', 'UserName', 'Role', 'Status', 'Last Login', ''].map(h => (
                <th key={h} className="text-left text-xs text-text-secondary uppercase tracking-wide px-3 py-2.5 border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="hover:bg-surface-cream">
                <td className="px-3 py-2.5 text-sm border-b border-border font-bold">{u.name}</td>
                <td className="px-3 py-2.5 text-sm border-b border-border">{u.email}</td>
                <td className="px-3 py-2.5 text-sm border-b border-border">
                  <span className={`px-2.5 py-0.5 rounded-lg text-xs ${roleBadgeStyles[u.role]}`}>{u.role}</span>
                </td>
                <td className="px-3 py-2.5 text-sm border-b border-border"><StatusBadge status={u.status} /></td>
                <td className="px-3 py-2.5 text-[13px] text-text-secondary border-b border-border">{u.lastLogin}</td>
                <td className="px-3 py-2.5 border-b border-border">
                  {canManageUsers && (
                    <button
                      onClick={() => openEdit(u)}
                      className="bg-transparent border border-border text-text-primary px-2.5 py-1 rounded-md text-xs hover:border-brand-cyan hover:text-brand-cyan transition-all"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role Permissions */}
      <div className="bg-white border border-border rounded-lg p-5 mt-4">
        <h3 className="font-bold mb-3">Role Permissions</h3>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Permission', 'Admin', 'Dispatcher', 'Read-Only'].map(h => (
                <th key={h} className="text-left text-xs text-text-secondary uppercase tracking-wide px-3 py-2.5 border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map(p => (
              <tr key={p.perm} className="hover:bg-surface-cream">
                <td className="px-3 py-2.5 text-sm border-b border-border">{p.perm}</td>
                <td className="px-3 py-2.5 text-sm border-b border-border">{p.admin}</td>
                <td className="px-3 py-2.5 text-sm border-b border-border">{p.dispatcher}</td>
                <td className="px-3 py-2.5 text-sm border-b border-border">{p.readonly}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      <Modal open={!!editing} onClose={closeEdit}>
        <h2 className="text-xl font-bold mb-2">Edit User</h2>
        <p className="text-text-secondary text-sm mb-4">Update profile, role, or status. Changes apply on next login.</p>
        {draft && (
          <div className="flex flex-col gap-3 mb-5">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Full Name</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">UserName (read-only)</label>
              <input
                type="text"
                value={draft.email}
                readOnly
                className="opacity-80 cursor-not-allowed"
              />
              <span className="text-xs text-text-muted">UserName is the primary key on tblUser and can't be changed here. To re-key a user, deactivate the existing record and create a new one.</span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Role</label>
              <select
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              >
                <option value="Admin">Admin</option>
                <option value="Dispatcher">Dispatcher</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary uppercase tracking-wide">Status</label>
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as 'active' | 'inactive' })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        )}
        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
            ⚠️ {saveError}
          </div>
        )}
        <div className="flex gap-2.5 justify-end">
          <button
            onClick={closeEdit}
            disabled={saving}
            className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* Add User Modal — wired in Phase 5+28b §B.2. Form fields controlled;
          Send Invite POSTs to /api/np/users which creates the
          tucClientContact + triggers the Hub invite cascade. */}
      <Modal open={modalOpen} onClose={closeAddUser}>
        <h2 className="text-xl font-bold mb-2">Add New User</h2>
        <p className="text-text-secondary text-sm mb-4">Create a portal login for a team member.</p>
        <div className="flex flex-col gap-3 mb-5">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-secondary uppercase tracking-wide">Full Name</label>
            <input
              type="text"
              placeholder="e.g. Jane Smith"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              disabled={inviting}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-secondary uppercase tracking-wide">UserName</label>
            <input
              type="email"
              placeholder="e.g. jane@pacificexpress.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={inviting}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-secondary uppercase tracking-wide">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              disabled={inviting}
            >
              <option value="Admin">Admin</option>
              <option value="Dispatcher">Dispatcher</option>
              <option value="Read-Only">Read-Only</option>
            </select>
          </div>
        </div>
        {inviteError && (
          <p className="text-xs text-red-600 mb-3">{inviteError}</p>
        )}
        <p className="text-xs text-text-secondary mb-4">An invitation email will be sent with login instructions.</p>
        <div className="flex gap-2.5 justify-end">
          <button
            onClick={closeAddUser}
            disabled={inviting}
            className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSendInvite}
            disabled={inviting}
            className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow disabled:opacity-50"
          >
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
      </Modal>
    </>
  );
}
