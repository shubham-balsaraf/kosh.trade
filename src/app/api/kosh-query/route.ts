import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { generateCompletion } from "@/lib/ai/claude";
import { discoverOpportunities, getRawSignals } from "@/lib/trading/discovery";
import { scanMarket, type ScanResult } from "@/lib/trading/scanner";
import { generateSignals } from "@/lib/trading/signals";
import {
  computeDataConfidence,
  scoreSignalDiversity,
  scoreTechnical,
  scoreFundamental,
  scoreValuation,
  scoreSmartMoney,
  scoreCatalyst,
  scoreRiskAdjusted,
  fetchFundamentals,
  type FundamentalData,
  type ScoredCandidate,
} from "@/lib/trading/conviction";
import { getChart } from "@/lib/api/yahoo";
import { getPriceTargetConsensus } from "@/lib/api/fmp";
import { getPriceTarget as getFinnhubPriceTarget } from "@/lib/api/finnhub";
import { batchStocktwitsSentiment } from "@/lib/api/stocktwits";
import { batchFinvizSnapshot } from "@/lib/api/finviz";
import { type ConvictionWeights } from "@/lib/trading/learning";

export const maxDuration = 120;

type Horizon = "1Y" | "2Y" | "3Y" | "COMPOUNDING";

interface QueryResult {
  ticker: string;
  companyName: string;
  sector: string;
  currentPrice: number;
  targetPrice: number;
  expectedReturnPct: number;
  allocation: number;
  allocationPct: number;
  koshConfidence: number;
  conviction: number;
  holdLabel: string;
  scores: Record<string, number>;
  sources: string[];
  sparkline: number[];
  thesis: string;
}

const HORIZON_WEIGHTS: Record<Horizon, ConvictionWeights> = {
  "1Y": {
    signalDiversity: 0.12,
    technical: 0.22,
    fundamental: 0.10,
    valuation: 0.12,
    smartMoney: 0.15,
    catalystSentiment: 0.20,
    riskAdjusted: 0.09,
  },
  "2Y": {
    signalDiversity: 0.13,
    technical: 0.12,
    fundamental: 0.20,
    valuation: 0.18,
    smartMoney: 0.14,
    catalystSentiment: 0.13,
    riskAdjusted: 0.10,
  },
  "3Y": {
    signalDiversity: 0.10,
    technical: 0.08,
    fundamental: 0.25,
    valuation: 0.22,
    smartMoney: 0.12,
    catalystSentiment: 0.08,
    riskAdjusted: 0.15,
  },
  COMPOUNDING: {
    signalDiversity: 0.05,
    technical: 0.05,
    fundamental: 0.30,
    valuation: 0.25,
    smartMoney: 0.10,
    catalystSentiment: 0.05,
    riskAdjusted: 0.20,
  },
};

const HORIZON_LABELS: Record<Horizon, string> = {
  "1Y": "1 year",
  "2Y": "2 years",
  "3Y": "3 years",
  COMPOUNDING: "5+ year compounding",
};

function clamp(v: number): number {
  return Math.max(-100, Math.min(100, v));
}

function blendTargetPrice(
  fd: FundamentalData | undefined,
  scan: ScanResult | undefined,
  currentPrice: number,
  horizon: Horizon,
): number {
  const sources: Array<{ value: number; weight: number }> = [];

  if (fd?.analystTarget && fd.analystTarget > 0) {
    sources.push({ value: fd.analystTarget, weight: horizon === "COMPOUNDING" ? 0.2 : 0.4 });
  }
  if (fd?.dcfValue && fd.dcfValue > 0) {
    sources.push({ value: fd.dcfValue, weight: horizon === "COMPOUNDING" ? 0.5 : 0.35 });
  }
  if (scan) {
    const techTarget = Math.max(scan.high20, scan.bollinger.upper, currentPrice * 1.1);
    sources.push({ value: techTarget, weight: horizon === "COMPOUNDING" ? 0.1 : 0.25 });
  }

  if (sources.length === 0) return currentPrice * 1.15;

  const totalWeight = sources.reduce((s, src) => s + src.weight, 0);
  const blended = sources.reduce((s, src) => s + src.value * (src.weight / totalWeight), 0);

  const horizonMultiplier: Record<Horizon, number> = {
    "1Y": 1.0,
    "2Y": 1.15,
    "3Y": 1.3,
    COMPOUNDING: 1.5,
  };

  const annualizedGap = (blended - currentPrice) / currentPrice;
  const projectedReturn = annualizedGap * horizonMultiplier[horizon];
  return Math.round((currentPrice * (1 + projectedReturn)) * 100) / 100;
}

async function fetchSparklines(tickers: string[]): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const chart = await getChart(ticker, "6mo", "1wk");
      return { ticker, closes: chart?.closes || [] };
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value.closes.length > 0) {
      const closes = r.value.closes;
      const sampled = closes.length > 24
        ? closes.filter((_, i) => i % Math.ceil(closes.length / 24) === 0 || i === closes.length - 1)
        : closes;
      map.set(r.value.ticker, sampled.map((c) => Math.round(c * 100) / 100));
    }
  }

  return map;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { query: string; horizon: Horizon; amount: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { query, horizon, amount } = body;
  if (!query || !horizon || !amount || amount <= 0) {
    return NextResponse.json({ error: "Missing query, horizon, or amount" }, { status: 400 });
  }

  if (!["1Y", "2Y", "3Y", "COMPOUNDING"].includes(horizon)) {
    return NextResponse.json({ error: "Invalid horizon" }, { status: 400 });
  }

  console.log(`[KoshQuery] Starting analysis: "${query}" | horizon=${horizon} | amount=$${amount}`);
  const startTime = Date.now();

  try {
    const [discovered, bundle] = await Promise.all([
      discoverOpportunities(),
      getRawSignals(),
    ]);

    const allTickers = new Set<string>();
    for (const d of discovered) allTickers.add(d.ticker);
    for (const n of bundle.news) if (n.ticker) allTickers.add(n.ticker);
    for (const i of bundle.insiderBuys) allTickers.add(i.ticker);
    for (const c of bundle.congressBuys) allTickers.add(c.ticker);
    for (const s of bundle.screenerMoves) if (s.direction === "gainer") allTickers.add(s.ticker);
    for (const e of bundle.earnings) allTickers.add(e.ticker);
    for (const g of bundle.grades) allTickers.add(g.ticker);
    for (const inst of bundle.institutional) allTickers.add(inst.ticker);

    const rawPool = [...allTickers].filter((t) => !t.includes("-") && t.length <= 5).slice(0, 60);
    console.log(`[KoshQuery] Candidate pool: ${rawPool.length} tickers`);

    if (rawPool.length === 0) {
      return NextResponse.json({ error: "No candidates found in current market scan" }, { status: 200 });
    }

    const scanResults = await scanMarket(rawPool);
    const scanMap = new Map(scanResults.map((s) => [s.ticker, s]));

    const fundamentalsMap = await fetchFundamentals(rawPool);

    const [stocktwitsSentiment, finvizSnapshots] = await Promise.all([
      batchStocktwitsSentiment(rawPool).catch(() => new Map()),
      batchFinvizSnapshot(rawPool).catch(() => new Map()),
    ]);

    bundle.socialSentiment = stocktwitsSentiment;
    bundle.finvizSnapshots = finvizSnapshots;

    for (const [ticker, fv] of finvizSnapshots) {
      const fd = fundamentalsMap.get(ticker);
      if (fd) {
        if (!fd.analystTarget && fv.analystTarget) fd.analystTarget = fv.analystTarget;
        if (!fd.forwardPe && fv.peForward) fd.forwardPe = fv.peForward;
        if (!fd.peg && fv.peg) fd.peg = fv.peg;
      }
    }

    const priceTargetResults = await Promise.allSettled(
      rawPool.slice(0, 20).map(async (ticker) => {
        const [fmpTarget, finnhubTarget] = await Promise.allSettled([
          getPriceTargetConsensus(ticker),
          getFinnhubPriceTarget(ticker),
        ]);
        const fmpVal = fmpTarget.status === "fulfilled" ? fmpTarget.value : null;
        const finnVal = finnhubTarget.status === "fulfilled" ? finnhubTarget.value : null;
        const target = (Array.isArray(fmpVal) && fmpVal[0]?.targetConsensus) || finnVal?.targetMean || null;
        return { ticker, target };
      }),
    );

    for (const r of priceTargetResults) {
      if (r.status === "fulfilled" && r.value.target) {
        const fd = fundamentalsMap.get(r.value.ticker);
        if (fd && !fd.analystTarget) fd.analystTarget = r.value.target;
      }
    }

    const w = HORIZON_WEIGHTS[horizon];

    const allScored: ScoredCandidate[] = [];
    for (const ticker of rawPool) {
      const { score: diversityScore, sources } = scoreSignalDiversity(ticker, bundle, discovered);
      if (sources.length === 0) continue;

      const scan = scanMap.get(ticker);
      const signal = scan ? generateSignals(scan) : undefined;
      const fd = fundamentalsMap.get(ticker);
      const currentPrice = scan?.price || 0;
      if (currentPrice < 5) continue;

      const scores = {
        signalDiversity: diversityScore,
        technical: scoreTechnical(scan, signal),
        fundamental: scoreFundamental(fd),
        valuation: scoreValuation(fd, currentPrice),
        smartMoney: scoreSmartMoney(ticker, bundle),
        catalystSentiment: clamp(scoreCatalyst(ticker, bundle)),
        riskAdjusted: scoreRiskAdjusted(scan, fd, currentPrice),
      };

      const compositeScore = Math.round(
        scores.signalDiversity * w.signalDiversity +
        scores.technical * w.technical +
        scores.fundamental * w.fundamental +
        scores.valuation * w.valuation +
        scores.smartMoney * w.smartMoney +
        scores.catalystSentiment * w.catalystSentiment +
        scores.riskAdjusted * w.riskAdjusted,
      );

      allScored.push({
        ticker,
        scores,
        compositeScore,
        dataConfidence: computeDataConfidence(fd, scan, bundle, ticker),
        confidenceBand: compositeScore >= 45 ? "VERY_HIGH" : compositeScore >= 25 ? "HIGH" : "MODERATE",
        sources,
        scan,
        tradeSignal: signal,
        fundamentals: fd,
        sentimentScore: 0,
      });
    }

    allScored.sort((a, b) => {
      const aFinal = a.compositeScore * (0.6 + 0.4 * (a.dataConfidence / 100));
      const bFinal = b.compositeScore * (0.6 + 0.4 * (b.dataConfidence / 100));
      return bFinal - aFinal;
    });

    const top5 = allScored.slice(0, 5);
    if (top5.length === 0) {
      return NextResponse.json({ error: "No strong candidates found after scoring" }, { status: 200 });
    }

    const topTickers = top5.map((c) => c.ticker);
    const sparklines = await fetchSparklines(topTickers);

    const totalConviction = top5.reduce((s, c) => s + Math.max(c.compositeScore, 1), 0);

    const results: QueryResult[] = top5.map((candidate, idx) => {
      const fd = candidate.fundamentals;
      const currentPrice = candidate.scan?.price || 0;
      const targetPrice = blendTargetPrice(fd, candidate.scan, currentPrice, horizon);
      const expectedReturnPct = currentPrice > 0
        ? Math.round(((targetPrice - currentPrice) / currentPrice) * 1000) / 10
        : 0;

      const weight = Math.max(candidate.compositeScore, 1) / totalConviction;
      const allocation = Math.round(amount * weight * 100) / 100;

      return {
        ticker: candidate.ticker,
        companyName: fd?.companyName || candidate.ticker,
        sector: fd?.sector || "Unknown",
        currentPrice: Math.round(currentPrice * 100) / 100,
        targetPrice,
        expectedReturnPct,
        allocation,
        allocationPct: Math.round(weight * 1000) / 10,
        koshConfidence: candidate.dataConfidence,
        conviction: candidate.compositeScore,
        holdLabel: horizon === "COMPOUNDING" ? "5+ years" : HORIZON_LABELS[horizon],
        scores: candidate.scores,
        sources: candidate.sources,
        sparkline: sparklines.get(candidate.ticker) || [],
        thesis: "",
      };
    });

    const contextForAI = results.map((r) => {
      const fd = fundamentalsMap.get(r.ticker);
      const parts = [
        `${r.ticker} (${r.companyName}): conviction ${r.conviction}/100, confidence ${r.koshConfidence}%, target $${r.targetPrice} (now $${r.currentPrice}), expected return ${r.expectedReturnPct}%, allocation $${r.allocation} (${r.allocationPct}%)`,
        `  Scores: tech=${r.scores.technical} fund=${r.scores.fundamental} val=${r.scores.valuation} smart=${r.scores.smartMoney} catalyst=${r.scores.catalystSentiment} risk=${r.scores.riskAdjusted}`,
        `  Signals: ${r.sources.join(", ")}`,
      ];
      if (fd) {
        parts.push(`  Fundamentals: Rev growth ${fd.revenueGrowth.toFixed(1)}%, GM ${(fd.grossMargin * 100).toFixed(0)}%, OPM ${(fd.operatingMargin * 100).toFixed(0)}%, ROE ${(fd.roe * 100).toFixed(0)}%, Beta ${fd.beta.toFixed(2)}`);
        parts.push(`  Valuation: P/E ${fd.pe.toFixed(1)}, Fwd P/E ${fd.forwardPe.toFixed(1)}, PEG ${fd.peg.toFixed(2)}, EV/EBITDA ${fd.evToEbitda.toFixed(1)}${fd.dcfValue ? `, DCF $${fd.dcfValue.toFixed(2)}` : ""}`);
      }
      return parts.join("\n");
    }).join("\n\n");

    const aiResponse = await generateCompletion(
      `You are Kosh, a brutally honest, data-driven investment advisor. The user has $${amount} to invest over a ${HORIZON_LABELS[horizon]} horizon. You must be precise, unflinching, and back every claim with numbers from the data provided.

Your response must be valid JSON with this exact structure:
{
  "verdict": "A 2-3 sentence brutally honest summary of the overall recommendation. Be direct — if this is risky, say so. If it's a great opportunity, say why with specifics.",
  "theses": [
    {
      "ticker": "AAPL",
      "thesis": "4 sentences: 1) Bull case with specific catalyst 2) Supporting data point 3) The biggest risk that could wreck this 4) When to expect results"
    }
  ],
  "riskWarning": "One brutally honest sentence about what could go wrong with this entire allocation"
}

Rules:
- Be specific with numbers — don't say "strong growth", say "23% revenue growth"
- Call out risks honestly — if a stock is overvalued, say it
- If the amount is small, acknowledge the limitations honestly
- Never be wishy-washy. Take a clear position
- If the horizon doesn't match a stock's profile, flag it`,
      `User question: "${query}"\nHorizon: ${HORIZON_LABELS[horizon]}\nAmount: $${amount}\n\nTop picks from Kosh's full market scan:\n\n${contextForAI}`,
      4096,
    );

    let aiData: { verdict: string; theses: Array<{ ticker: string; thesis: string }>; riskWarning: string } = {
      verdict: "",
      theses: [],
      riskWarning: "",
    };

    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("[KoshQuery] Failed to parse AI response:", e);
    }

    for (const r of results) {
      const aiThesis = aiData.theses.find((t) => t.ticker.toUpperCase() === r.ticker.toUpperCase());
      r.thesis = aiThesis?.thesis || `${r.companyName} scores ${r.conviction}/100 conviction with ${r.sources.length} signal sources. Target $${r.targetPrice} represents ${r.expectedReturnPct}% potential return.`;
    }

    const elapsed = Date.now() - startTime;
    console.log(`[KoshQuery] Complete in ${(elapsed / 1000).toFixed(1)}s — ${results.length} picks returned`);

    return NextResponse.json({
      results,
      verdict: aiData.verdict || `Based on ${rawPool.length} stocks scanned across ${new Set(top5.flatMap((c) => c.sources)).size} signal sources, these are Kosh's highest-conviction picks for your $${amount}.`,
      riskWarning: aiData.riskWarning || "Past performance does not guarantee future results. All investments carry risk of loss.",
      meta: {
        scanned: rawPool.length,
        scored: allScored.length,
        horizon,
        amount,
        elapsed,
      },
    });
  } catch (error: any) {
    console.error("[KoshQuery] Error:", error);
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 },
    );
  }
}
