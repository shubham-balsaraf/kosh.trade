const ST_BASE = "https://api.stocktwits.com/api/2";

export interface StocktwitsSentiment {
  ticker: string;
  bullish: number;
  bearish: number;
  totalMessages: number;
  sentimentScore: number; // -1 to +1
  trending: boolean;
}

export interface StocktwitsTrending {
  ticker: string;
  watchlistCount: number;
}

async function stFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${ST_BASE}${endpoint}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`Stocktwits ${res.status}`);
  return res.json();
}

export async function getTickerSentiment(ticker: string): Promise<StocktwitsSentiment | null> {
  try {
    const data = await stFetch<any>(`/streams/symbol/${ticker.toUpperCase()}.json`);
    const messages = data.messages || [];
    if (messages.length === 0) return null;

    let bullish = 0;
    let bearish = 0;
    let labeled = 0;

    for (const msg of messages) {
      const s = msg.entities?.sentiment?.basic;
      if (s === "Bullish") { bullish++; labeled++; }
      else if (s === "Bearish") { bearish++; labeled++; }
    }

    const total = messages.length;
    const bullishPct = labeled > 0 ? bullish / labeled : 0.5;
    const bearishPct = labeled > 0 ? bearish / labeled : 0.5;
    const sentimentScore = labeled > 0 ? (bullish - bearish) / labeled : 0;

    return {
      ticker: ticker.toUpperCase(),
      bullish: Math.round(bullishPct * 100),
      bearish: Math.round(bearishPct * 100),
      totalMessages: total,
      sentimentScore: Math.round(sentimentScore * 100) / 100,
      trending: data.symbol?.is_trending || false,
    };
  } catch (e) {
    console.warn(`[Stocktwits] getTickerSentiment(${ticker}):`, (e as Error).message);
    return null;
  }
}

export async function getTrendingSymbols(): Promise<StocktwitsTrending[]> {
  try {
    const data = await stFetch<any>("/trending/symbols.json");
    const symbols = data.symbols || [];
    return symbols.map((s: any) => ({
      ticker: (s.symbol || "").toUpperCase(),
      watchlistCount: s.watchlist_count || 0,
    }));
  } catch (e) {
    console.warn("[Stocktwits] getTrendingSymbols:", (e as Error).message);
    return [];
  }
}

export async function batchStocktwitsSentiment(
  tickers: string[],
): Promise<Map<string, StocktwitsSentiment>> {
  const results = new Map<string, StocktwitsSentiment>();
  const batch = tickers.filter((t) => !t.includes("-")).slice(0, 12);

  for (let i = 0; i < batch.length; i += 4) {
    const chunk = batch.slice(i, i + 4);
    const settled = await Promise.allSettled(
      chunk.map((t) => getTickerSentiment(t).then((s) => ({ ticker: t, sentiment: s }))),
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value.sentiment) {
        results.set(r.value.ticker, r.value.sentiment);
      }
    }
    if (i + 4 < batch.length) await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`[Stocktwits] Batch sentiment: ${results.size}/${batch.length} tickers`);
  return results;
}
