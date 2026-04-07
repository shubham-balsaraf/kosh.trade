/** Rolling list of tickers suggested for KoshPilot (Top 10, discovery, etc.). Capped to avoid unbounded scan growth. */

export const MAX_KOSHPILOT_RECOMMENDED_TICKERS = 30;

/**
 * Merge new tickers ahead of existing ones, dedupe, cap at max.
 * New recommendations (e.g. latest Top 10) stay at the front.
 */
export function mergeRecommendedTickers(
  current: string[] | null | undefined,
  incoming: string[],
  max: number = MAX_KOSHPILOT_RECOMMENDED_TICKERS,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of incoming) {
    const u = t.trim().toUpperCase();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= max) return out;
  }
  for (const t of current || []) {
    const u = t.trim().toUpperCase();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= max) break;
  }
  return out;
}
