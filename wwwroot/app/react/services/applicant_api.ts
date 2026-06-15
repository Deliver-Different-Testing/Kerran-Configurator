import axios from 'axios';

// Courier Portal (Phase 1) — applicant axios instance.
//
// NOTE: separate from the dormant portal_api.ts (a Phase-3 courier-data stub
// pointing at /api/v1/portal). This one targets the live applicant backend at
// /api/portal. Applicants have no Hub cookie (withCredentials off); auth is the
// signed session token sent as X-Portal-Token, injected per-request from
// localStorage. X-Requested-With satisfies the CSRF middleware on writes.

const TOKEN_KEY = 'portal.applicant.token';

export const applicantToken = {
  get: (): string | null =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null,
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const applicantApi = axios.create({
  baseURL: '/api/portal',
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

applicantApi.interceptors.request.use(cfg => {
  const t = applicantToken.get();
  if (t) cfg.headers.set('X-Portal-Token', t);
  return cfg;
});

export default applicantApi;

// Backend portal errors come back as { message }.
export function extractPortalError(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const data = (err as { response?: { data?: { message?: string } } }).response?.data;
    if (data?.message) return data.message;
  }
  return err instanceof Error ? err.message : fallback;
}
