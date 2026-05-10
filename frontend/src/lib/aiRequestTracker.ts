/**
 * Tracks in-flight LLM-bound requests so the Settings page can lock the
 * provider/key/model controls while a request is running.
 *
 * Why: per-request LLM clients (see backend) make data flow safe even if a
 * user changes their key mid-call, but we still don't want to surprise them.
 * The lock is purely a UX guard.
 *
 * The counter is incremented by the axios interceptor for any URL matching
 * isAiRequest(method, url), and decremented when the response settles
 * (success OR failure - both branches of the response interceptor decrement).
 *
 * For SSE/fetch-based callers (chat stream, agentic tailor stream) the
 * caller must wrap its work with begin()/end() since axios interceptors
 * don't fire for fetch.
 */

type Listener = (active: boolean, count: number) => void;

class AiRequestTracker {
  private count = 0;
  private listeners = new Set<Listener>();

  begin(): void {
    this.count += 1;
    this.notify();
  }

  end(): void {
    if (this.count > 0) {
      this.count -= 1;
      this.notify();
    }
  }

  isActive(): boolean {
    return this.count > 0;
  }

  getCount(): number {
    return this.count;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Fire once so subscribers get the current state on mount.
    listener(this.count > 0, this.count);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const active = this.count > 0;
    for (const listener of this.listeners) {
      try {
        listener(active, this.count);
      } catch {
        // ignore listener errors so one bad subscriber can't break the rest
      }
    }
  }
}

export const aiRequestTracker = new AiRequestTracker();

/**
 * Matches the LLM-bound endpoints. Kept in sync with backend endpoints that
 * depend on get_llm_client. All are POST so we filter by method first.
 */
const AI_URL_PATTERNS: readonly RegExp[] = [
  /\/resumes\/[^/]+\/tailor(\/stream)?$/,
  /\/applications\/[^/]+\/analyze_job$/,
  /\/setup\/generate-resume-yaml$/,
  /\/context-files\/ingest$/,
  /\/chat\/[^/]+\/message(\/stream)?$/,
  /\/interviews\/[^/]+\/generate$/,
  /\/interviews\/questions\/[^/]+\/answer$/,
  /\/questions\/[^/]+\/generate$/,
  /\/questions\/[^/]+\/refine$/,
];

export function isAiRequest(method: string | undefined | null, url: string | undefined | null): boolean {
  if (!url) return false;
  if ((method ?? '').toLowerCase() !== 'post') return false;
  // Strip query string before matching the route.
  const path = url.split('?')[0];
  return AI_URL_PATTERNS.some((pattern) => pattern.test(path));
}
