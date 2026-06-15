import axios from 'axios';

// Phase 2 — axios for the courier self-service surface (/api/v1/courier/*).
// Couriers are authenticated by the Hub shared cookie (withCredentials), same
// as the NP/Tenant lanes — NOT the applicant signed-token. X-Requested-With
// satisfies the CSRF middleware; a 401 means the Hub session lapsed, so bounce
// to Hub sign-out (mirrors np_api).
const courierApi = axios.create({
  baseURL: '/api/v1/courier',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

courierApi.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) window.location.href = '/Account/Logout';
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
