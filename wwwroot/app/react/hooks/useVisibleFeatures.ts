import { useEffect, useState } from 'react';
import { featuresApi } from '@/services/api';

// Phase 5+31 R2 §2 — fetches the current user's visible feature keys from
// GET /api/me/visible-features once on mount.
//
// FAIL-CLOSED for gated surfaces (Steve discussion 2026-06-11). The hook
// reports a three-state `status` so callers can distinguish:
//   - 'loading' — fetch in flight; the matrix hasn't spoken yet.
//   - 'ready'   — `visibleFeatures` holds the authoritative key set.
//   - 'error'   — fetch failed (network, 401 → bounce to Hub login, stale
//                 session, etc.); `visibleFeatures` is null.
//
// A feature-gated surface must render ONLY when status === 'ready' AND its key
// is present. During 'loading' or 'error' it stays hidden — a fetch failure
// must NOT default-open visibility (the previous null = "show everything"
// posture let transient errors leak gated tiles/sections). Un-gated core nav
// (sections without a featureKey) is unaffected and shows immediately, so the
// sidebar never flashes empty; only gated sections pop in once 'ready'.
//
// Resolver-side, DF Admin (UserGroupID=1) gets the union of all visible keys;
// other roles get their ClientType's slice; NULL ClientType → 2 Customer
// fallback. See ClientTypeFeatureResolver.cs.
export type VisibleFeaturesStatus = 'loading' | 'ready' | 'error';

export function useVisibleFeatures() {
  const [visibleFeatures, setVisibleFeatures] = useState<Set<string> | null>(null);
  const [status, setStatus] = useState<VisibleFeaturesStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    featuresApi.getMyVisibleFeatures()
      .then(keys => {
        if (cancelled) return;
        setVisibleFeatures(new Set(keys));
        setStatus('ready');
      })
      .catch(err => {
        if (cancelled) return;
        setError(err?.message ?? 'Failed to load visible features');
        setVisibleFeatures(null);
        setStatus('error'); // fail closed — gated surfaces stay hidden
      });
    return () => { cancelled = true; };
  }, []);

  return { visibleFeatures, status, error };
}
