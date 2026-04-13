import axios from 'axios';

// In Docker the Next.js server proxies /api/v1/* to the backend container
// (see next.config.ts rewrites). The browser calls the relative path so no
// cross-origin request is made and no CORS configuration is required.
// For local dev without Docker, set NEXT_PUBLIC_API_URL to override.
const baseURL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);
