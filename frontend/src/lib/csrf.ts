// Module-level CSRF token cache.
// No React dependency - pure module state + apiClient fetch.

import { apiClient } from './axios';

let cachedToken: string | null = null;

/**
 * Returns the cached CSRF token, or fetches a fresh one from GET /auth/csrf.
 * If the fetch fails (e.g. in local mode where it's not strictly needed),
 * resolves to null so callers can proceed anyway.
 */
export async function getCsrfToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    const res = await apiClient.get<{ csrf_token: string }>('/auth/csrf');
    cachedToken = res.data.csrf_token;
    return cachedToken;
  } catch {
    // Local mode or unauthenticated - caller proceeds without token
    return null;
  }
}

/** Store after login to avoid an extra round-trip on the first mutating request. */
export function setCsrfToken(token: string): void {
  cachedToken = token;
}

/** Clear on logout. */
export function clearCsrfToken(): void {
  cachedToken = null;
}
