const UW_BASE = "https://api.unusualwhales.com/api";

function apiKey(): string {
  return process.env.UNUSUAL_WHALES_API_KEY || "";
}

async function uwFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${UW_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey()}` },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Unusual Whales API error: ${res.status}`);
  return res.json();
}

export async function getOptionsFlow(ticker?: string) {
  const params: Record<string, string> = { limit: "20" };
  if (ticker) params.ticker_symbol = ticker.toUpperCase();
  return uwFetch<any>("/stock/flow", params);
}

export async function getDarkPoolFlow(ticker?: string) {
  const params: Record<string, string> = { limit: "20" };
  if (ticker) params.ticker_symbol = ticker.toUpperCase();
  return uwFetch<any>("/darkpool/recent", params);
}

export async function getCongressionalTrades(limit = 20) {
  return uwFetch<any>("/congress/trades", { limit: String(limit) });
}

export async function getETFFlows(limit = 20) {
  return uwFetch<any>("/etf/flows", { limit: String(limit) });
}
