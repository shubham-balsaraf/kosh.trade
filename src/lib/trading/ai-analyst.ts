import { generateCompletion } from "@/lib/ai/claude";
import type { TradeSignal } from "./signals";

interface AIVerdict {
  ticker: string;
  conviction: number; // 1-10
  reasoning: string;
  keyRisks: string[];
  catalyst: string;
}

const SYSTEM_PROMPT = `You are a quantitative trading analyst for a short-term swing trading system.
You receive technical signal data for stocks and must provide conviction scores.

Rules:
- Score each stock 1-10 on conviction for a 2-10 day swing trade
- 1-3 = avoid, 4-5 = weak, 6-7 = moderate, 8-10 = strong conviction
- Focus on: momentum alignment, risk/reward ratio, sector trends, recent catalysts
- Be conservative — protect capital first
- No forward-looking statements or guarantees
- Keep reasoning to 2 sentences max per stock

Respond ONLY in valid JSON array format:
[{"ticker":"AAPL","conviction":7,"reasoning":"...","keyRisks":["..."],"catalyst":"..."}]`;

export async function getAIConvictions(
  signals: TradeSignal[]
): Promise<Map<string, AIVerdict>> {
  const results = new Map<string, AIVerdict>();

  if (signals.length === 0) return results;

  const top = signals.slice(0, 10);

  const userMessage = `Analyze these stocks for short-term swing trade potential (2-10 day hold).
Give conviction scores 1-10 for each.

${top
  .map(
    (s) =>
      `${s.ticker}: Price $${s.price.toFixed(2)}, Signal ${s.action} (score ${s.score.toFixed(1)}), ` +
      `RSI ${s.signals.find((x) => x.name === "RSI")?.reason || "N/A"}, ` +
      `MACD ${s.signals.find((x) => x.name === "MACD")?.reason || "N/A"}, ` +
      `Trend ${s.signals.find((x) => x.name === "Trend")?.reason || "N/A"}, ` +
      `Stop $${s.stopLoss.toFixed(2)}, Target $${s.takeProfit.toFixed(2)}, ` +
      `Strategy: ${s.strategy}`
  )
  .join("\n")}`;

  try {
    const response = await generateCompletion(SYSTEM_PROMPT, userMessage, 1024);

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[AI Analyst] Could not parse JSON from response");
      return results;
    }

    const verdicts: AIVerdict[] = JSON.parse(jsonMatch[0]);
    for (const v of verdicts) {
      if (v.ticker && typeof v.conviction === "number") {
        results.set(v.ticker.toUpperCase(), v);
      }
    }
  } catch (e) {
    console.error("[AI Analyst] Failed:", e);
  }

  return results;
}

export async function getDailyBriefing(
  signals: TradeSignal[],
  portfolioValue: number,
  openPositions: string[]
): Promise<string> {
  const top = signals.slice(0, 5);

  const prompt = `You are a trading AI providing a pre-market briefing.

Portfolio: $${portfolioValue.toFixed(2)}
Open positions: ${openPositions.length > 0 ? openPositions.join(", ") : "None"}

Top signals today:
${top
  .map(
    (s) =>
      `- ${s.ticker}: ${s.action} (score ${s.score.toFixed(1)}, confidence ${s.confidence}%), ` +
      `$${s.price.toFixed(2)}, stop $${s.stopLoss.toFixed(2)}, target $${s.takeProfit.toFixed(2)}`
  )
  .join("\n")}

Provide a 3-4 sentence market briefing and top 2 trade ideas with reasoning. Be concise and actionable.`;

  try {
    return await generateCompletion(
      "You are a concise trading briefing assistant. No disclaimers needed — the user understands risks.",
      prompt,
      512
    );
  } catch {
    return "Briefing unavailable — Claude API error.";
  }
}
