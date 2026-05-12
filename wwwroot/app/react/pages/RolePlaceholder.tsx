import { useAuth, AppRole } from '../context/AuthContext';

interface Props {
  roleLabel: string;
  description: string;
}

const roleAccent: Record<AppRole, string> = {
  dfadmin: '#43C7F4',
  np: '#606DB4',
  tenant: '#43C7F4',
  courier: '#10b981',
};

// Temporary landing page per role until Phase 3 wires Steve's pages in.
// Renders the user's identity + their derived role so we can verify
// claim plumbing end-to-end before porting real screens.
export default function RolePlaceholder({ roleLabel, description }: Props) {
  const { user, role } = useAuth();
  const accent = roleAccent[role];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-surface-light p-8">
      <div className="bg-white rounded-lg shadow-md p-10 max-w-2xl w-full">
        <div className="flex items-center gap-3 mb-6">
          <span
            className="text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full text-white"
            style={{ background: accent }}
          >
            {roleLabel}
          </span>
          {user.internal && (
            <span className="text-xs text-text-muted">Internal user</span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-text-primary mb-2">
          {user.fullName || user.email || 'Unknown user'}
        </h1>
        <p className="text-text-secondary mb-8">{description}</p>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <dt className="text-text-muted">Email</dt>
          <dd className="text-text-primary">{user.email ?? '—'}</dd>

          <dt className="text-text-muted">Tenant</dt>
          <dd className="text-text-primary">
            {user.tenantCode ?? '—'}
            {user.currentTenantId !== null && (
              <span className="text-text-muted"> (#{user.currentTenantId})</span>
            )}
          </dd>

          <dt className="text-text-muted">Staff ID</dt>
          <dd className="text-text-primary">{user.staffId ?? '—'}</dd>

          <dt className="text-text-muted">Resolved role</dt>
          <dd className="text-text-primary font-mono">{role}</dd>
        </dl>

        <div className="mt-8 pt-6 border-t border-border text-xs text-text-muted">
          Phase 3 will replace this placeholder with the full role experience.
        </div>
      </div>
    </div>
  );
}
