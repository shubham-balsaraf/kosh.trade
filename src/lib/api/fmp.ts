const FMP_LEGACY = process.env.FMP_API_BASE || "https://financialmodelingprep.com/api/v3";

function apiKey(): string {
  return process.env.FMP_API_KEY || "";
}

/**
 * FMP stable routes reject many symbols that include dots or odd characters.
 * Class shares use hyphens on FMP (e.g. BRK.B → BRK-B).
 */
export function sanitizeFmpSymbol(raw: string): string {
  const u = String(raw ?? "").trim().toUpperCase();
  if (!u) return "";
  const normalized = u.replace(/\./g, "-");
  return normalized.replace(/[^A-Z0-9-]/g, "").slice(0, 12);
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
  "/search-symbol": TTL_SEARCH,
  "/company-screener": TTL_SEARCH,
  "/earnings-calendar": TTL_FUNDAMENTALS,
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
  "/insider-trading/search": TTL_SIGNAL,
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
const FMP_FALLBACK = FMP_LEGACY;

async function fmpFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error("FMP_API_KEY is not configured");

  const safeParams = { ...params };
  if (safeParams.symbol) {
    const s = sanitizeFmpSymbol(safeParams.symbol);
    if (!s) {
      console.warn(`[FMP] Skipping request — invalid symbol: ${JSON.stringify(params.symbol)}`);
      return [] as unknown as T;
    }
    safeParams.symbol = s;
  }

  const cacheKey = buildCacheKey(endpoint, safeParams);
  const cached = getFromCache<T>(cacheKey);
  if (cached !== null) return cached;

  const bases = [FMP_STABLE, FMP_FALLBACK];
  let lastError = "";

  for (const base of bases) {
    try {
      const url = new URL(`${base}${endpoint}`);
      url.searchParams.set("apikey", key);
      for (const [k, v] of Object.entries(safeParams)) {
        url.searchParams.set(k, v);
      }

      const res = await fetch(url.toString(), { cache: "no-store" });

      if (res.status === 429) {
        console.warn(`[FMP] ${endpoint} rate limited (429) — retrying in 3s`);
        await new Promise((r) => setTimeout(r, 3000));
        const retry = await fetch(url.toString(), { cache: "no-store" });
        if (retry.status === 429) {
          console.warn(`[FMP] ${endpoint} still rate limited — waiting 5s`);
          await new Promise((r) => setTimeout(r, 5000));
          const retry2 = await fetch(url.toString(), { cache: "no-store" });
          if (!retry2.ok) { lastError = `429 rate-limited after 3 retries`; continue; }
          const json2 = await retry2.json();
          if (json2 && typeof json2 === "object" && "Error Message" in json2) { lastError = json2["Error Message"]; continue; }
          setCache(cacheKey, json2, getCacheTTL(endpoint));
          return json2;
        }
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

      if (res.status === 402) {
        console.warn(`[FMP] ${endpoint} returned 402 (plan limitation) — returning empty`);
        return [] as unknown as T;
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

  const safeParams = { ...params };
  if (safeParams.symbol) {
    const s = sanitizeFmpSymbol(safeParams.symbol);
    if (!s) {
      console.warn(`[FMP/stable] Skipping request — invalid symbol: ${JSON.stringify(params.symbol)}`);
      return [] as unknown as T;
    }
    safeParams.symbol = s;
  }

  const cacheKey = buildCacheKey(`/stable${endpoint}`, safeParams);
  const cached = getFromCache<T>(cacheKey);
  if (cached !== null) return cached;

  const url = new URL(`${FMP_STABLE}${endpoint}`);
  url.searchParams.set("apikey", key);
  for (const [k, v] of Object.entries(safeParams)) {
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

  if (res.status === 402 || res.status === 403) {
    console.warn(`[FMP/stable] ${endpoint} returned ${res.status} (plan limitation) — returning empty`);
    return [] as unknown as T;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[FMP/stable] ${endpoint} returned ${res.status}: ${body.substring(0, 200)}`);
    throw new Error(`FMP stable API error: ${res.status}`);
  }

  const json = await res.json();
  if (json && typeof json === "object" && "Error Message" in json) {
    const em = String((json as Record<string, unknown>)["Error Message"] || "");
    console.warn(`[FMP/stable] ${endpoint}: ${em}`);
    // Stable API returns 200 + Error Message for bad symbols / validation (e.g. "pattern" errors).
    const softFail =
      /pattern|invalid\s+symbol|symbol\s+not\s+found|not\s+available|no\s+data|premium/i.test(em);
    if (softFail) {
      return [] as unknown as T;
    }
    throw new Error(`FMP stable API error: ${em}`);
  }

  setCache(cacheKey, json, getCacheTTL(endpoint));
  return json;
}

/* ── Exported API methods ────────────────────────────── */

export async function getQuote(ticker: string) {
  const data = await fmpFetch<any[]>("/quote", { symbol: ticker.toUpperCase() });
  return data?.[0] || null;
}

/** FMP stable/legacy profile rows use `mktCap` or `marketCap` depending on endpoint/version. */
function normalizeProfileRow(raw: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const mcRaw = raw.mktCap ?? raw.marketCap;
  const mktCap = typeof mcRaw === "number" && Number.isFinite(mcRaw) ? mcRaw : Number(mcRaw);
  const cap = Number.isFinite(mktCap) ? mktCap : 0;
  return {
    ...raw,
    mktCap: cap,
    marketCap: typeof raw.marketCap === "number" ? raw.marketCap : cap,
  };
}

export async function getProfile(ticker: string) {
  const data = await fmpFetch<any[]>("/profile", { symbol: ticker.toUpperCase() });
  const row = data?.[0];
  return normalizeProfileRow(row as Record<string, unknown>) as any;
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

export interface StockSearchRow {
  symbol: string;
  name: string;
  currency?: string;
  stockExchange?: string;
  exchangeShortName?: string;
}

function normalizeSearchRow(r: Record<string, unknown>): StockSearchRow | null {
  const symbol = String(r.symbol || r.ticker || "").trim().toUpperCase();
  if (!symbol) return null;
  const name = String(r.name || r.companyName || symbol);
  return {
    symbol,
    name,
    currency: r.currency as string | undefined,
    stockExchange: (r.stockExchange || r.exchange) as string | undefined,
    exchangeShortName: (r.exchangeShortName || r.exchange) as string | undefined,
  };
}

/**
 * True if the user is probably typing a ticker, not a company name.
 * Long all-letter strings ("google", "amazon") are names — not tickers — so we avoid
 * prefix-matching them against symbols like GOOP (GOOG*).
 */
function queryLooksLikeTicker(q: string): boolean {
  const s = q.trim();
  if (!s || /\s/.test(s)) return false;
  if (s.length > 12) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9.^*-]*$/.test(s)) return false;
  if (s.length >= 6 && /^[A-Za-z]+$/.test(s)) return false;
  return true;
}

/** Normalized company / brand → primary US symbols (search disambiguation). */
const SEARCH_BRAND_ALIASES: Readonly<Record<string, readonly string[]>> = {
  google: ["GOOGL", "GOOG"],
  alphabet: ["GOOGL", "GOOG"],
  youtube: ["GOOGL", "GOOG"],
  amazon: ["AMZN"],
  microsoft: ["MSFT"],
  apple: ["AAPL"],
  netflix: ["NFLX"],
  nvidia: ["NVDA"],
  tesla: ["TSLA"],
  facebook: ["META"],
  meta: ["META"],
  instagram: ["META"],
  whatsapp: ["META"],
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Score how well the company name matches a human query (word boundaries). */
function nameMatchScore(displayName: string, ql: string): number {
  const name = displayName.toLowerCase();
  if (!name || !ql) return 0;
  let score = 0;
  const words = ql.split(/\s+/).map((w) => w.trim()).filter((w) => w.length > 1);
  const terms = words.length > 0 ? words : [ql];

  for (const term of terms) {
    if (term.length < 2) continue;
    try {
      const boundary = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
      if (boundary.test(displayName)) score += 220;
      else if (name.includes(term)) score += 95;
    } catch {
      if (name.includes(term)) score += 95;
    }
  }

  if (name.startsWith(ql)) score += 45;
  return score;
}

function aliasBoostForSymbol(sym: string, ql: string): number {
  let best = 0;
  const words = ql.split(/\s+/).map((w) => w.toLowerCase()).filter((w) => w.length >= 2);
  for (const key of words.length > 0 ? words : [ql]) {
    const symbols = SEARCH_BRAND_ALIASES[key];
    if (!symbols) continue;
    const idx = symbols.indexOf(sym);
    const b = idx === 0 ? 480 : idx > 0 ? 420 : 0;
    if (b > best) best = b;
  }
  return best;
}

function exchangeRank(exchangeShortName: string | undefined, stockExchange: string | undefined): number {
  const u = `${exchangeShortName || ""} ${stockExchange || ""}`.toUpperCase();
  if (u.includes("NASDAQ") && !u.includes("OTC")) return 90;
  if (/\bNYSE\b/.test(u) && !u.includes("OTC")) return 85;
  if (u.includes("AMEX") || u.includes("ARCA") || u.includes("BATS")) return 70;
  if (u.includes("NEO") || u.includes("TSX") || u.includes("TORONTO") || u.includes("CBOE CA")) return 15;
  if (u.includes("LSE") || u.includes("LONDON")) return 20;
  if (u.includes("OTC")) return 25;
  return 40;
}

/** Prefer US primary listings; deprioritize alternate tickers like CSCO.NE */
function symbolListingPenalty(symbol: string): number {
  if (/-USD$|-EUR$|-GBP$/i.test(symbol)) return 0;
  if (/\.[A-Z0-9]{1,5}$/i.test(symbol)) return -120;
  return 0;
}

function rankSearchResults(query: string, rows: StockSearchRow[]): StockSearchRow[] {
  const q = query.trim();
  const qu = q.toUpperCase();
  const ql = q.toLowerCase();
  const tickerish = queryLooksLikeTicker(q);

  const scored = rows.map((r) => {
    let score = 0;
    const sym = r.symbol.toUpperCase();
    const displayName = r.name || "";

    if (sym === qu) score += 520;
    else if (tickerish && sym.startsWith(qu)) {
      score += 280;
      if (qu.length >= 2 && sym.length > qu.length) {
        score += (sym.length - qu.length) * 22;
      }
    } else if (sym.includes(qu) && qu.length >= 2) score += 120;

    score += nameMatchScore(displayName, ql);
    score += aliasBoostForSymbol(sym, ql);

    score += exchangeRank(r.exchangeShortName, r.stockExchange);
    score += symbolListingPenalty(r.symbol);

    if (tickerish && qu.length >= 3 && sym.startsWith(qu) && !displayName.toLowerCase().includes(ql)) {
      const aliasHit = aliasBoostForSymbol(sym, ql) > 0;
      if (!aliasHit) score -= 35;
    }

    return { r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((x) => x.r);
}

/**
 * Merges FMP name + symbol search, dedupes, ranks (ticker queries and US listings first).
 */
export async function searchStocks(query: string): Promise<StockSearchRow[]> {
  const q = query.trim();
  if (!q) return [];

  const [nameRaw, symRaw] = await Promise.all([
    fmpFetch<any[]>("/search-name", { query: q, limit: "15" }).catch(() => []),
    stableFetch<any[]>("/search-symbol", { query: q, limit: "20" }).catch(() => []),
  ]);

  const merged = new Map<string, StockSearchRow>();
  for (const raw of [...(Array.isArray(symRaw) ? symRaw : []), ...(Array.isArray(nameRaw) ? nameRaw : [])]) {
    const row = normalizeSearchRow(raw as Record<string, unknown>);
    if (!row) continue;
    if (!merged.has(row.symbol)) merged.set(row.symbol, row);
  }

  return rankSearchResults(q, [...merged.values()]).slice(0, 15);
}

/** @deprecated Use searchStocks — kept for any direct imports */
export async function searchTicker(query: string) {
  return searchStocks(query);
}

export async function getStockScreener(params: Record<string, string>) {
  return fmpFetch<any[]>("/company-screener", params);
}

export async function getEarningsCalendar(from?: string, to?: string) {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return fmpFetch<any[]>("/earnings-calendar", params);
}

export async function getInsiderTrading(ticker: string, limit = 20) {
  return stableFetch<any[]>("/insider-trading/search", { symbol: ticker.toUpperCase(), limit: String(limit) });
}

export async function getEarnings(ticker: string) {
  return fmpFetch<any[]>("/earnings", { symbol: ticker.toUpperCase() });
}

export async function getEarningsSurprises(ticker: string) {
  return fmpFetch<any[]>("/earnings-surprises", { symbol: ticker.toUpperCase() });
}

export async function getStockNews(ticker: string, limit = 10) {
  return stableFetch<any[]>("/news/stock-latest", { tickers: ticker.toUpperCase(), limit: String(limit) });
}

export async function getMarketNews(limit = 30) {
  return stableFetch<any[]>("/news/stock-latest", { limit: String(limit) });
}

export async function getBulkInsiderTrading(limit = 50) {
  return stableFetch<any[]>("/insider-trading/latest", { limit: String(limit) });
}

export async function getTopGainersLosers() {
  const [gainers, losers] = await Promise.all([
    fmpFetch<any[]>("/company-screener", {
      marketCapMoreThan: "500000000",
      volumeMoreThan: "2000000",
      changeMoreThan: "3",
      limit: "15",
      exchange: "NYSE,NASDAQ",
    }),
    fmpFetch<any[]>("/company-screener", {
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
  const date = new Date().toISOString().slice(0, 10);
  return stableFetch<any[]>("/sector-performance-snapshot", { date });
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

/* ── DCF Valuation ──────────────────────────────────── */

export async function getDCFValuation(ticker: string) {
  return stableFetch<any[]>("/discounted-cash-flow", { symbol: ticker.toUpperCase() });
}
