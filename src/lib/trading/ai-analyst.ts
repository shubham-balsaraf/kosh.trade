import { generateCompletion } from "@/lib/ai/claude";
import { getStockPeers } from "@/lib/api/fmp";
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
  openPositions: string[],
  marketSentiment?: { score: number; rating: string; brief: string },
): Promise<string> {
  const top = signals.slice(0, 5);

  const sentimentBlock = marketSentiment
    ? `\nMarket Sentiment: ${marketSentiment.rating} (${marketSentiment.score}/100)${marketSentiment.brief ? `\nAI Market Analysis: ${marketSentiment.brief}` : ""}
KoshPilot Adjustment: ${marketSentiment.score < 35 ? "Reducing trade capacity due to fearful conditions. Raising minimum score thresholds." : marketSentiment.score > 80 ? "Slightly reducing exposure — markets overheated." : "Normal trading capacity."}\n`
    : "";

  const prompt = `You are a trading AI providing a pre-market briefing.

Portfolio: $${portfolioValue.toFixed(2)}
Open positions: ${openPositions.length > 0 ? openPositions.join(", ") : "None"}
${sentimentBlock}
Top signals today:
${top
  .map(
    (s) =>
      `- ${s.ticker}: ${s.action} (score ${s.score.toFixed(1)}, confidence ${s.confidence}%), ` +
      `$${s.price.toFixed(2)}, stop $${s.stopLoss.toFixed(2)}, target $${s.takeProfit.toFixed(2)}`
  )
  .join("\n")}

Provide a 3-4 sentence market briefing that starts with the current market mood and its impact on today's trading plan. Then give top 2 trade ideas with reasoning. Be concise and actionable.`;

  try {
    return await generateCompletion(
      "You are a concise trading briefing assistant. No disclaimers needed — the user understands risks. Always open with market conditions and how they affect trade decisions today.",
      prompt,
      512
    );
  } catch {
    return "Briefing unavailable — Claude API error.";
  }
}

/* ── LLM-powered ticker identification ───────────────── */

const TICKER_ID_SYSTEM = `You are a financial markets expert. Given a batch of market signals (news, events, trades), identify ALL stock tickers that are likely affected — both directly and through second-order effects.

Rules:
1. Include DIRECTLY mentioned/affected companies
2. Include SECOND-ORDER effects: suppliers, competitors, customers, sector peers
3. For sector-wide events (tariffs, rate changes), list the top 5-8 most impacted tickers
4. Only return real, tradeable US stock tickers (NYSE/NASDAQ)
5. Do NOT include ETFs unless specifically mentioned
6. Maximum 30 tickers total

Respond ONLY in valid JSON: {"tickers": ["AAPL","MSFT",...], "reasoning": "brief explanation of connections"}`;

export async function identifyAffectedTickers(
  signalTexts: string[]
): Promise<{ tickers: string[]; reasoning: string }> {
  if (signalTexts.length === 0) return { tickers: [], reasoning: "" };

  const batchText = signalTexts
    .slice(0, 20)
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");

  try {
    const response = await generateCompletion(
      TICKER_ID_SYSTEM,
      `Identify affected tickers from these signals:\n\n${batchText}`,
      512
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[TickerID] Could not parse JSON");
      return { tickers: [], reasoning: "" };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const tickers = (parsed.tickers || [])
      .filter((t: string) => typeof t === "string" && t.length >= 1 && t.length <= 5)
      .map((t: string) => t.toUpperCase());

    console.log(`[TickerID] Claude identified ${tickers.length} tickers: ${tickers.join(", ")}`);
    return { tickers, reasoning: parsed.reasoning || "" };
  } catch (e) {
    console.error("[TickerID] Failed:", e);
    return { tickers: [], reasoning: "" };
  }
}

export async function expandWithPeers(tickers: string[], maxPeers = 3): Promise<string[]> {
  const allTickers = new Set(tickers);

  const peerResults = await Promise.allSettled(
    tickers.slice(0, 10).map((t) => getStockPeers(t))
  );

  for (const r of peerResults) {
    if (r.status !== "fulfilled" || !Array.isArray(r.value)) continue;
    const peers = r.value[0]?.peersList || r.value;
    if (!Array.isArray(peers)) continue;
    for (const peer of peers.slice(0, maxPeers)) {
      const symbol = typeof peer === "string" ? peer : peer?.symbol;
      if (symbol) allTickers.add(symbol.toUpperCase());
    }
  }

  return [...allTickers];
}

const NARRATIVE_SYSTEM = `You are a market intelligence analyst who identifies actionable trading narratives from raw market signals.

You receive a RICH signal bundle from 13+ data sources: news, insider trades, congressional purchases, analyst upgrades/downgrades, press releases, M&A activity, sector performance, institutional (13F) moves, 8-K SEC filings, market movers, crypto news, upcoming earnings, and WARN Act mass layoff filings.

Your job:
1. Identify 4-8 distinct NARRATIVES — each connecting events, signals, or price action to sector/stock impact
2. Cross-reference multiple signals: if a stock appears in insider buys AND analyst upgrades AND is a top gainer, that's a HIGH-CONVICTION narrative
3. Think cause-and-effect: "X happened → Y sector/stocks will move because Z"
4. Include non-obvious second-order effects (e.g., Google AI chip → memory stocks down, cloud infra up)
5. Analyst grades and institutional moves are STRONG signals — weight them heavily
6. Congressional/Senate trades often signal policy-sensitive opportunities — connect them to upcoming legislation or contracts
7. M&A signals are high-impact: identify both the target company and competitors/peers that move in sympathy
8. Sector performance data reveals rotation themes — connect sector shifts to individual stock opportunities
9. Press releases from companies often precede major price moves — flag actionable ones
10. Every narrative must name specific tradeable tickers (3-8 per narrative)
11. ALWAYS generate at least 4 narratives — use the richest data available

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
      .map((c) => `- ${c.politician} (${c.party}, ${c.chamber}) bought ${c.ticker} — size: ${c.size}`);
    sections.push(`CONGRESSIONAL TRADES (Senate & House):\n${congressLines.join("\n")}`);
  }

  if (signals.grades.length > 0) {
    const gradeLines = signals.grades
      .slice(0, 15)
      .map((g) => `- ${g.firm}: ${g.ticker} ${g.action} → ${g.newGrade}${g.previousGrade ? ` (was ${g.previousGrade})` : ""}`);
    sections.push(`ANALYST UPGRADES/DOWNGRADES:\n${gradeLines.join("\n")}`);
  }

  if (signals.pressReleases.length > 0) {
    const prLines = signals.pressReleases
      .filter((pr) => pr.catalyst)
      .slice(0, 10)
      .map((pr) => `- ${pr.ticker}: "${pr.title}" [${pr.catalyst}]`);
    if (prLines.length > 0) sections.push(`PRESS RELEASES:\n${prLines.join("\n")}`);
  }

  if (signals.sectorPerformance.length > 0) {
    const sectorLines = signals.sectorPerformance
      .map((s) => `${s.sector}: ${s.changePct > 0 ? "+" : ""}${Number(s.changePct).toFixed(2)}%`);
    sections.push(`SECTOR PERFORMANCE:\n${sectorLines.join(", ")}`);
  }

  if (signals.mergers.length > 0) {
    const mergerLines = signals.mergers
      .slice(0, 8)
      .map((m) => `- ${m.ticker}: ${m.companyName} — ${m.type}`);
    sections.push(`M&A ACTIVITY:\n${mergerLines.join("\n")}`);
  }

  if (signals.institutional.length > 0) {
    const instLines = signals.institutional
      .slice(0, 10)
      .map((f) => `- ${f.investor} added ${(f.changeShares / 1000).toFixed(0)}K shares of ${f.ticker}`);
    sections.push(`INSTITUTIONAL (13F) MOVES:\n${instLines.join("\n")}`);
  }

  if (signals.filings8k.length > 0) {
    const filingLines = signals.filings8k
      .slice(0, 8)
      .map((f) => `- ${f.ticker}: "${f.title}" (${f.date})`);
    sections.push(`SEC 8-K FILINGS:\n${filingLines.join("\n")}`);
  }

  if (signals.screenerMoves.length > 0) {
    const gainers = signals.screenerMoves
      .filter((s) => s.direction === "gainer")
      .slice(0, 8)
      .map((s) => `${s.ticker} +${Number(s.changePct).toFixed(1)}%`);
    const losers = signals.screenerMoves
      .filter((s) => s.direction === "loser")
      .slice(0, 8)
      .map((s) => `${s.ticker} ${Number(s.changePct).toFixed(1)}%`);
    const active = signals.screenerMoves
      .filter((s) => s.direction === "active")
      .slice(0, 6)
      .map((s) => `${s.ticker} (${(s.volume / 1e6).toFixed(1)}M vol)`);
    let movers = "";
    if (gainers.length > 0) movers += `Gainers: ${gainers.join(", ")}\n`;
    if (losers.length > 0) movers += `Losers: ${losers.join(", ")}\n`;
    if (active.length > 0) movers += `Most Active: ${active.join(", ")}`;
    sections.push(`MARKET MOVERS:\n${movers.trim()}`);
  }

  if (signals.earnings.length > 0) {
    const earningsLines = signals.earnings
      .slice(0, 10)
      .map((e) => `- ${e.ticker} reports ${e.date}${e.epsEstimate ? ` (est EPS $${e.epsEstimate})` : ""}`);
    sections.push(`UPCOMING EARNINGS:\n${earningsLines.join("\n")}`);
  }

  if (signals.cryptoNews && signals.cryptoNews.length > 0) {
    const cryptoLines = signals.cryptoNews
      .slice(0, 10)
      .map((n) => `- "${n.title}"${n.ticker ? ` (${n.ticker})` : ""}${n.catalyst ? ` [${n.catalyst}]` : ""}`);
    sections.push(`CRYPTO NEWS:\n${cryptoLines.join("\n")}`);
  }

  if (signals.warnLayoffs && signals.warnLayoffs.length > 0) {
    const warnLines = signals.warnLayoffs
      .slice(0, 15)
      .map((w) => `- ${w.company}${w.ticker ? ` (${w.ticker})` : ""}: ${w.employeesAffected} employees, ${w.state} (${w.date})${w.noticeType ? ` [${w.noticeType}]` : ""}`);
    sections.push(`WARN ACT LAYOFF FILINGS (mass layoff notices — can be bullish cost-cutting or bearish distress depending on company health):\n${warnLines.join("\n")}`);
  }

  if (sections.length === 0) return [];

  const userMessage = `Analyze these live market signals from 12+ data sources and create trading narratives. Cross-reference signals for highest conviction:\n\n${sections.join("\n\n")}`;

  try {
    const response = await generateCompletion(NARRATIVE_SYSTEM, userMessage, 3072);
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
