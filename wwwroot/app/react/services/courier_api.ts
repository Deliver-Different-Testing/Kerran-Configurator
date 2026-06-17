import axios from 'axios';
import { courierPortalSession } from './courier_portalSession';

// Phase 2 — axios for the courier self-service surface (/api/v1/courier/*).
// Dual-auth (Item 8.5): the SAME endpoints accept either the Hub shared cookie
// (withCredentials, SSO couriers) OR a passwordless magic-link session token
// carried as X-Portal-Token (PortalCourierAuthenticationHandler). We attach the
// portal token when one is stored; otherwise the cookie carries the request.
const courierApi = axios.create({
  baseURL: '/api/v1/courier',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

courierApi.interceptors.request.use(cfg => {
  const t = courierPortalSession.getToken();
  if (t) cfg.headers.set('X-Portal-Token', t);
  return cfg;
});

courierApi.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      // Magic-link couriers have no Hub cookie — clear the lapsed session and
      // send them back to the portal login rather than to Hub sign-out.
      if (courierPortalSession.getToken()) {
        courierPortalSession.clear();
        window.location.reload();
      } else {
        window.location.href = '/Account/Logout';
      }
    }
    return Promise.reject(err);
  },
);

export default courierApi;

export function extractCourierError(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const data = (err as { response?: { data?: { message?: string } } }).response?.data;
    if (data?.message) return data.message;
  }
  return err instanceof Error ? err.message : fallback;
}
