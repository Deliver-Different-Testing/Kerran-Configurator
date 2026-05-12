import { createContext, useContext, useMemo, ReactNode } from 'react';

export type AppRole = 'dfadmin' | 'np' | 'tenant' | 'courier';

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
}

interface AuthContextValue {
  user: AppUser;
  role: AppRole;
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
    return {
      user,
      role,
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
