const MARKETAUX_BASE = "https://api.marketaux.com/v1";

function apiToken(): string {
  return process.env.MARKETAUX_API_TOKEN || "";
}

export interface MarketauxArticle {
  title: string;
  description: string;
  ticker: string | null;
  sentiment: number;
  publishedAt: string;
  source: string;
}

async function marketauxFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const token = apiToken();
  if (!token) throw new Error("MARKETAUX_API_TOKEN not set");

  const url = new URL(`${MARKETAUX_BASE}${endpoint}`);
  url.searchParams.set("api_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`MarketAux ${res.status}`);
  return res.json();
}

export async function getTickerNews(symbols: string | string[], limit = 10): Promise<MarketauxArticle[]> {
  if (!apiToken()) return [];
  const symStr = Array.isArray(symbols) ? symbols.join(",") : symbols;

  try {
    const data = await marketauxFetch<any>("/news/all", {
      symbols: symStr,
      filter_entities: "true",
      limit: String(limit),
      language: "en",
    });

    const articles: MarketauxArticle[] = [];
    for (const item of data.data || []) {
      const entities = item.entities || [];
      const mainTicker = entities[0]?.symbol || null;
      const sentimentScore = item.sentiment_score ?? entities[0]?.sentiment_score ?? 0;

      articles.push({
        title: (item.title || "").slice(0, 150),
        description: (item.description || "").slice(0, 200),
        ticker: mainTicker ? mainTicker.toUpperCase() : null,
        sentiment: typeof sentimentScore === "number" ? sentimentScore : 0,
        publishedAt: item.published_at || "",
        source: item.source || "",
      });
    }
    return articles;
  } catch (e) {
    console.warn(`[MarketAux] getTickerNews(${symStr}):`, (e as Error).message);
    return [];
  }
}

export async function getTrendingNews(limit = 20): Promise<MarketauxArticle[]> {
  if (!apiToken()) return [];

  try {
    const data = await marketauxFetch<any>("/news/all", {
      filter_entities: "true",
      limit: String(limit),
      language: "en",
      sort: "entity_match_score",
    });

    const articles: MarketauxArticle[] = [];
    for (const item of data.data || []) {
      const entities = item.entities || [];
      const mainTicker = entities[0]?.symbol || null;
      const sentimentScore = item.sentiment_score ?? entities[0]?.sentiment_score ?? 0;

      articles.push({
        title: (item.title || "").slice(0, 150),
        description: (item.description || "").slice(0, 200),
        ticker: mainTicker ? mainTicker.toUpperCase() : null,
        sentiment: typeof sentimentScore === "number" ? sentimentScore : 0,
        publishedAt: item.published_at || "",
        source: item.source || "",
      });
    }
    return articles;
  } catch (e) {
    console.warn("[MarketAux] getTrendingNews:", (e as Error).message);
    return [];
  }
}
