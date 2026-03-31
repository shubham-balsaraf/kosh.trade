import { NextResponse } from "next/server";
import { getChart } from "@/lib/api/yahoo";

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
    const [spy, vixData] = await Promise.all([
      getChart("SPY", "1y", "1d"),
      getChart("^VIX", "6mo", "1d"),
    ]);

    const signals: { name: string; score: number; signal: string; weight: number }[] = [];

    const closes = spy?.closes || [];
    const spyPrice = spy?.price || 0;
    const dailyChange = spy?.changePercent || 0;

    const vixCloses = vixData?.closes || [];
    const vixPrice = vixData?.price || 20;

    // 1. VIX Level — THE primary fear gauge (heavy weight)
    // VIX 12→100, 18→73, 22→55, 26→37, 30→19, 35→0
    const vixScore = clamp(100 - (vixPrice - 12) * 4.5, 0, 100);
    signals.push({
      name: "VIX Level",
      score: Math.round(vixScore),
      signal: vixPrice > 30 ? "Panic" : vixPrice > 25 ? "High Fear" : vixPrice > 20 ? "Elevated" : vixPrice < 15 ? "Calm" : "Normal",
      weight: 2.5,
    });

    // 2. VIX vs its 50-day average — is fear rising or falling?
    if (vixCloses.length >= 50) {
      const vixSma50 = vixCloses.slice(-50).reduce((s, c) => s + c, 0) / 50;
      const vixPctAbove = ((vixPrice - vixSma50) / vixSma50) * 100;
      // VIX above its average = more fear than usual
      const vixTrendScore = clamp(50 - vixPctAbove * 2, 0, 100);
      signals.push({
        name: "VIX Trend",
        score: Math.round(vixTrendScore),
        signal: vixPctAbove > 20 ? "Spiking" : vixPctAbove > 5 ? "Rising" : vixPctAbove < -10 ? "Falling" : "Stable",
        weight: 1.5,
      });
    }

    // 3. Market Momentum (daily change)
    const momScore = clamp(50 + dailyChange * 20, 0, 100);
    signals.push({
      name: "Market Momentum",
      score: Math.round(momScore),
      signal: dailyChange > 1 ? "Bullish" : dailyChange < -1 ? "Bearish" : "Neutral",
      weight: 1,
    });

    // 4. 1-Week Performance
    if (closes.length >= 5) {
      const weekAgo = closes[closes.length - 5] || 1;
      const current = closes[closes.length - 1] || 1;
      const weekReturn = ((current - weekAgo) / weekAgo) * 100;
      const weekScore = clamp(50 + weekReturn * 8, 0, 100);
      signals.push({
        name: "1-Week Return",
        score: Math.round(weekScore),
        signal: weekReturn > 2 ? "Strong" : weekReturn < -2 ? "Weak" : "Flat",
        weight: 1.5,
      });
    }

    // 5. 1-Month Performance
    if (closes.length >= 22) {
      const monthAgo = closes[closes.length - 22] || 1;
      const current = closes[closes.length - 1] || 1;
      const monthReturn = ((current - monthAgo) / monthAgo) * 100;
      const monthScore = clamp(50 + monthReturn * 6, 0, 100);
      signals.push({
        name: "1-Month Return",
        score: Math.round(monthScore),
        signal: monthReturn > 3 ? "Strong" : monthReturn < -3 ? "Weak" : "Flat",
        weight: 1.5,
      });
    }

    // 6. Price vs 50-day SMA
    if (closes.length >= 50 && spyPrice) {
      const sma50 = closes.slice(-50).reduce((s, c) => s + c, 0) / 50;
      const pctAbove = ((spyPrice - sma50) / sma50) * 100;
      const sma50Score = clamp(50 + pctAbove * 6, 0, 100);
      signals.push({
        name: "50-Day Trend",
        score: Math.round(sma50Score),
        signal: pctAbove > 2 ? "Above" : pctAbove < -2 ? "Below" : "Near SMA",
        weight: 1,
      });
    }

    // 7. 30-Day Volatility (rolling std)
    if (closes.length >= 30) {
      const last30 = closes.slice(-30);
      const returns = [];
      for (let i = 1; i < last30.length; i++) {
        if (last30[i - 1] > 0) returns.push(((last30[i] - last30[i - 1]) / last30[i - 1]) * 100);
      }
      if (returns.length > 0) {
        const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
        const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
        const vol = Math.sqrt(variance);
        // High vol = fear. Scale: 0.5% → 100, 1.0% → 80, 1.5% → 60, 2.0% → 40, 2.5% → 20
        const volScore = clamp(100 - (vol - 0.5) * 40, 0, 100);
        signals.push({
          name: "Volatility",
          score: Math.round(volScore),
          signal: vol > 2.0 ? "Very High" : vol > 1.5 ? "High" : vol < 0.8 ? "Low" : "Normal",
          weight: 1,
        });
      }
    }

    // Weighted average
    const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
    const overallScore =
      totalWeight > 0
        ? Math.round(signals.reduce((s, sig) => s + sig.score * sig.weight, 0) / totalWeight)
        : 50;

    return NextResponse.json({
      score: overallScore,
      rating: ratingFromScore(overallScore),
      signals: signals.map(({ name, score, signal }) => ({ name, score, signal })),
      spyPrice,
      spyChange: dailyChange,
      vix: vixPrice,
      updatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[Fear&Greed]", e.message);
    return NextResponse.json({ score: 50, rating: "Neutral", signals: [], error: e.message });
  }
}
