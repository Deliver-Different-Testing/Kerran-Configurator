import { useEffect, useState } from 'react';
import { rolePermissionsApi } from '@/services/api';

// Phase 5+31 R3 — hook that fetches the current user's allowed-permission
// keys from GET /api/me/permissions once on mount.
//
// Behaviour while loading: returns `permissions = null`. Callers should
// treat null as "default-allow" so action buttons (Add User, Edit, etc.)
// don't flash hidden on initial paint. Once the fetch resolves, the Set
// is populated and consumers gate correctly via .has('permission-key').
//
// On error (network, 401 → bounce to Hub login, etc.), permissions stays
// null — same default-allow posture. Surfacing an error toast in every
// consumer would be too noisy; the real enforcement is the server-side
// [RequirePermission] attribute which 403s if the action is actually
// invoked without the key. UI gating is a UX nicety, not a security
// boundary.
//
// Resolver-side, DF Admin (UserGroupID=1) gets the full catalog; other
// roles get their matrix-determined slice with per-client overrides
// applied. Empty set for users without an NpRoleId claim (deny-by-default).
// See RolePermissionResolver.cs.
export function usePermissions() {
  const [permissions, setPermissions] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    rolePermissionsApi.getMyPermissions()
      .then(keys => {
        if (cancelled) return;
        setPermissions(new Set(keys));
      })
      .catch(err => {
        if (cancelled) return;
        setError(err?.message ?? 'Failed to load permissions');
        // Leave permissions as null → default-allow.
      });
    return () => { cancelled = true; };
  }, []);

  return { permissions, error };
}
