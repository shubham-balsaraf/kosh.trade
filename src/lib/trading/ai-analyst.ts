import { generateCompletion } from "@/lib/ai/claude";
import type { TradeSignal } from "./signals";
import type { RawSignalBundle } from "./discovery";

export interface MarketNarrative {
  id: string;
  headline: string;
  narrative: string;
  sector: string;
  sentiment: "bullish" | "bearish" | "mixed";
  impact: number;
  affectedTickers: string[];
  triggerTickers: string[];
  timeframe: "immediate" | "short-term" | "medium-term" | "structural";
  tradeImplication: string;
}

interface AIVerdict {
  ticker: string;
  conviction: number; // 1-10
  reasoning: string;
  keyRisks: string[];
  catalyst: string;
}

const SYSTEM_PROMPT = `You are a quantitative trading analyst for a short-term swing trading system.
You receive technical signal data for stocks and must provide conviction scores.
Some stocks include DISCOVERY context — catalysts from news, insider buys, congressional trades, screener spikes, or upcoming earnings. Weight these strongly in your conviction.

Rules:
- Score each stock 1-10 on conviction for a 2-10 day swing trade
- 1-3 = avoid, 4-5 = weak, 6-7 = moderate, 8-10 = strong conviction
- Focus on: momentum alignment, risk/reward ratio, sector trends, recent catalysts
- Discovery context (insider buys, congressional trades, breaking news) should boost conviction when technicals align
- Be conservative — protect capital first
- No forward-looking statements or guarantees
- Keep reasoning to 2 sentences max per stock

Respond ONLY in valid JSON array format:
[{"ticker":"AAPL","conviction":7,"reasoning":"...","keyRisks":["..."],"catalyst":"..."}]`;

export async function getAIConvictions(
  signals: TradeSignal[],
  discoveryContext?: Map<string, string>
): Promise<Map<string, AIVerdict>> {
  const results = new Map<string, AIVerdict>();

  if (signals.length === 0) return results;

  const top = signals.slice(0, 10);

  const userMessage = `Analyze these stocks for short-term swing trade potential (2-10 day hold).
Give conviction scores 1-10 for each.

${top
  .map(
    (s) => {
      let line =
        `${s.ticker}: Price $${s.price.toFixed(2)}, Signal ${s.action} (score ${s.score.toFixed(1)}), ` +
        `RSI ${s.signals.find((x) => x.name === "RSI")?.reason || "N/A"}, ` +
        `MACD ${s.signals.find((x) => x.name === "MACD")?.reason || "N/A"}, ` +
        `Trend ${s.signals.find((x) => x.name === "Trend")?.reason || "N/A"}, ` +
        `Stop $${s.stopLoss.toFixed(2)}, Target $${s.takeProfit.toFixed(2)}, ` +
        `Strategy: ${s.strategy}`;
      const ctx = discoveryContext?.get(s.ticker);
      if (ctx) line += `\n  DISCOVERY: ${ctx}`;
      return line;
    }
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

const NARRATIVE_SYSTEM = `You are a market intelligence analyst who identifies actionable trading narratives from raw market signals.

Given any combination of: news headlines, insider trades, congressional activity, market movers (price changes), and upcoming earnings — you must:
1. Identify 3-6 distinct NARRATIVES — each connecting events or price action to sector/stock impact
2. For each narrative, identify which stocks are DIRECTLY affected and could be traded
3. Think in terms of cause and effect: "X happened → Y sector/stocks will move because Z"
4. Include non-obvious second-order effects (e.g., Google AI chip → memory stocks down, cloud infra up)
5. Every narrative must name specific tradeable tickers
6. If you only have price movers without news, analyze the sector rotation patterns, momentum shifts, and relative strength to create narratives about what the market is telling us
7. ALWAYS generate at least 3 narratives — if data is sparse, use the market mover data to identify sector themes

Respond ONLY in valid JSON array. No markdown, no explanation outside JSON:
[{
  "headline": "Short punchy headline like a Bloomberg terminal alert",
  "narrative": "2-3 sentence story explaining the cause, effect, and trading implication. Be specific about WHY stocks move.",
  "sector": "Sector name",
  "sentiment": "bullish" | "bearish" | "mixed",
  "impact": 1-10,
  "affectedTickers": ["TICK1","TICK2","TICK3"],
  "triggerTickers": ["SOURCE_TICK"],
  "timeframe": "immediate" | "short-term" | "medium-term" | "structural",
  "tradeImplication": "One sentence: what a trader should do"
}]`;

export async function generateMarketNarratives(signals: RawSignalBundle): Promise<MarketNarrative[]> {
  const sections: string[] = [];

  if (signals.news.length > 0) {
    const newsLines = signals.news
      .slice(0, 25)
      .map((n) => `- "${n.title}"${n.ticker ? ` (${n.ticker})` : ""}${n.catalyst ? ` [${n.catalyst}]` : ""}`);
    if (newsLines.length > 0) sections.push(`NEWS HEADLINES:\n${newsLines.join("\n")}`);
  }

  if (signals.insiderBuys.length > 0) {
    const insiderLines = signals.insiderBuys
      .slice(0, 10)
      .map((i) => `- ${i.name} bought $${(i.value / 1000).toFixed(0)}K of ${i.ticker}`);
    sections.push(`INSIDER PURCHASES:\n${insiderLines.join("\n")}`);
  }

  if (signals.congressBuys.length > 0) {
    const congressLines = signals.congressBuys
      .slice(0, 10)
      .map((c) => `- ${c.politician} (${c.party}) bought ${c.ticker} — size: ${c.size}`);
    sections.push(`CONGRESSIONAL TRADES:\n${congressLines.join("\n")}`);
  }

  if (signals.screenerMoves.length > 0) {
    const gainers = signals.screenerMoves
      .filter((s) => s.direction === "gainer")
      .slice(0, 8)
      .map((s) => `${s.ticker} +${s.changePct.toFixed(1)}%`);
    const losers = signals.screenerMoves
      .filter((s) => s.direction === "loser")
      .slice(0, 8)
      .map((s) => `${s.ticker} ${s.changePct.toFixed(1)}%`);
    sections.push(`MARKET MOVERS:\nGainers: ${gainers.join(", ")}\nLosers: ${losers.join(", ")}`);
  }

  if (signals.earnings.length > 0) {
    const earningsLines = signals.earnings
      .slice(0, 10)
      .map((e) => `- ${e.ticker} reports ${e.date}${e.epsEstimate ? ` (est EPS $${e.epsEstimate})` : ""}`);
    sections.push(`UPCOMING EARNINGS:\n${earningsLines.join("\n")}`);
  }

  if (sections.length === 0) return [];

  const userMessage = `Analyze these live market signals and create trading narratives:\n\n${sections.join("\n\n")}`;

  try {
    const response = await generateCompletion(NARRATIVE_SYSTEM, userMessage, 2048);
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[AI Narratives] Could not parse JSON from response");
      return [];
    }

    const raw = JSON.parse(jsonMatch[0]) as any[];
    return raw
      .filter((n) => n.headline && n.narrative && Array.isArray(n.affectedTickers))
      .map((n, i) => ({
        id: `narrative-${i}`,
        headline: n.headline,
        narrative: n.narrative,
        sector: n.sector || "Market",
        sentiment: n.sentiment || "mixed",
        impact: Math.min(10, Math.max(1, n.impact || 5)),
        affectedTickers: (n.affectedTickers || []).slice(0, 8),
        triggerTickers: (n.triggerTickers || []).slice(0, 3),
        timeframe: n.timeframe || "short-term",
        tradeImplication: n.tradeImplication || "",
      }));
  } catch (e) {
    console.error("[AI Narratives] Failed:", e);
    return [];
  }
}
