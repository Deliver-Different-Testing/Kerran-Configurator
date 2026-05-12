import axios from 'axios';

// Tenant-scope axios instance. Auth via the shared Hub cookie — same pattern
// as np_api.ts. Sends X-Requested-With on every request to satisfy the
// configurator's CSRF middleware on state-changing requests.
const api = axios.create({
  baseURL: '/api/v1/tenant',
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
