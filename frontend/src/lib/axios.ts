import axios from 'axios';

// In Docker the Next.js server proxies /api/v1/* to the backend container
// (see next.config.ts rewrites). The browser calls the relative path so no
// cross-origin request is made and no CORS configuration is required.
// For local dev without Docker, set NEXT_PUBLIC_API_URL to override.
const baseURL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

apiClient.interceptors.request.use(
  async (config) => {
    const method = (config.method ?? '').toLowerCase();
    if (MUTATING_METHODS.has(method)) {
      // Import lazily to avoid circular dependency at module init time
      const { getCsrfToken } = await import('./csrf');
      const token = await getCsrfToken();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers['X-CSRF-Token'] = token;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Prevents multiple simultaneous session checks when concurrent requests all get 401
let isCheckingSession = false;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const url: string = error.config?.url ?? '';

    if (status === 401 && !url.includes('auth/me') && !isCheckingSession) {
      isCheckingSession = true;
      try {
        await apiClient.get('/auth/me');
        // Session is still valid — the 401 was spurious (e.g. CSRF rotation, backend race).
        // Refresh the cached CSRF token so the next mutating request succeeds.
        const { clearCsrfToken, getCsrfToken } = await import('./csrf');
        clearCsrfToken();
        await getCsrfToken();
      } catch {
        // /auth/me also returned 401 — session is truly expired, redirect to login.
        import('./csrf').then(({ clearCsrfToken }) => clearCsrfToken());
        if (typeof window !== 'undefined') {
          try { localStorage.removeItem('rm_user'); } catch { /* ignore */ }
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      } finally {
        isCheckingSession = false;
      }
    }

    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);
