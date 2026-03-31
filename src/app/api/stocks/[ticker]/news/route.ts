import { NextRequest, NextResponse } from "next/server";

interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
  sentiment: "bullish" | "bearish" | "neutral";
  image?: string;
}

const BULLISH_KEYWORDS = [
  "beat", "beats", "exceeds", "surpass", "upgrade", "upgraded", "outperform",
  "record", "surge", "surges", "soar", "rally", "bullish", "growth", "profit",
  "gain", "gains", "raised", "raises", "boost", "boosts", "positive", "strong",
  "highest", "breakout", "buy", "partnership", "deal", "approval", "approved",
  "revenue growth", "earnings beat", "dividend", "buyback", "acquisition",
  "all-time high", "momentum", "upside", "optimistic", "analyst",
];

const BEARISH_KEYWORDS = [
  "miss", "misses", "falls", "fell", "drop", "drops", "decline", "declines",
  "downgrade", "downgraded", "underperform", "cut", "cuts", "sell", "bearish",
  "loss", "losses", "weak", "weakness", "slump", "crash", "plunge", "warning",
  "layoff", "layoffs", "lawsuit", "investigation", "recall", "risk", "concern",
  "worst", "lowest", "below", "negative", "disappointing", "revenue miss",
  "tariff", "recession", "debt", "default", "bankruptcy",
];

function classifySentiment(text: string): "bullish" | "bearish" | "neutral" {
  const lower = text.toLowerCase();
  let bullish = 0;
  let bearish = 0;

  for (const kw of BULLISH_KEYWORDS) {
    if (lower.includes(kw)) bullish++;
  }
  for (const kw of BEARISH_KEYWORDS) {
    if (lower.includes(kw)) bearish++;
  }

  if (bullish > bearish && bullish >= 1) return "bullish";
  if (bearish > bullish && bearish >= 1) return "bearish";
  return "neutral";
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

async function fetchYahooNews(ticker: string): Promise<NewsItem[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=10&quotesCount=0&listsCount=0&enableFuzzyQuery=false&newsQueryId=tss_stock_news`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KoshApp/1.0)" },
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const news = json?.news || [];

    return news.slice(0, 8).map((n: any) => ({
      title: n.title || "",
      url: n.link || n.url || "",
      source: n.publisher || "Yahoo Finance",
      publishedAt: n.providerPublishTime
        ? new Date(n.providerPublishTime * 1000).toISOString()
        : new Date().toISOString(),
      snippet: "",
      sentiment: classifySentiment(n.title || ""),
      image: n.thumbnail?.resolutions?.[0]?.url || n.thumbnail?.url || undefined,
    }));
  } catch (e) {
    console.error("[YahooNews] Error:", e);
    return [];
  }
}

async function fetchGoogleNews(ticker: string): Promise<NewsItem[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(ticker + " stock")}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KoshApp/1.0)" },
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: NewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
      const block = match[1];
      const title = stripHtml(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
      const link = stripHtml(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || block.match(/<link\s*\/?>([^<]*)/)?.[1] || "");
      const pubDate = stripHtml(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "");
      const source = stripHtml(block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "Google News");
      const description = stripHtml(block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "");

      const imgMatch = block.match(/<media:content[^>]*url="([^"]+)"/);
      const image = imgMatch?.[1] || undefined;

      if (!title) continue;

      items.push({
        title,
        url: link,
        source,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        snippet: description.substring(0, 200),
        sentiment: classifySentiment(title + " " + description),
        image,
      });
    }

    return items;
  } catch (e) {
    console.error("[GoogleNews] Error:", e);
    return [];
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  const [yahooNews, googleNews] = await Promise.all([
    fetchYahooNews(symbol),
    fetchGoogleNews(symbol),
  ]);

  const seen = new Set<string>();
  const combined: NewsItem[] = [];

  // Yahoo first (has images), then Google as fallback
  for (const item of [...yahooNews, ...googleNews]) {
    const key = item.title.toLowerCase().substring(0, 50);
    if (seen.has(key) || !item.title) continue;
    seen.add(key);
    combined.push(item);
  }

  combined.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const news = combined.slice(0, 8);

  const bullishCount = news.filter((n) => n.sentiment === "bullish").length;
  const bearishCount = news.filter((n) => n.sentiment === "bearish").length;
  const overallSentiment = bullishCount > bearishCount ? "bullish" : bearishCount > bullishCount ? "bearish" : "neutral";
  const sentimentScore = news.length > 0 ? Math.round(((bullishCount - bearishCount) / news.length) * 100) : 0;

  return NextResponse.json({
    news,
    sentiment: {
      overall: overallSentiment,
      score: sentimentScore,
      bullish: bullishCount,
      bearish: bearishCount,
      neutral: news.length - bullishCount - bearishCount,
    },
  });
}
