const FMP_BASE = process.env.FMP_API_BASE || "https://financialmodelingprep.com/api/v3";

function apiKey(): string {
  return process.env.FMP_API_KEY || "";
}

/* ── In-memory TTL cache ─────────────────────────────── */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();

const TTL_QUOTE = 5 * 60 * 1000;         // 5 min  — prices move
const TTL_FUNDAMENTALS = 60 * 60 * 1000;  // 1 hour — financials are quarterly
const TTL_PROFILE = 24 * 60 * 60 * 1000;  // 24 hr  — company profile rarely changes
const TTL_SEARCH = 30 * 60 * 1000;        // 30 min

const TTL_SIGNAL = 10 * 60 * 1000;      // 10 min — signal data refreshes often

const ENDPOINT_TTL: Record<string, number> = {
  "/quote": TTL_QUOTE,
  "/profile": TTL_PROFILE,
  "/income-statement": TTL_FUNDAMENTALS,
  "/balance-sheet-statement": TTL_FUNDAMENTALS,
  "/cash-flow-statement": TTL_FUNDAMENTALS,
  "/key-metrics": TTL_FUNDAMENTALS,
  "/ratios": TTL_FUNDAMENTALS,
  "/earnings": TTL_FUNDAMENTALS,
  "/earnings-surprises": TTL_FUNDAMENTALS,
  "/historical-price-eod/full": TTL_QUOTE,
  "/search-name": TTL_SEARCH,
  "/stock-screener": TTL_SEARCH,
  "/earning-calendar": TTL_FUNDAMENTALS,
  "/insider-trading": TTL_FUNDAMENTALS,
  "/stock-news": TTL_QUOTE,
  "/senate-latest": TTL_SIGNAL,
  "/house-latest": TTL_SIGNAL,
  "/senate-trades": TTL_SIGNAL,
  "/house-trades": TTL_SIGNAL,
  "/biggest-gainers": TTL_QUOTE,
  "/biggest-losers": TTL_QUOTE,
  "/most-actives": TTL_QUOTE,
  "/grades": TTL_SIGNAL,
  "/upgrades-downgrades-consensus-bulk": TTL_SIGNAL,
  "/news/press-releases-latest": TTL_QUOTE,
  "/news/stock-latest": TTL_QUOTE,
  "/news/crypto-latest": TTL_QUOTE,
  "/insider-trading/latest": TTL_SIGNAL,
  "/insider-trading/statistics": TTL_SIGNAL,
  "/sector-performance-snapshot": TTL_QUOTE,
  "/industry-performance-snapshot": TTL_QUOTE,
  "/mergers-acquisitions-latest": TTL_SIGNAL,
  "/price-target-consensus": TTL_FUNDAMENTALS,
  "/analyst-estimates": TTL_FUNDAMENTALS,
  "/ratings-snapshot": TTL_FUNDAMENTALS,
  "/institutional-ownership/latest": TTL_SIGNAL,
  "/sec-filings-8k": TTL_SIGNAL,
  "/stock-peers": TTL_PROFILE,
};

function getCacheTTL(endpoint: string): number {
  return ENDPOINT_TTL[endpoint] ?? TTL_FUNDAMENTALS;
}

function buildCacheKey(endpoint: string, params: Record<string, string>): string {
  const sorted = Object.entries(params)
    .filter(([k]) => k !== "apikey")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `fmp:${endpoint}?${sorted}`;
}

function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttl: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });

  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expiresAt) cache.delete(k);
    }
  }
}

/* ── Core fetch with cache ───────────────────────────── */

const FMP_STABLE = "https://financialmodelingprep.com/stable";
const FMP_FALLBACK = FMP_STABLE;

async function fmpFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error("FMP_API_KEY is not configured");

  const cacheKey = buildCacheKey(endpoint, params);
  const cached = getFromCache<T>(cacheKey);
  if (cached !== null) return cached;

  const bases = [FMP_BASE, FMP_FALLBACK];
  let lastError = "";

  for (const base of bases) {
    try {
      const url = new URL(`${base}${endpoint}`);
      url.searchParams.set("apikey", key);
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }

      const res = await fetch(url.toString(), { cache: "no-store" });

      if (res.status === 429) {
        console.warn(`[FMP] ${endpoint} rate limited (429) — retrying in 1s`);
        await new Promise((r) => setTimeout(r, 1000));
        const retry = await fetch(url.toString(), { cache: "no-store" });
        if (!retry.ok) { lastError = `${retry.status}`; continue; }
        const retryJson = await retry.json();
        if (retryJson && typeof retryJson === "object" && "Error Message" in retryJson) {
          lastError = retryJson["Error Message"]; continue;
        }
        setCache(cacheKey, retryJson, getCacheTTL(endpoint));
        return retryJson;
      }

      if (res.status === 404 || res.status === 403) {
        lastError = `${res.status} from ${base}`;
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[FMP] ${endpoint} returned ${res.status}: ${body.substring(0, 200)}`);
        throw new Error(`FMP API error: ${res.status}`);
      }

      const json = await res.json();
      if (json && typeof json === "object" && "Error Message" in json) {
        lastError = json["Error Message"]; continue;
      }

      setCache(cacheKey, json, getCacheTTL(endpoint));
      return json;
    } catch (e: any) {
      if (e.message?.includes("FMP API error")) throw e;
      lastError = e.message || "unknown";
    }
  }

  console.error(`[FMP] ${endpoint} failed on all bases: ${lastError}`);
  throw new Error(`FMP API error: ${lastError}`);
}

async function stableFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error("FMP_API_KEY is not configured");

  const cacheKey = buildCacheKey(`/stable${endpoint}`, params);
  const cached = getFromCache<T>(cacheKey);
  if (cached !== null) return cached;

  const url = new URL(`${FMP_STABLE}${endpoint}`);
  url.searchParams.set("apikey", key);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { cache: "no-store" });

  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1000));
    const retry = await fetch(url.toString(), { cache: "no-store" });
    if (!retry.ok) throw new Error(`FMP stable API error: ${retry.status}`);
    const json = await retry.json();
    setCache(cacheKey, json, getCacheTTL(endpoint));
    return json;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[FMP/stable] ${endpoint} returned ${res.status}: ${body.substring(0, 200)}`);
    throw new Error(`FMP stable API error: ${res.status}`);
  }

  const json = await res.json();
  if (json && typeof json === "object" && "Error Message" in json) {
    throw new Error(`FMP stable API error: ${(json as any)["Error Message"]}`);
  }

  setCache(cacheKey, json, getCacheTTL(endpoint));
  return json;
}

/* ── Exported API methods ────────────────────────────── */

export async function getQuote(ticker: string) {
  const data = await fmpFetch<any[]>("/quote", { symbol: ticker.toUpperCase() });
  return data?.[0] || null;
}

export async function getProfile(ticker: string) {
  const data = await fmpFetch<any[]>("/profile", { symbol: ticker.toUpperCase() });
  return data?.[0] || null;
}

export async function getIncomeStatement(ticker: string, period: "annual" | "quarter" = "annual", limit = 10) {
  return fmpFetch<any[]>("/income-statement", { symbol: ticker.toUpperCase(), period, limit: String(limit) });
}

export async function getBalanceSheet(ticker: string, period: "annual" | "quarter" = "annual", limit = 10) {
  return fmpFetch<any[]>("/balance-sheet-statement", { symbol: ticker.toUpperCase(), period, limit: String(limit) });
}

export async function getCashFlow(ticker: string, period: "annual" | "quarter" = "annual", limit = 10) {
  return fmpFetch<any[]>("/cash-flow-statement", { symbol: ticker.toUpperCase(), period, limit: String(limit) });
}

export async function getKeyMetrics(ticker: string, period: "annual" | "quarter" = "annual", limit = 10) {
  return fmpFetch<any[]>("/key-metrics", { symbol: ticker.toUpperCase(), period, limit: String(limit) });
}

export async function getRatios(ticker: string, period: "annual" | "quarter" = "annual", limit = 10) {
  return fmpFetch<any[]>("/ratios", { symbol: ticker.toUpperCase(), period, limit: String(limit) });
}

export async function getHistoricalPrice(ticker: string, from?: string, to?: string) {
  const params: Record<string, string> = { symbol: ticker.toUpperCase() };
  if (from) params.from = from;
  if (to) params.to = to;
  const result = await fmpFetch<any>("/historical-price-eod/full", params);
  if (Array.isArray(result)) return result;
  if (result?.historical) return result.historical;
  return [];
}

export async function searchTicker(query: string) {
  return fmpFetch<any[]>("/search-name", { query, limit: "10" });
}

export async function getStockScreener(params: Record<string, string>) {
  return fmpFetch<any[]>("/stock-screener", params);
}

export async function getEarningsCalendar(from?: string, to?: string) {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return fmpFetch<any[]>("/earning-calendar", params);
}

export async function getInsiderTrading(ticker: string, limit = 20) {
  return fmpFetch<any[]>("/insider-trading", { symbol: ticker.toUpperCase(), limit: String(limit) });
}

export async function getEarnings(ticker: string) {
  return fmpFetch<any[]>("/earnings", { symbol: ticker.toUpperCase() });
}

export async function getEarningsSurprises(ticker: string) {
  return fmpFetch<any[]>("/earnings-surprises", { symbol: ticker.toUpperCase() });
}

export async function getStockNews(ticker: string, limit = 10) {
  return fmpFetch<any[]>("/stock-news", { symbol: ticker.toUpperCase(), limit: String(limit) });
}

export async function getMarketNews(limit = 30) {
  return fmpFetch<any[]>("/stock-news", { limit: String(limit) });
}

export async function getBulkInsiderTrading(limit = 50) {
  return fmpFetch<any[]>("/insider-trading", { limit: String(limit) });
}

export async function getTopGainersLosers() {
  const [gainers, losers] = await Promise.all([
    fmpFetch<any[]>("/stock-screener", {
      marketCapMoreThan: "500000000",
      volumeMoreThan: "2000000",
      changeMoreThan: "3",
      limit: "15",
      exchange: "NYSE,NASDAQ",
    }),
    fmpFetch<any[]>("/stock-screener", {
      marketCapMoreThan: "500000000",
      volumeMoreThan: "2000000",
      changeLessThan: "-4",
      limit: "15",
      exchange: "NYSE,NASDAQ",
    }),
  ]);
  return { gainers: gainers || [], losers: losers || [] };
}

/* ── Congressional / Political trades ────────────────── */

export async function getSenateTrades(limit = 50) {
  return stableFetch<any[]>("/senate-latest", { limit: String(limit) });
}

export async function getHouseTrades(limit = 50) {
  return stableFetch<any[]>("/house-latest", { limit: String(limit) });
}

export async function getSenateTradesByTicker(ticker: string) {
  return stableFetch<any[]>("/senate-trades", { symbol: ticker.toUpperCase() });
}

export async function getHouseTradesByTicker(ticker: string) {
  return stableFetch<any[]>("/house-trades", { symbol: ticker.toUpperCase() });
}

/* ── Market movers (direct endpoints) ────────────────── */

export async function getBiggestGainers() {
  return stableFetch<any[]>("/biggest-gainers", {});
}

export async function getBiggestLosers() {
  return stableFetch<any[]>("/biggest-losers", {});
}

export async function getMostActive() {
  return stableFetch<any[]>("/most-actives", {});
}

/* ── Analyst grades & ratings ────────────────────────── */

export async function getAnalystGrades(ticker: string) {
  return stableFetch<any[]>("/grades", { symbol: ticker.toUpperCase() });
}

export async function getBulkGradesConsensus() {
  return stableFetch<any[]>("/upgrades-downgrades-consensus-bulk", {});
}

/* ── Press releases & enhanced news ──────────────────── */

export async function getPressReleases(limit = 30) {
  return stableFetch<any[]>("/news/press-releases-latest", { limit: String(limit) });
}

export async function getStockNewsLatest(limit = 40) {
  return stableFetch<any[]>("/news/stock-latest", { limit: String(limit) });
}

export async function getCryptoNews(limit = 20) {
  return stableFetch<any[]>("/news/crypto-latest", { limit: String(limit) });
}

/* ── Enhanced insider trading ────────────────────────── */

export async function getInsiderTradingLatest(limit = 50) {
  return stableFetch<any[]>("/insider-trading/latest", { limit: String(limit) });
}

export async function getInsiderStats(ticker: string) {
  return stableFetch<any[]>("/insider-trading/statistics", { symbol: ticker.toUpperCase() });
}

/* ── Sector & industry performance ───────────────────── */

export async function getSectorPerformance() {
  return stableFetch<any[]>("/sector-performance-snapshot", {});
}

export async function getIndustryPerformance() {
  return stableFetch<any[]>("/industry-performance-snapshot", {});
}

/* ── M&A, price targets, estimates ───────────────────── */

export async function getLatestMergers(limit = 20) {
  return stableFetch<any[]>("/mergers-acquisitions-latest", { limit: String(limit) });
}

export async function getPriceTargetConsensus(ticker: string) {
  return stableFetch<any[]>("/price-target-consensus", { symbol: ticker.toUpperCase() });
}

export async function getAnalystEstimates(ticker: string) {
  return stableFetch<any[]>("/analyst-estimates", { symbol: ticker.toUpperCase() });
}

export async function getRatingsSnapshot(ticker: string) {
  return stableFetch<any[]>("/ratings-snapshot", { symbol: ticker.toUpperCase() });
}

/* ── Institutional & SEC filings ─────────────────────── */

export async function getInstitutionalOwnershipLatest(limit = 30) {
  return stableFetch<any[]>("/institutional-ownership/latest", { limit: String(limit) });
}

export async function getLatest8KFilings(limit = 30) {
  return stableFetch<any[]>("/sec-filings-8k", { limit: String(limit) });
}

/* ── Stock peers ─────────────────────────────────────── */

export async function getStockPeers(ticker: string) {
  return stableFetch<any[]>("/stock-peers", { symbol: ticker.toUpperCase() });
}
