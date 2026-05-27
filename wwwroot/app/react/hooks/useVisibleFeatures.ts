import { useEffect, useState } from 'react';
import { featuresApi } from '@/services/api';

// Phase 5+31 R2 §2 — hook that fetches the current user's visible feature
// keys from GET /api/me/visible-features once on mount.
//
// Behaviour while loading: returns `visibleFeatures = null`. Callers should
// treat null as "show everything" (default-allow) so the sidebar / tile
// renderer doesn't flash empty on initial paint. Once the fetch resolves,
// the Set is populated and any feature-key-gated surface filters correctly.
//
// On error (network, 401 → bounce to Hub login, etc.), visibleFeatures
// stays null — same default-allow posture. Surfacing an error toast for
// the sidebar would be overkill; the real visibility decisions land via
// the matrix UI + R3 role layer.
//
// Resolver-side, DF Admin (UserGroupID=1) gets the union of all visible
// keys; other roles get their ClientType's slice; NULL ClientType → 2
// Customer fallback. See ClientTypeFeatureResolver.cs.
export function useVisibleFeatures() {
  const [visibleFeatures, setVisibleFeatures] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    featuresApi.getMyVisibleFeatures()
      .then(keys => {
        if (cancelled) return;
        setVisibleFeatures(new Set(keys));
      })
      .catch(err => {
        if (cancelled) return;
        setError(err?.message ?? 'Failed to load visible features');
        // Leave visibleFeatures as null → default-allow.
      });
    return () => { cancelled = true; };
  }, []);

  return { visibleFeatures, error };
}
