import axios from 'axios';

/**
 * Axios instance for the courier portal (public-facing).
 * PortalController route: api/v1/portal
 */
const portalApi = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || '/api/v1/portal',
  headers: { 'Content-Type': 'application/json' },
});

// Portal requests may include a courier token for authenticated portal views
portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('portal_token') || localStorage.getItem('np_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

portalApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Portal auth failure — redirect to portal login if applicable
      localStorage.removeItem('portal_token');
    }
    return Promise.reject(err);
  }
);

export default portalApi;
