import axios from 'axios';

/**
 * Axios instance for settings endpoints that live under /api/v1/settings/
 * (Contracts, Document Types, Recruitment Stages)
 * These are tenant-admin scoped, not NP-scoped.
 */
const settingsApi = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || '/api/v1/settings',
  headers: { 'Content-Type': 'application/json' },
});

settingsApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('np_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

settingsApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('np_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default settingsApi;
