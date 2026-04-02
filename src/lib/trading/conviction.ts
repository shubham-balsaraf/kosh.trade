import { discoverOpportunities, getRawSignals, type RawSignalBundle, type DiscoveredTicker } from "./discovery";
import { scanMarket, type ScanResult } from "./scanner";
import { generateSignals, type TradeSignal } from "./signals";
import { generateCompletion } from "@/lib/ai/claude";
import { getQuote, getPriceTargetConsensus, getProfile } from "@/lib/api/fmp";
import { prisma } from "@/lib/db";

export interface ConvictionPickResult {
  ticker: string;
  companyName: string;
  rank: number;
  conviction: number;
  targetPrice: number;
  currentPrice: number;
  upsidePct: number;
  holdPeriod: "SHORT" | "MEDIUM" | "LONG";
  holdLabel: string;
  thesis: string;
  signals: string[];
  sector: string;
}

interface ScoredCandidate {
  ticker: string;
  signalDiversity: number;
  technicalScore: number;
  insiderCongressScore: number;
  earningsScore: number;
  compositeScore: number;
  sources: string[];
  scan?: ScanResult;
  tradeSignal?: TradeSignal;
}

function scoreSignalDiversity(ticker: string, bundle: RawSignalBundle, discovered: DiscoveredTicker[]): { score: number; sources: string[] } {
  const sources: string[] = [];

  if (bundle.news.some((n) => n.ticker === ticker && n.catalyst)) sources.push("news");
  if (bundle.insiderBuys.some((i) => i.ticker === ticker)) sources.push("insider");
  if (bundle.congressBuys.some((c) => c.ticker === ticker)) sources.push("congress");
  if (bundle.screenerMoves.some((s) => s.ticker === ticker && s.direction === "gainer")) sources.push("screener");
  if (bundle.earnings.some((e) => e.ticker === ticker)) sources.push("earnings");
  if (bundle.grades.some((g) => g.ticker === ticker)) sources.push("grades");
  if (bundle.pressReleases.some((p) => p.ticker === ticker && p.catalyst)) sources.push("press");
  if (bundle.mergers.some((m) => m.ticker === ticker)) sources.push("merger");
  if (bundle.institutional.some((i) => i.ticker === ticker)) sources.push("institutional");
  if (bundle.filings8k.some((f) => f.ticker === ticker)) sources.push("8k");

  const discoveryEntry = discovered.find((d) => d.ticker === ticker);
  if (discoveryEntry && !sources.includes(discoveryEntry.source)) {
    sources.push(discoveryEntry.source);
  }

  const score = Math.min(100, sources.length * 18);
  return { score, sources };
}

function scoreTechnical(scan: ScanResult | undefined, signal: TradeSignal | undefined): number {
  if (!scan || !signal) return 0;

  let score = 0;

  if (scan.rsi < 35) score += 25;
  else if (scan.rsi < 45) score += 15;
  else if (scan.rsi > 65 && scan.rsi < 75) score += 10;

  if (scan.macd.histogram > 0 && scan.macd.macd > scan.macd.signal) score += 20;
  else if (scan.macd.histogram > 0) score += 10;

  if (scan.volumeRatio > 2) score += 20;
  else if (scan.volumeRatio > 1.5) score += 12;

  if (scan.price > scan.sma20 && scan.sma20 > scan.sma50) score += 15;
  else if (scan.price > scan.ema9) score += 8;

  if (signal.action === "STRONG_BUY") score += 20;
  else if (signal.action === "BUY") score += 10;

  return Math.min(100, score);
}

function scoreInsiderCongress(ticker: string, bundle: RawSignalBundle): number {
  let score = 0;

  const insiderBuys = bundle.insiderBuys.filter((i) => i.ticker === ticker);
  if (insiderBuys.length > 0) {
    const totalValue = insiderBuys.reduce((s, i) => s + i.value, 0);
    if (totalValue > 1000000) score += 40;
    else if (totalValue > 500000) score += 30;
    else score += 20;
    if (insiderBuys.length > 1) score += 15;
  }

  const congressBuys = bundle.congressBuys.filter((c) => c.ticker === ticker);
  if (congressBuys.length > 0) {
    score += 25;
    if (congressBuys.length > 1) score += 10;
  }

  const institutional = bundle.institutional.filter((i) => i.ticker === ticker);
  if (institutional.length > 0) score += 15;

  return Math.min(100, score);
}

function scoreEarnings(ticker: string, bundle: RawSignalBundle): number {
  let score = 0;

  const earning = bundle.earnings.find((e) => e.ticker === ticker);
  if (earning) score += 30;

  const grade = bundle.grades.find((g) => g.ticker === ticker);
  if (grade) {
    const action = grade.newGrade.toLowerCase();
    if (action.includes("buy") || action.includes("outperform") || action.includes("overweight")) {
      score += 35;
    }
  }

  const press = bundle.pressReleases.find((p) => p.ticker === ticker);
  if (press?.catalyst) score += 20;

  return Math.min(100, score);
}

function determineHoldPeriod(sources: string[], scan?: ScanResult): { period: "SHORT" | "MEDIUM" | "LONG"; label: string } {
  const hasEarnings = sources.includes("earnings");
  const hasInsider = sources.includes("insider");
  const hasCongress = sources.includes("congress");
  const hasInstitutional = sources.includes("institutional");
  const hasMerger = sources.includes("merger");

  if (hasEarnings || sources.includes("screener")) {
    return { period: "SHORT", label: "1-3 months" };
  }
  if (hasInsider || hasCongress) {
    return { period: "MEDIUM", label: "3-6 months" };
  }
  if (hasInstitutional || hasMerger) {
    return { period: "LONG", label: "6-12 months" };
  }

  if (scan && scan.monthReturn < -10) {
    return { period: "MEDIUM", label: "3-6 months" };
  }

  return { period: "MEDIUM", label: "3-6 months" };
}

async function generateTheses(picks: Array<{ ticker: string; conviction: number; sources: string[]; holdLabel: string; targetPrice: number; currentPrice: number }>, bundle: RawSignalBundle): Promise<Map<string, string>> {
  const theses = new Map<string, string>();

  const contextLines = picks.map((p) => {
    const parts = [`${p.ticker}: conviction ${p.conviction}/100, hold ${p.holdLabel}, target $${p.targetPrice.toFixed(2)} (current $${p.currentPrice.toFixed(2)})`];
    parts.push(`  Sources: ${p.sources.join(", ")}`);

    const news = bundle.news.filter((n) => n.ticker === p.ticker).slice(0, 2);
    if (news.length > 0) parts.push(`  News: ${news.map((n) => n.title).join("; ")}`);

    const insider = bundle.insiderBuys.filter((i) => i.ticker === p.ticker).slice(0, 2);
    if (insider.length > 0) parts.push(`  Insider buys: ${insider.map((i) => `${i.name} $${(i.value / 1000).toFixed(0)}K`).join(", ")}`);

    const congress = bundle.congressBuys.filter((c) => c.ticker === p.ticker).slice(0, 2);
    if (congress.length > 0) parts.push(`  Congress: ${congress.map((c) => `${c.politician} (${c.party})`).join(", ")}`);

    const grade = bundle.grades.find((g) => g.ticker === p.ticker);
    if (grade) parts.push(`  Analyst: ${grade.firm} → ${grade.newGrade}`);

    return parts.join("\n");
  });

  try {
    const response = await generateCompletion(
      `You are a concise equity analyst. For each stock, write exactly 2-3 sentences explaining the investment thesis based on the signals provided. Be specific about catalysts. Return a JSON array: [{"ticker": "X", "thesis": "..."}]`,
      `Generate investment theses for these top conviction picks:\n\n${contextLines.join("\n\n")}`,
      2048,
    );

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed: Array<{ ticker: string; thesis: string }> = JSON.parse(jsonMatch[0]);
      for (const p of parsed) {
        if (p.ticker && p.thesis) theses.set(p.ticker.toUpperCase(), p.thesis);
      }
    }
  } catch (e) {
    console.error("[Conviction] AI thesis generation failed:", e);
  }

  for (const p of picks) {
    if (!theses.has(p.ticker)) {
      theses.set(p.ticker, `${p.ticker} flagged by ${p.sources.length} signal sources (${p.sources.join(", ")}). Target price $${p.targetPrice.toFixed(2)} with ${p.holdLabel} hold period.`);
    }
  }

  return theses;
}

export async function generateConvictionPicks(): Promise<ConvictionPickResult[]> {
  console.log("[Conviction] Starting top 10 pick generation...");
  const startTime = Date.now();

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

  const tickerList = [...allTickers].filter((t) => !t.includes("-") && t.length <= 5).slice(0, 60);
  console.log(`[Conviction] Candidate pool: ${tickerList.length} tickers`);

  const scanResults = await scanMarket(tickerList);
  const scanMap = new Map(scanResults.map((s) => [s.ticker, s]));

  const candidates: ScoredCandidate[] = [];
  for (const ticker of tickerList) {
    const { score: diversityScore, sources } = scoreSignalDiversity(ticker, bundle, discovered);
    if (sources.length === 0) continue;

    const scan = scanMap.get(ticker);
    const signal = scan ? generateSignals(scan) : undefined;

    const technicalScore = scoreTechnical(scan, signal);
    const insiderCongressScore = scoreInsiderCongress(ticker, bundle);
    const earningsScore = scoreEarnings(ticker, bundle);

    const compositeScore =
      diversityScore * 0.25 +
      technicalScore * 0.20 +
      insiderCongressScore * 0.20 +
      earningsScore * 0.15 +
      (signal ? signal.confidence * 0.20 : 0);

    candidates.push({
      ticker,
      signalDiversity: diversityScore,
      technicalScore,
      insiderCongressScore,
      earningsScore,
      compositeScore,
      sources,
      scan,
      tradeSignal: signal,
    });
  }

  candidates.sort((a, b) => b.compositeScore - a.compositeScore);
  const top10 = candidates.slice(0, 10);
  console.log(`[Conviction] Top 10: ${top10.map((c) => `${c.ticker}(${c.compositeScore.toFixed(1)})`).join(", ")}`);

  const pickData: ConvictionPickResult[] = [];

  const enrichPromises = top10.map(async (candidate, idx) => {
    const [targetData, profileData, quote] = await Promise.allSettled([
      getPriceTargetConsensus(candidate.ticker),
      getProfile(candidate.ticker),
      getQuote(candidate.ticker),
    ]);

    const currentPrice = quote.status === "fulfilled" && quote.value?.price
      ? quote.value.price
      : candidate.scan?.price || 0;

    let targetPrice = currentPrice * 1.15;
    if (targetData.status === "fulfilled" && Array.isArray(targetData.value) && targetData.value[0]?.targetConsensus) {
      targetPrice = targetData.value[0].targetConsensus;
    }

    const profile = profileData.status === "fulfilled" ? profileData.value : null;
    const companyName = (profile as any)?.companyName || (profile as any)?.[0]?.companyName || candidate.ticker;
    const sector = (profile as any)?.sector || (profile as any)?.[0]?.sector || "Unknown";

    const { period, label } = determineHoldPeriod(candidate.sources, candidate.scan);
    const upsidePct = currentPrice > 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;

    return {
      ticker: candidate.ticker,
      companyName,
      rank: idx + 1,
      conviction: Math.round(candidate.compositeScore),
      targetPrice: Math.round(targetPrice * 100) / 100,
      currentPrice: Math.round(currentPrice * 100) / 100,
      upsidePct: Math.round(upsidePct * 10) / 10,
      holdPeriod: period,
      holdLabel: label,
      thesis: "",
      signals: candidate.sources,
      sector,
    } as ConvictionPickResult;
  });

  const enriched = await Promise.all(enrichPromises);
  pickData.push(...enriched);

  const theses = await generateTheses(
    pickData.map((p) => ({ ticker: p.ticker, conviction: p.conviction, sources: p.signals, holdLabel: p.holdLabel, targetPrice: p.targetPrice, currentPrice: p.currentPrice })),
    bundle,
  );

  for (const pick of pickData) {
    pick.thesis = theses.get(pick.ticker) || pick.thesis;
  }

  await prisma.convictionPick.createMany({
    data: pickData.map((p) => ({
      ticker: p.ticker,
      companyName: p.companyName,
      rank: p.rank,
      conviction: p.conviction,
      targetPrice: p.targetPrice,
      currentPrice: p.currentPrice,
      holdPeriod: p.holdPeriod,
      holdLabel: p.holdLabel,
      thesis: p.thesis,
      signals: p.signals,
      sector: p.sector,
      latestPrice: p.currentPrice,
      returnPct: 0,
      peakPrice: p.currentPrice,
      peakReturnPct: 0,
      lastTrackedAt: new Date(),
    })),
  });

  const elapsed = Date.now() - startTime;
  console.log(`[Conviction] Complete in ${(elapsed / 1000).toFixed(1)}s — ${pickData.length} picks persisted`);

  return pickData;
}

export async function updatePickPerformance(): Promise<{ updated: number }> {
  const picks = await prisma.convictionPick.findMany({
    where: {
      pickedAt: { gte: new Date(Date.now() - 365 * 86400000) },
    },
    select: { id: true, ticker: true, currentPrice: true, peakPrice: true },
  });

  const uniqueTickers = [...new Set(picks.map((p) => p.ticker))];
  const quoteMap = new Map<string, number>();

  const batchSize = 5;
  for (let i = 0; i < uniqueTickers.length; i += batchSize) {
    const batch = uniqueTickers.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((t) => getQuote(t)));
    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled" && r.value?.price) {
        quoteMap.set(batch[j], r.value.price);
      }
    }
  }

  let updated = 0;
  for (const pick of picks) {
    const latestPrice = quoteMap.get(pick.ticker);
    if (!latestPrice) continue;

    const returnPct = ((latestPrice - pick.currentPrice) / pick.currentPrice) * 100;
    const newPeak = Math.max(latestPrice, pick.peakPrice || latestPrice);
    const peakReturnPct = ((newPeak - pick.currentPrice) / pick.currentPrice) * 100;

    await prisma.convictionPick.update({
      where: { id: pick.id },
      data: {
        latestPrice: Math.round(latestPrice * 100) / 100,
        returnPct: Math.round(returnPct * 100) / 100,
        peakPrice: Math.round(newPeak * 100) / 100,
        peakReturnPct: Math.round(peakReturnPct * 100) / 100,
        lastTrackedAt: new Date(),
      },
    });
    updated++;
  }

  return { updated };
}
