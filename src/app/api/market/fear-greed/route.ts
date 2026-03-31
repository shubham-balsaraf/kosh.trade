import { NextResponse } from "next/server";

const FMP_BASE = "https://financialmodelingprep.com/stable";

function apiKey(): string {
  return process.env.FMP_API_KEY || "";
}

async function fmpGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;
  const url = new URL(`${FMP_BASE}${endpoint}`);
  url.searchParams.set("apikey", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString(), { next: { revalidate: 600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function ratingFromScore(score: number): string {
  if (score <= 20) return "Extreme Fear";
  if (score <= 40) return "Fear";
  if (score <= 60) return "Neutral";
  if (score <= 80) return "Greed";
  return "Extreme Greed";
}

export async function GET() {
  try {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 250);
    const fromStr = from.toISOString().split("T")[0];
    const toStr = now.toISOString().split("T")[0];

    const [spyQuote, spyHistory, sectorPerf] = await Promise.all([
      fmpGet<any[]>("/quote", { symbol: "SPY" }),
      fmpGet<any>("/historical-price-eod/full", { symbol: "SPY", from: fromStr, to: toStr }),
      fmpGet<any[]>("/sector-performance"),
    ]);

    const spy = spyQuote?.[0];
    const history = Array.isArray(spyHistory)
      ? spyHistory
      : spyHistory?.historical || [];

    const sorted = [...history].sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const signals: { name: string; score: number; signal: string }[] = [];

    // 1. Market Momentum (SPY daily change)
    const dailyChange = spy?.changePercentage ?? spy?.changesPercentage ?? 0;
    const momScore = clamp(50 + dailyChange * 15, 0, 100);
    signals.push({
      name: "Market Momentum",
      score: Math.round(momScore),
      signal: momScore > 60 ? "Bullish" : momScore < 40 ? "Bearish" : "Neutral",
    });

    // 2. Price vs 50-day SMA
    if (sorted.length >= 50 && spy?.price) {
      const last50 = sorted.slice(-50);
      const sma50 = last50.reduce((s: number, d: any) => s + (d.close || d.adjClose || 0), 0) / 50;
      const pctAbove50 = ((spy.price - sma50) / sma50) * 100;
      const sma50Score = clamp(50 + pctAbove50 * 5, 0, 100);
      signals.push({
        name: "50-Day Trend",
        score: Math.round(sma50Score),
        signal: pctAbove50 > 2 ? "Above SMA" : pctAbove50 < -2 ? "Below SMA" : "Near SMA",
      });
    }

    // 3. Price vs 200-day SMA
    if (sorted.length >= 200 && spy?.price) {
      const last200 = sorted.slice(-200);
      const sma200 = last200.reduce((s: number, d: any) => s + (d.close || d.adjClose || 0), 0) / 200;
      const pctAbove200 = ((spy.price - sma200) / sma200) * 100;
      const sma200Score = clamp(50 + pctAbove200 * 3, 0, 100);
      signals.push({
        name: "200-Day Trend",
        score: Math.round(sma200Score),
        signal: pctAbove200 > 3 ? "Bullish" : pctAbove200 < -3 ? "Bearish" : "Neutral",
      });
    }

    // 4. Market Breadth (sectors up vs down)
    if (sectorPerf && sectorPerf.length > 0) {
      const changes = sectorPerf.map((s: any) => parseFloat(s.changesPercentage ?? s.changePercentage ?? 0));
      const up = changes.filter((c: number) => c > 0).length;
      const breadthPct = (up / Math.max(changes.length, 1)) * 100;
      const breadthScore = clamp(breadthPct, 0, 100);
      signals.push({
        name: "Market Breadth",
        score: Math.round(breadthScore),
        signal: breadthPct > 65 ? "Broad Rally" : breadthPct < 35 ? "Broad Decline" : "Mixed",
      });
    }

    // 5. 30-Day Volatility (rolling std of daily returns)
    if (sorted.length >= 30) {
      const last30 = sorted.slice(-30);
      const returns = [];
      for (let i = 1; i < last30.length; i++) {
        const prev = last30[i - 1].close || last30[i - 1].adjClose || 1;
        const curr = last30[i].close || last30[i].adjClose || 1;
        returns.push((curr - prev) / prev * 100);
      }
      const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
      const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
      const volatility = Math.sqrt(variance);
      // High vol = fear, low vol = greed. Typical range: 0.5% (calm) to 2.5% (panic)
      const volScore = clamp(100 - (volatility - 0.5) * 40, 0, 100);
      signals.push({
        name: "Volatility",
        score: Math.round(volScore),
        signal: volatility > 1.8 ? "High Vol" : volatility < 0.8 ? "Low Vol" : "Normal",
      });
    }

    // 6. 1-Month Performance
    if (sorted.length >= 22) {
      const monthAgo = sorted[sorted.length - 22]?.close || sorted[sorted.length - 22]?.adjClose || 1;
      const current = sorted[sorted.length - 1]?.close || sorted[sorted.length - 1]?.adjClose || 1;
      const monthReturn = ((current - monthAgo) / monthAgo) * 100;
      const monthScore = clamp(50 + monthReturn * 5, 0, 100);
      signals.push({
        name: "1-Month Return",
        score: Math.round(monthScore),
        signal: monthReturn > 3 ? "Strong" : monthReturn < -3 ? "Weak" : "Flat",
      });
    }

    const overallScore = signals.length > 0
      ? Math.round(signals.reduce((s, sig) => s + sig.score, 0) / signals.length)
      : 50;

    return NextResponse.json({
      score: overallScore,
      rating: ratingFromScore(overallScore),
      signals,
      spyPrice: spy?.price || null,
      spyChange: dailyChange,
      updatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[Fear&Greed]", e.message);
    return NextResponse.json({ score: 50, rating: "Neutral", signals: [], error: e.message });
  }
}
