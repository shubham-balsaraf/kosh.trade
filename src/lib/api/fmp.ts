const FMP_BASE = "https://financialmodelingprep.com/api/v3";

function apiKey(): string {
  return process.env.FMP_API_KEY || "";
}

async function fmpFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FMP_BASE}${endpoint}`);
  url.searchParams.set("apikey", apiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`FMP API error: ${res.status}`);
  return res.json();
}

export async function getQuote(ticker: string) {
  const data = await fmpFetch<any[]>(`/quote/${ticker.toUpperCase()}`);
  return data?.[0] || null;
}

export async function getProfile(ticker: string) {
  const data = await fmpFetch<any[]>(`/profile/${ticker.toUpperCase()}`);
  return data?.[0] || null;
}

export async function getIncomeStatement(ticker: string, period: "annual" | "quarter" = "annual", limit = 10) {
  return fmpFetch<any[]>(`/income-statement/${ticker.toUpperCase()}`, { period, limit: String(limit) });
}

export async function getBalanceSheet(ticker: string, period: "annual" | "quarter" = "annual", limit = 10) {
  return fmpFetch<any[]>(`/balance-sheet-statement/${ticker.toUpperCase()}`, { period, limit: String(limit) });
}

export async function getCashFlow(ticker: string, period: "annual" | "quarter" = "annual", limit = 10) {
  return fmpFetch<any[]>(`/cash-flow-statement/${ticker.toUpperCase()}`, { period, limit: String(limit) });
}

export async function getKeyMetrics(ticker: string, period: "annual" | "quarter" = "annual", limit = 10) {
  return fmpFetch<any[]>(`/key-metrics/${ticker.toUpperCase()}`, { period, limit: String(limit) });
}

export async function getRatios(ticker: string, period: "annual" | "quarter" = "annual", limit = 10) {
  return fmpFetch<any[]>(`/ratios/${ticker.toUpperCase()}`, { period, limit: String(limit) });
}

export async function getHistoricalPrice(ticker: string, from?: string, to?: string) {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return fmpFetch<any>(`/historical-price-full/${ticker.toUpperCase()}`, params);
}

export async function searchTicker(query: string) {
  return fmpFetch<any[]>("/search", { query, limit: "10", exchange: "NASDAQ,NYSE" });
}

export async function getStockScreener(params: Record<string, string>) {
  return fmpFetch<any[]>("/stock-screener", params);
}

export async function getEarningsCalendar(from?: string, to?: string) {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return fmpFetch<any[]>("/earning_calendar", params);
}

export async function getInsiderTrading(ticker: string, limit = 20) {
  return fmpFetch<any[]>(`/insider-trading`, { symbol: ticker.toUpperCase(), limit: String(limit) });
}
