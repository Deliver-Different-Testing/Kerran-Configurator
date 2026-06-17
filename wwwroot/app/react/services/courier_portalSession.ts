import axios from 'axios';

// Courier Portal magic-link (Item 8.5) — passwordless session store + redemption.
//
// A courier opens /drive/<slug>/<token>; we POST the opaque token to
// /api/portal/courier/auth/validate (anonymous) and get back a signed SESSION
// token (+ a thin profile). The session token is stored and then attached as
// X-Portal-Token on every /api/v1/courier/* call (see courier_api.ts), where
// PortalCourierAuthenticationHandler authenticates it. Distinct from the Hub
// shared-cookie path used by SSO couriers — both reach the same courier pages.

const TOKEN_KEY = 'portal.courier.token';
const PROFILE_KEY = 'portal.courier.profile';

export interface CourierPortalProfile {
  id: number;
  code: string;
  firstName: string;
  surName: string;
  email: string;
  phone: string;
}

export interface CourierPortalSession {
  token: string;
  expires: string;
  courier: CourierPortalProfile;
}

export const courierPortalSession = {
  getToken: (): string | null =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null,

  getProfile: (): CourierPortalProfile | null => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? (JSON.parse(raw) as CourierPortalProfile) : null;
    } catch {
      return null;
    }
  },

  adopt: (s: CourierPortalSession) => {
    localStorage.setItem(TOKEN_KEY, s.token);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(s.courier));
  },

  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);
  },
};

// Own axios instance (no Hub cookie, no token interceptor) — redemption is
// anonymous and must not carry a possibly-stale session token.
const portalApi = axios.create({
  baseURL: '/api/portal/courier',
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // CSRF middleware requirement
  },
});

export const courierPortalAuthService = {
  validate: (driveToken: string): Promise<CourierPortalSession> =>
    portalApi.post<CourierPortalSession>('/auth/validate', { driveToken }).then(r => r.data),
};
