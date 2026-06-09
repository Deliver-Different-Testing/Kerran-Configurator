import axios from 'axios';

// Client Reporting lane axios instance. Auth via the shared Hub cookie (same
// pattern as tenant_api.ts / np_api.ts). Sends X-Requested-With on every
// request so the configurator's CSRF middleware accepts the POST /generate
// and /prospect calls (raw fetch would 400). Base path matches the Reporting
// controllers' /api/v1/reporting/* routes.
const api = axios.create({
  baseURL: '/api/v1/reporting',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = '/Account/Logout';
    }
    return Promise.reject(err);
  }
);

export default api;
