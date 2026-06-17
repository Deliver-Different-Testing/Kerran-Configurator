import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  courierPortalSession,
  courierPortalAuthService,
  type CourierPortalProfile,
} from '@/services/courier_portalSession';

// Courier Portal magic-link (Item 8.5) — session state for the /drive subtree.
//
// Resolves how the courier is authenticated:
//   • Hub SSO courier  → hubAuthed (from the derived role) — no portal token.
//   • Magic-link courier → a stored portal session token, or one freshly
//     redeemed from a /drive/<slug>/<token> URL on first load.
// Identity (courier name) comes from the portal profile when present, else the
// shell falls back to the Hub useAuth() user.

interface CourierPortalSessionValue {
  loading: boolean;
  authed: boolean;                 // hub OR portal
  portalAuthed: boolean;           // magic-link specifically
  courier: CourierPortalProfile | null;
  error: string | null;
  signOut: () => void;
}

const Ctx = createContext<CourierPortalSessionValue>({
  loading: true, authed: false, portalAuthed: false, courier: null, error: null, signOut: () => {},
});

// Route words that can sit in the slot a magic-link token would occupy
// (/drive/<slug>/<here>) — so we don't mistake them for a token.
const ROUTE_WORDS = new Set(['', 'dashboard', 'runs', 'schedule', 'documents', 'contractors', 'profile', 'login']);

function readUrlToken(pathname: string): string | null {
  // ['', 'drive', '<slug>', '<token-or-route>', ...]
  const seg = pathname.split('/')[3] ?? '';
  if (!seg || ROUTE_WORDS.has(seg) || seg.length < 12) return null;
  return seg;
}

export function CourierPortalSessionProvider({ hubAuthed, children }: { hubAuthed: boolean; children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [portalAuthed, setPortalAuthed] = useState(false);
  const [courier, setCourier] = useState<CourierPortalProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    // Hub SSO courier — nothing to redeem; the cookie carries the session.
    if (hubAuthed) { setLoading(false); return; }

    const slug = location.pathname.split('/')[2] ?? 'portal';
    const urlToken = readUrlToken(location.pathname);
    const stored = courierPortalSession.getToken();

    // Already have a session — trust it (the first API call re-validates and
    // clears on 401). Show the cached profile immediately.
    if (stored && !urlToken) {
      setPortalAuthed(true);
      setCourier(courierPortalSession.getProfile());
      setLoading(false);
      return;
    }

    // Fresh magic link — redeem it for a session, then drop the token from the
    // URL so a refresh/share doesn't re-trigger redemption.
    if (urlToken) {
      courierPortalAuthService.validate(urlToken)
        .then(session => {
          if (!alive) return;
          courierPortalSession.adopt(session);
          setCourier(session.courier);
          setPortalAuthed(true);
          navigate(`/drive/${slug}/dashboard`, { replace: true });
        })
        .catch((e: any) => {
          if (!alive) return;
          courierPortalSession.clear();
          setError(e?.response?.data?.message ?? 'This link is invalid, expired, or has been revoked. Ask your operator for a new one.');
        })
        .finally(() => { if (alive) setLoading(false); });
      return;
    }

    setLoading(false);
    return () => { alive = false; };
    // Run once on entry to the /drive subtree.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubAuthed]);

  const signOut = () => {
    courierPortalSession.clear();
    setPortalAuthed(false);
    setCourier(null);
  };

  return (
    <Ctx.Provider value={{ loading, authed: hubAuthed || portalAuthed, portalAuthed, courier, error, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCourierPortalSession() {
  return useContext(Ctx);
}
