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
    const [spy, vix] = await Promise.all([
      getChart("SPY", "1y", "1d"),
      getChart("%5EVIX", "5d", "1d"),
    ]);

    const signals: { name: string; score: number; signal: string }[] = [];

    const closes = spy?.closes || [];
    const spyPrice = spy?.price || 0;
    const dailyChange = spy?.changePercent || 0;

    // 1. Market Momentum (daily change)
    const momScore = clamp(50 + dailyChange * 15, 0, 100);
    signals.push({
      name: "Market Momentum",
      score: Math.round(momScore),
      signal: momScore > 60 ? "Bullish" : momScore < 40 ? "Bearish" : "Neutral",
    });

    // 2. VIX (Volatility Index) — high VIX = fear
    const vixPrice = vix?.price || 20;
    // VIX ranges: <15 = calm, 15-20 = normal, 20-30 = elevated, >30 = panic
    const vixScore = clamp(100 - (vixPrice - 12) * 3.5, 0, 100);
    signals.push({
      name: "VIX (Fear Index)",
      score: Math.round(vixScore),
      signal: vixPrice > 30 ? "High Fear" : vixPrice > 20 ? "Elevated" : vixPrice < 15 ? "Calm" : "Normal",
    });

    // 3. Price vs 50-day SMA
    if (closes.length >= 50 && spyPrice) {
      const sma50 = closes.slice(-50).reduce((s, c) => s + c, 0) / 50;
      const pctAbove = ((spyPrice - sma50) / sma50) * 100;
      const sma50Score = clamp(50 + pctAbove * 5, 0, 100);
      signals.push({
        name: "50-Day Trend",
        score: Math.round(sma50Score),
        signal: pctAbove > 2 ? "Above SMA" : pctAbove < -2 ? "Below SMA" : "Near SMA",
      });
    }

    // 4. Price vs 200-day SMA
    if (closes.length >= 200 && spyPrice) {
      const sma200 = closes.slice(-200).reduce((s, c) => s + c, 0) / 200;
      const pctAbove = ((spyPrice - sma200) / sma200) * 100;
      const sma200Score = clamp(50 + pctAbove * 3, 0, 100);
      signals.push({
        name: "200-Day Trend",
        score: Math.round(sma200Score),
        signal: pctAbove > 3 ? "Bullish" : pctAbove < -3 ? "Bearish" : "Neutral",
      });
    }

    // 5. 30-Day Volatility (rolling std of returns)
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
        const volScore = clamp(100 - (vol - 0.5) * 40, 0, 100);
        signals.push({
          name: "Volatility",
          score: Math.round(volScore),
          signal: vol > 1.8 ? "High Vol" : vol < 0.8 ? "Low Vol" : "Normal",
        });
      }
    }

    // 6. 1-Month Performance
    if (closes.length >= 22) {
      const monthAgo = closes[closes.length - 22] || 1;
      const current = closes[closes.length - 1] || 1;
      const monthReturn = ((current - monthAgo) / monthAgo) * 100;
      const monthScore = clamp(50 + monthReturn * 5, 0, 100);
      signals.push({
        name: "1-Month Return",
        score: Math.round(monthScore),
        signal: monthReturn > 3 ? "Strong" : monthReturn < -3 ? "Weak" : "Flat",
      });
    }

    // 7. 52-Week High/Low Position
    if (closes.length > 50) {
      const high52 = Math.max(...closes);
      const low52 = Math.min(...closes.filter((c) => c > 0));
      const range = high52 - low52;
      const position = range > 0 ? ((spyPrice - low52) / range) * 100 : 50;
      signals.push({
        name: "52-Week Position",
        score: Math.round(clamp(position, 0, 100)),
        signal: position > 80 ? "Near High" : position < 20 ? "Near Low" : "Mid Range",
      });
    }

    const overallScore =
      signals.length > 0
        ? Math.round(signals.reduce((s, sig) => s + sig.score, 0) / signals.length)
        : 50;

    return NextResponse.json({
      score: overallScore,
      rating: ratingFromScore(overallScore),
      signals,
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
