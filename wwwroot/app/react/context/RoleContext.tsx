// Compatibility shim: Steve's `web-unified` source imports `useRole()` from
// this path expecting a localStorage-backed role picker. In our integration
// the role is derived from Hub claims via AuthContext — this file forwards
// `useRole()` to that source of truth so Steve's pages keep working unedited.
//
// `setRole` is a no-op in production (claims are immutable from the SPA's
// perspective). It still maps `id` → `courier` so any leftover Steve UI that
// references the In-House Driver role doesn't crash.

import { useAuth, AppRole as ResolvedRole } from './AuthContext';

// Steve's original role union — kept for type-compatibility with imported pages.
export type AppRole = 'tenant' | 'np' | 'id' | 'dfadmin' | null;

interface RoleContextValue {
  role: AppRole;
  setRole: (role: AppRole) => void;
  logout: () => void;
}

function toAppRole(role: ResolvedRole): AppRole {
  // courier maps to 'id' for any Steve UI that gates on In-House Driver;
  // production NP/tenant/dfadmin pass straight through.
  if (role === 'courier') return 'id';
  return role;
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useRole(): RoleContextValue {
  const { role, logout } = useAuth();
  return {
    role: toAppRole(role),
    setRole: () => {
      // Intentional no-op: role is claim-driven. Leaving this as a silent
      // noop avoids editing every Steve page that calls setRole().
    },
    logout,
  };
}
