const FMP_LEGACY = process.env.FMP_API_BASE || "https://financialmodelingprep.com/api/v3";

function apiKey(): string {
  const raw = process.env.FMP_API_KEY ?? "";
  return String(raw).trim().replace(/^["']|["']$/g, "");
}

/** Normalize FMP JSON error fields (stable vs legacy shapes, incl. array wrapping). */
function readFmpErrorMessage(json: unknown): string {
  if (!json) return "";
  if (typeof json === "string") {
    return isFmpSoftErrorMessage(json) ? json.trim() : "";
  }
  const first = Array.isArray(json) ? json[0] : json;
  if (!first || typeof first !== "object") return "";
  const o = first as Record<string, unknown>;
  for (const k of ["Error Message", "error", "message", "errorMessage"] as const) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  }
  return "";
}

/**
 * Treat as empty-data, not fatal — FMP often returns these on strict validation, plan limits, or bad params.
 * Avoid surfacing raw "pattern" validation text to users.
 */
function isFmpSoftErrorMessage(message: string): boolean {
  const m = message.toLowerCase();
  if (!m) return false;
  return (
    /\bpattern\b/.test(m) ||
    /\bdid not match\b/.test(m) ||
    /invalid\s+symbol/.test(m) ||
    /symbol\s+not\s+found/.test(m) ||
    /not\s+available/.test(m) ||
    /\bno\s+data\b/.test(m) ||
    /\bpremium\b/.test(m) ||
    /limit\s+exceeded|rate\s+limit/.test(m) ||
    /\bunauthorized\b|\bforbidden\b/.test(m) ||
    /invalid\s+api/.test(m)
  );
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

/**
 * Build the correct URL for an FMP API call.
 *
 * Stable API:  /stable/profile?symbol=AAPL&apikey=...
 * Legacy v3:   /api/v3/profile/AAPL?apikey=...
 *
 * v3 uses path-based symbols; stable uses query params. Getting this wrong
 * causes "The string did not match the expected pattern" from FMP.
 */
function buildFmpUrl(base: string, endpoint: string, params: Record<string, string>, key: string): URL {
  const isLegacy = base.includes("/api/v");
  const symbol = params.symbol || "";

  let path = `${base}${endpoint}`;
  if (isLegacy && symbol) {
    path = `${base}${endpoint}/${encodeURIComponent(symbol)}`;
  }

  const url = new URL(path);
  url.searchParams.set("apikey", key);

  for (const [k, v] of Object.entries(params)) {
    if (isLegacy && k === "symbol") continue;
    url.searchParams.set(k, v);
  }
  return url;
}

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
      const url = buildFmpUrl(base, endpoint, safeParams, key);

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
          const txt2 = await retry2.text();
          let json2: unknown;
          try { json2 = txt2 ? JSON.parse(txt2) : null; } catch { lastError = "non-JSON after 429"; continue; }
          const err2 = readFmpErrorMessage(json2);
          if (err2) { lastError = err2; continue; }
          setCache(cacheKey, json2, getCacheTTL(endpoint));
          return json2 as T;
        }
        if (!retry.ok) { lastError = `${retry.status}`; continue; }
        const txtR = await retry.text();
        let retryJson: unknown;
        try { retryJson = txtR ? JSON.parse(txtR) : null; } catch { lastError = "non-JSON after 429"; continue; }
        const errR = readFmpErrorMessage(retryJson);
        if (errR) { lastError = errR; continue; }
        setCache(cacheKey, retryJson, getCacheTTL(endpoint));
        return retryJson as T;
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
        console.warn(`[FMP] ${endpoint} returned ${res.status} from ${base}: ${body.substring(0, 200)}`);
        if (isFmpSoftErrorMessage(body)) {
          lastError = body.substring(0, 200);
        } else {
          lastError = `${res.status} from ${base}`;
        }
        continue;
      }

      const text = await res.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        console.warn(`[FMP] ${endpoint} non-JSON from ${base}: ${text.substring(0, 120)}`);
        if (isFmpSoftErrorMessage(text)) { lastError = text.substring(0, 200); continue; }
        lastError = `non-JSON response from ${base}`;
        continue;
      }

      if (typeof json === "string") {
        if (isFmpSoftErrorMessage(json)) { lastError = json; continue; }
        lastError = json.substring(0, 200);
        continue;
      }

      const errMain = readFmpErrorMessage(json);
      if (errMain) {
        lastError = errMain;
        continue;
      }

      setCache(cacheKey, json, getCacheTTL(endpoint));
      return json as T;
    } catch (e: any) {
      lastError = e.message || "unknown";
    }
  }

  console.error(`[FMP] ${endpoint} failed on all bases: ${lastError}`);
  if (isFmpSoftErrorMessage(lastError)) {
    console.warn(`[FMP] ${endpoint}: returning empty result after soft error`);
    return [] as unknown as T;
  }
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

  let url: URL;
  try {
    url = buildFmpUrl(FMP_STABLE, endpoint, safeParams, key);
  } catch (e: any) {
    console.error(`[FMP/stable] URL construction failed for ${endpoint}: ${e.message}`);
    return [] as unknown as T;
  }

  const res = await fetch(url.toString(), { cache: "no-store" });

  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1000));
    const retry = await fetch(url.toString(), { cache: "no-store" });
    if (!retry.ok) throw new Error(`FMP stable API error: ${retry.status}`);
    const retryText = await retry.text();
    let retryJson: unknown;
    try {
      retryJson = retryText ? JSON.parse(retryText) : null;
    } catch {
      if (isFmpSoftErrorMessage(retryText)) return [] as unknown as T;
      throw new Error(`FMP stable API error: invalid JSON`);
    }
    const err429 = readFmpErrorMessage(retryJson);
    if (err429) {
      if (isFmpSoftErrorMessage(err429)) return [] as unknown as T;
      throw new Error(`FMP stable API error: ${err429}`);
    }
    setCache(cacheKey, retryJson, getCacheTTL(endpoint));
    return retryJson as T;
  }

  if (res.status === 402 || res.status === 403) {
    console.warn(`[FMP/stable] ${endpoint} returned ${res.status} (plan limitation) — returning empty`);
    return [] as unknown as T;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`[FMP/stable] ${endpoint} returned ${res.status}: ${body.substring(0, 200)}`);
    if (isFmpSoftErrorMessage(body)) return [] as unknown as T;
    throw new Error(`FMP stable API error: ${res.status}`);
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    if (isFmpSoftErrorMessage(text)) {
      console.warn(`[FMP/stable] ${endpoint}: non-JSON soft error`);
      return [] as unknown as T;
    }
    throw new Error(`FMP stable API error: invalid JSON body`);
  }

  const em = readFmpErrorMessage(json);
  if (em) {
    console.warn(`[FMP/stable] ${endpoint}: ${em}`);
    if (isFmpSoftErrorMessage(em)) return [] as unknown as T;
    throw new Error(`FMP stable API error: ${em}`);
  }

  setCache(cacheKey, json, getCacheTTL(endpoint));
  return json as T;
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
 * treating them like symbol prefixes (filters noise like GOOP vs GOOG).
 */
function queryLooksLikeTicker(q: string): boolean {
  const s = q.trim();
  if (!s || /\s/.test(s)) return false;
  if (s.length > 12) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9.^*-]*$/.test(s)) return false;
  if (s.length >= 6 && /^[A-Za-z]+$/.test(s)) return false;
  return true;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Score how well the company name matches a human query (word boundaries + token prefixes). */
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

  const nameTokens = displayName.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  for (const w of nameTokens) {
    if (ql.length >= 2 && w.startsWith(ql)) score += 185;
  }

  return score;
}

/**
 * For name-style queries, require a real tie to the company name or a tight symbol anchor
 * (first 4 chars of query vs symbol prefix) so arbitrary tickers do not outrank real matches.
 */
function symbolAnchorPrefix(qu: string): string {
  const u = qu.toUpperCase().trim();
  if (u.length <= 1) return u;
  const len = Math.min(4, Math.max(2, u.length));
  return u.slice(0, len);
}

function isSearchRowRelevant(query: string, row: StockSearchRow, tickerish: boolean): boolean {
  if (tickerish) return true;
  const q = query.trim();
  const ql = q.toLowerCase();
  const qu = q.toUpperCase();
  const sym = row.symbol.toUpperCase();
  const displayName = row.name || "";

  if (sym === qu) return true;
  if (nameMatchScore(displayName, ql) > 0) return true;

  const anchor = symbolAnchorPrefix(qu);
  if (anchor.length >= 2 && sym.startsWith(anchor)) return true;

  return false;
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
  const anchor = symbolAnchorPrefix(qu);

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
    } else if (tickerish && sym.includes(qu) && qu.length >= 2) score += 120;
    else if (!tickerish && qu.length <= 5 && sym.includes(qu) && qu.length >= 2) score += 95;

    score += nameMatchScore(displayName, ql);

    if (!tickerish && anchor.length >= 2 && sym.startsWith(anchor)) {
      score += 170 + Math.min(8, sym.length - anchor.length) * 10;
    }

    score += exchangeRank(r.exchangeShortName, r.stockExchange);
    score += symbolListingPenalty(r.symbol);

    if (tickerish && qu.length >= 3 && sym.startsWith(qu) && !displayName.toLowerCase().includes(ql)) {
      score -= 35;
    }

    return { r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((x) => x.r);
}

const SEARCH_NAME_LIMIT = "45";
const SEARCH_SYMBOL_LIMIT = "45";
const SEARCH_RESULT_CAP = 20;

/**
 * Stock search engine: parallel name + symbol queries (stable + legacy via fmpFetch),
 * name-first merge, relevance filter for company-name queries, then ranked US-primary bias.
 */
export async function searchStocks(query: string): Promise<StockSearchRow[]> {
  const q = query.trim();
  if (!q) return [];

  const qUpper = q.toUpperCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const firstToken = tokens[0] || q;
  const firstUpper = firstToken.toUpperCase();

  const nameQueries = new Set<string>([q]);
  if (firstToken !== q && firstToken.length >= 2) nameQueries.add(firstToken);

  const symQueries = new Set<string>([q, qUpper]);
  if (firstToken !== q && firstToken.length >= 2) {
    symQueries.add(firstToken);
    symQueries.add(firstUpper);
  }

  const nameJobs = [...nameQueries].map((nq) =>
    fmpFetch<any[]>("/search-name", { query: nq, limit: SEARCH_NAME_LIMIT }).catch(() => []),
  );
  const symJobs = [...symQueries].map((sq) =>
    fmpFetch<any[]>("/search-symbol", { query: sq, limit: SEARCH_SYMBOL_LIMIT }).catch(() => []),
  );

  const [nameChunks, symChunks] = await Promise.all([Promise.all(nameJobs), Promise.all(symJobs)]);

  const merged = new Map<string, StockSearchRow>();

  for (const raw of nameChunks.flat()) {
    const row = normalizeSearchRow(raw as Record<string, unknown>);
    if (row) merged.set(row.symbol, row);
  }
  for (const raw of symChunks.flat()) {
    const row = normalizeSearchRow(raw as Record<string, unknown>);
    if (row && !merged.has(row.symbol)) merged.set(row.symbol, row);
  }

  const all = [...merged.values()];
  const tickerish = queryLooksLikeTicker(q);
  const relevant = all.filter((r) => isSearchRowRelevant(q, r, tickerish));
  const pool = relevant.length > 0 ? relevant : all;

  return rankSearchResults(q, pool).slice(0, SEARCH_RESULT_CAP);
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

/** Uses stable + v3 fallback (stable-only DCF often returns validation errors on some plans/symbols). */
export async function getDCFValuation(ticker: string) {
  return fmpFetch<any[]>("/discounted-cash-flow", { symbol: ticker });
}
