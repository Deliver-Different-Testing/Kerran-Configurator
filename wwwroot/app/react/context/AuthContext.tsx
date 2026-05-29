import { createContext, useContext, useMemo, ReactNode } from 'react';

export type AppRole = 'dfadmin' | 'np' | 'tenant' | 'courier';

// Phase 5+28b §B.2 — within the NP lane, per-user role tier (drives UI
// surface gating + which controllers a user can write to). Maps from the
// `NpRoleId` claim Hub emits at login from tucClientContact.ContactRoleId.
export type NpRole = 'NpAdmin' | 'NpDispatcher' | 'NpReadOnly' | null;

export interface AppUser {
  isAdmin: boolean;
  isCourier: boolean;
  isNetworkPartner: boolean;
  internal: boolean;
  currentTenantId: number | null;
  staffId: number | null;
  fullName: string | null;
  email: string | null;
  tenantCode: string | null;
  // Phase 5+28b — raw ContactRoleId (1/2/3) or null when the claim is
  // absent (non-NP users / NP users w/o a contact role).
  npRoleId: number | null;
  // Per-tenant DespatchWeb base URL (no trailing slash) or null when the
  // DespatchWebBaseUrl env var isn't set. Used to deep-link from Recurring
  // Routes to DespatchWeb's Recurring Jobs view.
  despatchWebBaseUrl: string | null;
}

interface AuthContextValue {
  user: AppUser;
  role: AppRole;
  // Phase 5+28b — friendly role name derived from npRoleId. DF Admin in
  // the NP lane gets `NpAdmin` so existing checks like
  // `npRole === 'NpAdmin'` still pass for cross-tenant admins.
  npRole: NpRole;
  logout: () => void;
}

const ANONYMOUS: AppUser = {
  isAdmin: false,
  isCourier: false,
  isNetworkPartner: false,
  internal: false,
  currentTenantId: null,
  staffId: null,
  fullName: null,
  email: null,
  tenantCode: null,
  npRoleId: null,
  despatchWebBaseUrl: null,
};

declare global {
  interface Window {
    __APP_USER__?: AppUser | null;
  }
}

function readBootstrap(): AppUser {
  const raw = typeof window !== 'undefined' ? window.__APP_USER__ : null;
  if (!raw) return ANONYMOUS;
  return { ...ANONYMOUS, ...raw };
}

function deriveRole(user: AppUser): AppRole {
  // Precedence: courier > dfadmin > np > tenant.
  // A user with multiple flags lands in the first matching lane.
  if (user.isCourier) return 'courier';
  if (user.isAdmin) return 'dfadmin';
  if (user.isNetworkPartner) return 'np';
  return 'tenant';
}

// Phase 5+28b §B.2 — maps the raw ContactRoleId from the cookie claim
// to the typed NpRole. DF Admins (isAdmin=true) are treated as NpAdmin
// when they're acting in the NP lane so every "is the operator allowed
// to do X?" check has the same shape regardless of who they are.
function deriveNpRole(user: AppUser): NpRole {
  if (user.isAdmin) return 'NpAdmin';
  switch (user.npRoleId) {
    case 1: return 'NpAdmin';
    case 2: return 'NpDispatcher';
    case 3: return 'NpReadOnly';
    default: return null;
  }
}

function readDevRoleOverride(internal: boolean): AppRole | null {
  if (!internal) return null;
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const v = params.get('devRole');
  if (v === 'dfadmin' || v === 'np' || v === 'tenant' || v === 'courier') return v;
  return null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthContextValue>(() => {
    const user = readBootstrap();
    const override = readDevRoleOverride(user.internal);
    const role = override ?? deriveRole(user);
    const npRole = deriveNpRole(user);
    return {
      user,
      role,
      npRole,
      logout: () => {
        // Hub owns sign-out. Hit Hub's logout endpoint, then come back.
        window.location.href = '/Account/Logout';
      },
    };
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
