const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const UA = "Mozilla/5.0 (compatible; KoshApp/1.0)";

interface YFChartResult {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  timestamps: number[];
  closes: number[];
  currency: string;
}

export async function getChart(
  symbol: string,
  range: string = "1y",
  interval: string = "1d"
): Promise<YFChartResult | null> {
  try {
    const url = `${YF_BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 300 },
    });

    if (!res.ok) return null;

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta || {};
    const price = meta.regularMarketPrice || 0;
    const previousClose = meta.chartPreviousClose || meta.previousClose || price;
    const change = price - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    return {
      symbol: meta.symbol || symbol,
      price,
      previousClose,
      change,
      changePercent,
      timestamps,
      closes: closes.filter((c: any) => c !== null),
      currency: meta.currency || "USD",
    };
  } catch (e) {
    console.error(`[Yahoo] Error fetching ${symbol}:`, e);
    return null;
  }
}

export async function getQuotes(
  symbols: string[]
): Promise<Record<string, { price: number; change: number; changePercent: number }>> {
  const results: Record<string, { price: number; change: number; changePercent: number }> = {};

  const promises = symbols.map(async (sym) => {
    const data = await getChart(sym, "1d", "1d");
    if (data) {
      results[data.symbol] = {
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
      };
    }
  });

  await Promise.all(promises);
  return results;
}
