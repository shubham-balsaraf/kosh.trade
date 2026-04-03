const ADANOS_BASE = "https://api.adanos.org/v1";

function apiKey(): string {
  return process.env.ADANOS_API_KEY || "";
}

export interface RedditSentiment {
  ticker: string;
  buzz: number;
  sentiment: number;
  mentions: number;
  bullishPct: number;
  bearishPct: number;
}

async function adanosFetch<T>(endpoint: string): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error("ADANOS_API_KEY not set");

  const res = await fetch(`${ADANOS_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Adanos ${res.status}`);
  return res.json();
}

export async function getRedditSentiment(ticker: string): Promise<RedditSentiment | null> {
  if (!apiKey()) return null;

  try {
    const data = await adanosFetch<any>(`/ticker/${ticker.toUpperCase()}`);
    return {
      ticker: ticker.toUpperCase(),
      buzz: data.buzz_score ?? data.buzz ?? 0,
      sentiment: data.sentiment_score ?? data.sentiment ?? 0,
      mentions: data.mention_count ?? data.mentions ?? 0,
      bullishPct: data.bullish_pct ?? data.bullish ?? 0,
      bearishPct: data.bearish_pct ?? data.bearish ?? 0,
    };
  } catch (e) {
    console.warn(`[Adanos] getRedditSentiment(${ticker}):`, (e as Error).message);
    return null;
  }
}

export async function batchRedditSentiment(
  tickers: string[],
): Promise<Map<string, RedditSentiment>> {
  const results = new Map<string, RedditSentiment>();
  if (!apiKey()) return results;

  const batch = tickers.filter((t) => !t.includes("-")).slice(0, 10);

  const settled = await Promise.allSettled(
    batch.map((t) => getRedditSentiment(t).then((s) => ({ ticker: t, sentiment: s }))),
  );

  for (const r of settled) {
    if (r.status === "fulfilled" && r.value.sentiment) {
      results.set(r.value.ticker, r.value.sentiment);
    }
  }
  console.log(`[Adanos] Reddit sentiment: ${results.size}/${batch.length} tickers`);
  return results;
}
