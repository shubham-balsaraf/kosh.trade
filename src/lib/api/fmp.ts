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

const FMP_FALLBACK = "https://financialmodelingprep.com/stable";

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
