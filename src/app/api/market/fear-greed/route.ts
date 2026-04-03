import { NextResponse } from "next/server";
import { getChart } from "@/lib/api/yahoo";
import { getFearGreedIndex } from "@/lib/api/feargreed";
import { getMacroSnapshot } from "@/lib/signals/macroRegime";
import { generateCompletion } from "@/lib/ai/claude";

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

let briefCache: { brief: string; generatedAt: number } | null = null;
const BRIEF_TTL = 4 * 60 * 60 * 1000;

async function generateMarketBrief(
  score: number,
  rating: string,
  signals: Array<{ name: string; score: number; signal: string }>,
  vix: number,
  spyChange: number,
): Promise<string> {
  if (briefCache && Date.now() - briefCache.generatedAt < BRIEF_TTL) {
    return briefCache.brief;
  }

  const signalSummary = signals.map((s) => `${s.name}: ${s.score}/100 (${s.signal})`).join("\n");

  const prompt = `Market Sentiment Score: ${score}/100 — ${rating}
VIX: ${vix.toFixed(1)}
SPY Daily Change: ${spyChange >= 0 ? "+" : ""}${spyChange.toFixed(2)}%

Indicator Breakdown:
${signalSummary}

Write a 3-4 sentence daily market brief for a trader. Explain the current market mood, the key drivers behind today's sentiment reading, and what it means for trading today. Be specific about numbers. No disclaimers.`;

  try {
    const brief = await generateCompletion(
      "You are a concise market analyst. Write punchy, data-driven market briefs. No fluff, no disclaimers.",
      prompt,
      300,
    );
    briefCache = { brief, generatedAt: Date.now() };
    return brief;
  } catch (e: any) {
    console.error("[Fear&Greed] AI brief generation failed:", e.message);
    return "";
  }
}

async function fetchWarnCount(): Promise<number> {
  const key = process.env.WARN_FIREHOSE_API_KEY;
  if (!key) return 0;
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const res = await fetch(`https://warnfirehose.com/api/records?date_from=${thirtyDaysAgo}&limit=30`, {
      headers: { "X-API-Key": key },
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const data = await res.json();
    const records = Array.isArray(data) ? data : data?.records || data?.data || [];
    return records.length;
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    const [spy, vixData, cnnFg, macro, warnCount] = await Promise.all([
      getChart("SPY", "1y", "1d"),
      getChart("^VIX", "6mo", "1d"),
      getFearGreedIndex().catch(() => null),
      getMacroSnapshot().catch(() => null),
      fetchWarnCount().catch(() => 0),
    ]);

    const signals: { name: string; score: number; signal: string; weight: number }[] = [];

    const closes = spy?.closes || [];
    const spyPrice = spy?.price || 0;
    const dailyChange = spy?.changePercent || 0;

    const vixCloses = vixData?.closes || [];
    const vixPrice = vixData?.price || 20;

    const vixScore = clamp(100 - (vixPrice - 12) * 4.5, 0, 100);
    signals.push({
      name: "VIX Level",
      score: Math.round(vixScore),
      signal: vixPrice > 30 ? "Panic" : vixPrice > 25 ? "High Fear" : vixPrice > 20 ? "Elevated" : vixPrice < 15 ? "Calm" : "Normal",
      weight: 2.5,
    });

    if (vixCloses.length >= 50) {
      const vixSma50 = vixCloses.slice(-50).reduce((s, c) => s + c, 0) / 50;
      const vixPctAbove = ((vixPrice - vixSma50) / vixSma50) * 100;
      const vixTrendScore = clamp(50 - vixPctAbove * 2, 0, 100);
      signals.push({
        name: "VIX Trend",
        score: Math.round(vixTrendScore),
        signal: vixPctAbove > 20 ? "Spiking" : vixPctAbove > 5 ? "Rising" : vixPctAbove < -10 ? "Falling" : "Stable",
        weight: 1.5,
      });
    }

    const momScore = clamp(50 + dailyChange * 20, 0, 100);
    signals.push({
      name: "Market Momentum",
      score: Math.round(momScore),
      signal: dailyChange > 1 ? "Bullish" : dailyChange < -1 ? "Bearish" : "Neutral",
      weight: 1,
    });

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
          signal: vol > 2.0 ? "Very High" : vol > 1.5 ? "High" : vol < 0.8 ? "Low" : "Normal",
          weight: 1,
        });
      }
    }

    if (cnnFg && typeof cnnFg.score === "number") {
      signals.push({
        name: "CNN Fear & Greed",
        score: Math.round(cnnFg.score),
        signal: cnnFg.label || ratingFromScore(cnnFg.score),
        weight: 2.0,
      });
    }

    if (macro) {
      const regimeScores: Record<string, number> = {
        EXPANSION: 80, PEAK: 60, TROUGH: 40, CONTRACTION: 20,
      };
      const macroScore = regimeScores[macro.regime] ?? 50;
      signals.push({
        name: "Macro Regime",
        score: macroScore,
        signal: macro.regime.charAt(0) + macro.regime.slice(1).toLowerCase(),
        weight: 1.5,
      });
    }

    if (typeof warnCount === "number") {
      const warnScore = warnCount === 0 ? 60 : warnCount <= 5 ? 50 : warnCount <= 15 ? 35 : 20;
      signals.push({
        name: "Layoff Activity",
        score: warnScore,
        signal: warnCount === 0 ? "None" : warnCount <= 5 ? "Low" : warnCount <= 15 ? "Moderate" : "High",
        weight: 0.5,
      });
    }

    const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
    const overallScore =
      totalWeight > 0
        ? Math.round(signals.reduce((s, sig) => s + sig.score * sig.weight, 0) / totalWeight)
        : 50;

    const rating = ratingFromScore(overallScore);
    const signalOutput = signals.map(({ name, score, signal }) => ({ name, score, signal }));

    const brief = await generateMarketBrief(overallScore, rating, signalOutput, vixPrice, dailyChange);

    return NextResponse.json({
      score: overallScore,
      rating,
      signals: signalOutput,
      spyPrice,
      spyChange: dailyChange,
      vix: vixPrice,
      brief,
      updatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[Fear&Greed]", e.message);
    return NextResponse.json({ score: 50, rating: "Neutral", signals: [], brief: "", error: e.message });
  }
}
