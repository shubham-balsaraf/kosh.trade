const FRED_BASE = "https://api.stlouisfed.org/fred";

function apiKey(): string {
  return process.env.FRED_API_KEY || "";
}

async function fredFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FRED_BASE}${endpoint}`);
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("file_type", "json");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FRED API error: ${res.status}`);
  return res.json();
}

export async function getSeriesObservations(seriesId: string, limit = 60) {
  return fredFetch<any>("/series/observations", {
    series_id: seriesId,
    sort_order: "desc",
    limit: String(limit),
  });
}

export const MACRO_SERIES = {
  GDP_GROWTH: "A191RL1Q225SBEA",
  UNEMPLOYMENT: "UNRATE",
  CPI: "CPIAUCSL",
  FED_FUNDS: "FEDFUNDS",
  YIELD_CURVE_10Y2Y: "T10Y2Y",
  SP500: "SP500",
} as const;
