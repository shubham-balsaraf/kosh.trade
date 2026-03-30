const FINNHUB_BASE = "https://finnhub.io/api/v1";

function apiKey(): string {
  return process.env.FINNHUB_API_KEY || "";
}

async function finnhubFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FINNHUB_BASE}${endpoint}`);
  url.searchParams.set("token", apiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Finnhub API error: ${res.status}`);
  return res.json();
}

export async function getEarningsCalendar(from: string, to: string) {
  return finnhubFetch<any>("/calendar/earnings", { from, to });
}

export async function getRecommendations(ticker: string) {
  return finnhubFetch<any[]>("/stock/recommendation", { symbol: ticker.toUpperCase() });
}

export async function getPriceTarget(ticker: string) {
  return finnhubFetch<any>("/stock/price-target", { symbol: ticker.toUpperCase() });
}

export async function getEPSEstimates(ticker: string, freq: "annual" | "quarterly" = "quarterly") {
  return finnhubFetch<any>("/stock/eps-estimate", { symbol: ticker.toUpperCase(), freq });
}

export async function getRevenueEstimates(ticker: string, freq: "annual" | "quarterly" = "quarterly") {
  return finnhubFetch<any>("/stock/revenue-estimate", { symbol: ticker.toUpperCase(), freq });
}
