import axios from 'axios';

// NP-scope axios instance. Auth is via the shared `.AspNet.SharedCookie`
// from Hub — no Bearer token. The configurator's CSRF middleware (see
// Program.cs) requires `X-Requested-With: XMLHttpRequest` on state-changing
// requests, so we set it on every call to keep things uniform.
const api = axios.create({
  baseURL: '/api/v1/np',
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
      // Session expired — bounce back through Hub to re-auth.
      window.location.href = '/Account/Logout';
    }
    return Promise.reject(err);
  }
);

export default api;
