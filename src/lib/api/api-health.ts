/**
 * Lightweight in-memory API health tracker.
 * Tracks consecutive failures per endpoint and applies automatic backoff.
 */

const healthMap = new Map<string, { failures: number; backoffUntil: number }>();
const BACKOFF_THRESHOLD = 5;
const BACKOFF_MS = 60 * 60 * 1000;

export function recordApiFailure(endpoint: string): void {
  const entry = healthMap.get(endpoint) || { failures: 0, backoffUntil: 0 };
  entry.failures++;
  if (entry.failures >= BACKOFF_THRESHOLD) {
    entry.backoffUntil = Date.now() + BACKOFF_MS;
    console.warn(`[ApiHealth] ${endpoint}: ${entry.failures} consecutive failures — backing off for 1h`);
  }
  healthMap.set(endpoint, entry);
}

export function recordApiSuccess(endpoint: string): void {
  healthMap.delete(endpoint);
}

export function isApiHealthy(endpoint: string): boolean {
  const entry = healthMap.get(endpoint);
  if (!entry) return true;
  if (Date.now() > entry.backoffUntil) {
    healthMap.delete(endpoint);
    return true;
  }
  return false;
}

export function getApiHealthSummary(): Record<string, { failures: number; backoffRemaining: number }> {
  const summary: Record<string, { failures: number; backoffRemaining: number }> = {};
  for (const [ep, entry] of healthMap) {
    summary[ep] = {
      failures: entry.failures,
      backoffRemaining: Math.max(0, entry.backoffUntil - Date.now()),
    };
  }
  return summary;
}
