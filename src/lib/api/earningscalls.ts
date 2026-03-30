const BASE = "https://api.earningscall.biz/v1";

function apiKey(): string {
  return process.env.EARNINGS_API_KEY || "";
}

async function earningsFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${endpoint}`);
  url.searchParams.set("apikey", apiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`EarningsCall API error: ${res.status}`);
  return res.json();
}

export async function getTranscript(ticker: string, year?: number, quarter?: number) {
  const params: Record<string, string> = { symbol: ticker.toUpperCase() };
  if (year) params.year = String(year);
  if (quarter) params.quarter = String(quarter);
  return earningsFetch<any>("/transcript", params);
}

export async function getTranscriptList(ticker: string) {
  return earningsFetch<any>("/transcript-list", { symbol: ticker.toUpperCase() });
}
