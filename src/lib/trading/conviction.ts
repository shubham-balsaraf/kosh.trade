import { discoverOpportunities, getRawSignals, type RawSignalBundle, type DiscoveredTicker } from "./discovery";
import { scanMarket, type ScanResult } from "./scanner";
import { generateSignals, type TradeSignal } from "./signals";
import { generateCompletion } from "@/lib/ai/claude";
import {
  getQuote,
  getPriceTargetConsensus,
  getProfile,
  getKeyMetrics,
  getRatios,
  getIncomeStatement,
  getBalanceSheet,
  getDCFValuation,
  getAnalystEstimates,
  getEarningsSurprises,
  getRatingsSnapshot,
} from "@/lib/api/fmp";
import { prisma } from "@/lib/db";

/* ── Public interfaces ──────────────────────────────────── */

export interface ConvictionPickResult {
  ticker: string;
  companyName: string;
  rank: number;
  conviction: number;
  dataConfidence: number;
  targetPrice: number;
  currentPrice: number;
  upsidePct: number;
  holdPeriod: "SHORT" | "MEDIUM" | "LONG";
  holdLabel: string;
  holdDays: number;
  thesis: string;
  signals: string[];
  sector: string;
}

/* ── Exported types ─────────────────────────────────────── */

export interface FundamentalData {
  revenueGrowth: number;
  grossMargin: number;
  operatingMargin: number;
  roe: number;
  currentRatio: number;
  fcfYield: number;
  debtToEquity: number;
  marketCap: number;
  beta: number;
  pe: number;
  forwardPe: number;
  peg: number;
  evToEbitda: number;
  priceToFcf: number;
  dcfValue: number | null;
  analystTarget: number | null;
  earningsSurprisePct: number;
  ratingScore: number;
  sector: string;
  companyName: string;
}

export interface ScoredCandidate {
  ticker: string;
  scores: {
    signalDiversity: number;
    technical: number;
    fundamental: number;
    valuation: number;
    smartMoney: number;
    catalystSentiment: number;
    riskAdjusted: number;
  };
  compositeScore: number;
  dataConfidence: number;
  confidenceBand: "VERY_HIGH" | "HIGH" | "MODERATE";
  sources: string[];
  scan?: ScanResult;
  tradeSignal?: TradeSignal;
  fundamentals?: FundamentalData;
  sentimentScore: number;
}

export const WEIGHTS = {
  signalDiversity: 0.15,
  technical: 0.15,
  fundamental: 0.15,
  valuation: 0.15,
  smartMoney: 0.15,
  catalystSentiment: 0.15,
  riskAdjusted: 0.10,
};

const MAX_PER_SECTOR = 3;
const MIN_COMPOSITE_SCORE = 30;

const HOLD_PERIOD_DAYS: Record<string, number> = { SHORT: 21, MEDIUM: 60, LONG: 180 };

export function computeDataConfidence(
  fd: FundamentalData | undefined,
  scan: ScanResult | undefined,
  bundle: RawSignalBundle | undefined,
  ticker: string,
): number {
  let earned = 0;
  const total = 100;

  /* ── 1. Technical data quality (0-15 pts) ─────────────── */
  if (scan && scan.price > 0) {
    let techPts = 5;
    if (!isNaN(scan.rsi)) techPts += 2;
    if (scan.macd && scan.macd.histogram !== 0) techPts += 2;
    if (!isNaN(scan.adx?.adx)) techPts += 2;
    if (!isNaN(scan.stoch?.k)) techPts += 2;
    if (scan.volumeRatio > 0) techPts += 2;
    earned += Math.min(15, techPts);
  }

  /* ── 2. Fundamental data depth (0-15 pts) ─────────────── */
  if (fd) {
    let fPts = 0;
    if (fd.revenueGrowth !== 0) fPts += 2;
    if (fd.grossMargin > 0) fPts += 2;
    if (fd.roe !== 0) fPts += 2;
    if (fd.currentRatio > 0) fPts += 2;
    if (fd.earningsSurprisePct !== 0) fPts += 2;
    if (fd.fcfYield !== 0) fPts += 2;
    if (fd.debtToEquity !== 0) fPts += 2;
    earned += Math.min(15, fPts);
  }

  /* ── 3. Valuation data depth (0-15 pts) ───────────────── */
  if (fd) {
    let vPts = 0;
    if (fd.forwardPe > 0) vPts += 3;
    if (fd.peg > 0) vPts += 3;
    if (fd.evToEbitda > 0) vPts += 3;
    if (fd.dcfValue != null && fd.dcfValue > 0) vPts += 3;
    if (fd.analystTarget != null && fd.analystTarget > 0) vPts += 3;
    earned += Math.min(15, vPts);
  }

  /* ── 4. Smart money signals — ACTUAL activity (0-20 pts) ─ */
  if (bundle) {
    const insiderHits = bundle.insiderBuys.filter((i) => i.ticker === ticker);
    const congressHits = bundle.congressBuys.filter((c) => c.ticker === ticker);
    const instHits = bundle.institutional.filter((i) => i.ticker === ticker);
    const gradeHits = bundle.grades.filter((g) => g.ticker === ticker);

    if (insiderHits.length > 0) earned += Math.min(6, 3 + insiderHits.length);
    if (congressHits.length > 0) earned += Math.min(6, 3 + congressHits.length);
    if (instHits.length > 0) earned += Math.min(4, 2 + instHits.length);
    if (gradeHits.length > 0) earned += Math.min(4, 2 + gradeHits.length);
  }

  /* ── 5. Catalyst strength — news/events that MOVE stocks (0-25 pts) ── */
  if (bundle) {
    const tickerNews = bundle.news.filter((n) => n.ticker === ticker);
    const catalystNews = tickerNews.filter((n) => n.catalyst);
    const highUrgency = tickerNews.filter((n) => n.urgency >= 3);
    const tickerPress = bundle.pressReleases.filter((p) => p.ticker === ticker);
    const catalystPress = tickerPress.filter((p) => p.catalyst);
    const tickerEarnings = bundle.earnings.filter((e) => e.ticker === ticker);
    const tickerMergers = bundle.mergers.filter((m) => m.ticker === ticker);
    const ticker8k = bundle.filings8k.filter((f) => f.ticker === ticker);

    if (catalystNews.length > 0) earned += Math.min(6, 2 * catalystNews.length);
    if (highUrgency.length > 0) earned += Math.min(4, 2 * highUrgency.length);
    if (catalystPress.length > 0) earned += Math.min(4, 2 * catalystPress.length);
    if (tickerEarnings.length > 0) earned += 4;
    if (tickerMergers.length > 0) earned += 5;
    if (ticker8k.length > 0) earned += Math.min(2, ticker8k.length);
  }

  /* ── 6. Risk data completeness (0-10 pts) ─────────────── */
  if (scan && fd) earned += 10;
  else if (scan || fd) earned += 5;

  return Math.min(100, Math.max(0, Math.round(earned)));
}

/* ── Helpers ────────────────────────────────────────────── */

async function batchFetch<T>(
  tickers: string[],
  fetcher: (t: string) => Promise<T>,
  batchSize = 5,
  delayMs = 300,
): Promise<Map<string, T>> {
  const map = new Map<string, T>();
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(fetcher));
    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled" && r.value != null) map.set(batch[j], r.value);
    }
    if (i + batchSize < tickers.length) await new Promise((r) => setTimeout(r, delayMs));
  }
  return map;
}

function recencyDecay(daysAgo: number): number {
  if (daysAgo <= 1) return 1.0;
  if (daysAgo <= 3) return 0.9;
  if (daysAgo <= 7) return 0.7;
  if (daysAgo <= 14) return 0.5;
  if (daysAgo <= 30) return 0.3;
  return 0.1;
}

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

/* ── Layer 2: Quality Gate ──────────────────────────────── */

interface QualityProfile {
  marketCap: number;
  avgVolume: number;
  revenue: number | null;
  debtToEquity: number | null;
  price: number;
  sector: string;
  companyName: string;
  beta: number;
}

async function fetchQualityProfiles(tickers: string[]): Promise<Map<string, QualityProfile>> {
  const profiles = new Map<string, QualityProfile>();

  const [profileMap, quoteMap] = await Promise.all([
    batchFetch(tickers, async (t) => getProfile(t)),
    batchFetch(tickers, async (t) => getQuote(t)),
  ]);

  const [incomeMap, balanceMap] = await Promise.all([
    batchFetch(tickers, async (t) => getIncomeStatement(t, "annual", 1)).catch(() => new Map<string, any>()),
    batchFetch(tickers, async (t) => getBalanceSheet(t, "annual", 1)).catch(() => new Map<string, any>()),
  ]);

  for (const ticker of tickers) {
    const prof = profileMap.get(ticker);
    const p = Array.isArray(prof) ? prof[0] : prof;
    const q = quoteMap.get(ticker);
    const inc = incomeMap.get(ticker);
    const bal = balanceMap.get(ticker);

    const marketCap = p?.mktCap || p?.marketCap || q?.marketCap || 0;
    const avgVolume = q?.avgVolume || p?.volAvg || 0;

    let revenue: number | null = null;
    if (Array.isArray(inc) && inc[0] && inc[0].revenue !== undefined) {
      revenue = inc[0].revenue;
    }

    let debtToEquity: number | null = null;
    if (Array.isArray(bal) && bal[0]) {
      const totalDebt = bal[0].totalDebt || bal[0].longTermDebt || 0;
      const equity = bal[0].totalStockholdersEquity || 0;
      if (equity > 0) debtToEquity = totalDebt / equity;
    }

    const price = q?.price || p?.price || 0;
    const sector = p?.sector || "Unknown";
    const companyName = p?.companyName || ticker;
    const beta = p?.beta || 1;

    profiles.set(ticker, { marketCap, avgVolume, revenue, debtToEquity, price, sector, companyName, beta });
  }

  return profiles;
}

/* ── Layer 3 Dim 1: Signal Diversity ────────────────────── */

export function scoreSignalDiversity(
  ticker: string,
  bundle: RawSignalBundle,
  discovered: DiscoveredTicker[],
): { score: number; sources: string[] } {
  const sources: string[] = [];
  const sourceWeights: Record<string, number> = {
    news: 10, insider: 18, congress: 18, screener: 8, earnings: 14,
    grades: 12, press: 10, merger: 16, institutional: 16, "8k": 10,
  };

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
  if (discoveryEntry && !sources.includes(discoveryEntry.source)) sources.push(discoveryEntry.source);

  const rawScore = sources.reduce((s, src) => s + (sourceWeights[src] || 8), 0);
  return { score: clamp(rawScore), sources };
}

/* ── Layer 3 Dim 2: Technical Strength ──────────────────── */

export function scoreTechnical(scan: ScanResult | undefined, signal: TradeSignal | undefined): number {
  if (!scan || !signal) return 0;

  let score = 0;

  if (scan.rsi < 30) score += 20;
  else if (scan.rsi < 40) score += 12;
  else if (scan.rsi > 70) score -= 10;

  if (scan.macd.histogram > 0 && scan.macd.macd > scan.macd.signal) score += 15;
  else if (scan.macd.histogram > 0) score += 8;
  else if (scan.macd.histogram < 0 && scan.macd.macd < 0) score -= 5;

  if (scan.bollinger.percentB < 0.2) score += 12;
  else if (scan.bollinger.percentB > 0.8) score -= 5;

  if (scan.price > scan.sma20 && scan.sma20 > scan.sma50) score += 15;
  else if (scan.price > scan.ema9) score += 6;
  else if (scan.price < scan.sma20 && scan.sma20 < scan.sma50) score -= 8;

  if (scan.volumeRatio > 2) score += 12;
  else if (scan.volumeRatio > 1.5) score += 6;

  if (!isNaN(scan.stoch.k)) {
    if (scan.stoch.k < 20 && scan.stoch.d < 20) score += 10;
    else if (scan.stoch.k > 80) score -= 5;
  }

  if (!isNaN(scan.adx.adx)) {
    if (scan.adx.adx > 25 && scan.adx.plusDI > scan.adx.minusDI) score += 12;
    else if (scan.adx.adx > 25 && scan.adx.minusDI > scan.adx.plusDI) score -= 5;
  }

  if (signal.action === "STRONG_BUY") score += 15;
  else if (signal.action === "BUY") score += 8;
  else if (signal.action === "SELL") score -= 5;

  return clamp(score);
}

/* ── Layer 3 Dim 3: Fundamental Quality ─────────────────── */

export async function fetchFundamentals(tickers: string[]): Promise<Map<string, FundamentalData>> {
  const fundamentals = new Map<string, FundamentalData>();

  const empty = new Map<string, any>();
  const [metricsMap, ratiosMap, incomeMap, balanceMap, dcfMap, targetMap, estimatesMap, surprisesMap, ratingsMap, profileMap] = await Promise.all([
    batchFetch(tickers, (t) => getKeyMetrics(t, "annual", 2)).catch((e) => { console.warn("[Conviction] keyMetrics batch failed:", e.message); return empty; }),
    batchFetch(tickers, (t) => getRatios(t, "annual", 2)).catch((e) => { console.warn("[Conviction] ratios batch failed:", e.message); return empty; }),
    batchFetch(tickers, (t) => getIncomeStatement(t, "annual", 2)).catch((e) => { console.warn("[Conviction] income batch failed:", e.message); return empty; }),
    batchFetch(tickers, (t) => getBalanceSheet(t, "annual", 1)).catch((e) => { console.warn("[Conviction] balance batch failed:", e.message); return empty; }),
    batchFetch(tickers, (t) => getDCFValuation(t)).catch((e) => { console.warn("[Conviction] DCF batch failed:", e.message); return empty; }),
    batchFetch(tickers, (t) => getPriceTargetConsensus(t)).catch((e) => { console.warn("[Conviction] priceTarget batch failed:", e.message); return empty; }),
    batchFetch(tickers, (t) => getAnalystEstimates(t)).catch((e) => { console.warn("[Conviction] estimates batch failed:", e.message); return empty; }),
    batchFetch(tickers, (t) => getEarningsSurprises(t)).catch((e) => { console.warn("[Conviction] surprises batch failed:", e.message); return empty; }),
    batchFetch(tickers, (t) => getRatingsSnapshot(t)).catch((e) => { console.warn("[Conviction] ratings batch failed:", e.message); return empty; }),
    batchFetch(tickers, (t) => getProfile(t)).catch((e) => { console.warn("[Conviction] profile batch failed:", e.message); return empty; }),
  ]);

  console.log(`[Conviction] Fundamentals data coverage: metrics=${metricsMap.size}/${tickers.length} ratios=${ratiosMap.size}/${tickers.length} income=${incomeMap.size}/${tickers.length} balance=${balanceMap.size}/${tickers.length} dcf=${dcfMap.size}/${tickers.length} targets=${targetMap.size}/${tickers.length} estimates=${estimatesMap.size}/${tickers.length} surprises=${surprisesMap.size}/${tickers.length} ratings=${ratingsMap.size}/${tickers.length} profiles=${profileMap.size}/${tickers.length}`);

  for (const ticker of tickers) {
    const metrics = metricsMap.get(ticker);
    const ratios = ratiosMap.get(ticker);
    const income = incomeMap.get(ticker);
    const balance = balanceMap.get(ticker);
    const dcf = dcfMap.get(ticker);
    const target = targetMap.get(ticker);
    const estimates = estimatesMap.get(ticker);
    const surprises = surprisesMap.get(ticker);
    const ratings = ratingsMap.get(ticker);
    const prof = profileMap.get(ticker);

    const m0 = Array.isArray(metrics) ? metrics[0] : null;
    const r0 = Array.isArray(ratios) ? ratios[0] : null;
    const inc0 = Array.isArray(income) ? income[0] : null;
    const inc1 = Array.isArray(income) && income.length > 1 ? income[1] : null;
    const bal0 = Array.isArray(balance) ? balance[0] : null;
    const p = Array.isArray(prof) ? prof[0] : prof;

    const revenueGrowth = inc0 && inc1 && inc1.revenue > 0
      ? ((inc0.revenue - inc1.revenue) / inc1.revenue) * 100
      : 0;

    const grossMargin = r0?.grossProfitMargin || 0;
    const operatingMargin = r0?.operatingProfitMargin || 0;
    const roe = r0?.returnOnEquity || m0?.roe || 0;
    const currentRatio = r0?.currentRatio || 0;
    const fcf = inc0?.netIncome || 0;
    const marketCap = m0?.marketCap || p?.mktCap || 0;
    const fcfYield = marketCap > 0 ? (fcf / marketCap) * 100 : 0;
    const totalDebt = bal0?.totalDebt || 0;
    const equity = bal0?.totalStockholdersEquity || 1;
    const debtToEquity = equity > 0 ? totalDebt / equity : 99;
    const beta = p?.beta || 1;

    const pe = m0?.peRatio || 0;
    const peg = m0?.pegRatio || 0;
    const evToEbitda = m0?.enterpriseValueOverEBITDA || 0;
    const priceToFcf = m0?.pfcfRatio || 0;

    const forwardEps = Array.isArray(estimates) && estimates[0]
      ? (estimates[0].estimatedEpsAvg || 0) : 0;
    const currentPrice = p?.price || 0;
    const forwardPe = forwardEps > 0 ? currentPrice / forwardEps : 0;

    const dcfVal = Array.isArray(dcf) && dcf[0] ? (dcf[0].dcf || null) : null;
    const analystTarget = Array.isArray(target) && target[0] ? (target[0].targetConsensus || null) : null;

    const surprisePct = Array.isArray(surprises) && surprises.length > 0
      ? surprises.slice(0, 4).reduce((sum: number, s: any) => {
          const actual = s.actualEarningResult || s.actual || 0;
          const est = s.estimatedEarning || s.estimate || 0;
          return sum + (est !== 0 ? ((actual - est) / Math.abs(est)) * 100 : 0);
        }, 0) / Math.min(4, surprises.length)
      : 0;

    const ratingScore = Array.isArray(ratings) && ratings[0]
      ? (ratings[0].ratingScore || ratings[0].score || 0) : 0;

    fundamentals.set(ticker, {
      revenueGrowth,
      grossMargin,
      operatingMargin,
      roe,
      currentRatio,
      fcfYield,
      debtToEquity,
      marketCap,
      beta,
      pe,
      forwardPe,
      peg,
      evToEbitda,
      priceToFcf,
      dcfValue: dcfVal,
      analystTarget,
      earningsSurprisePct: surprisePct,
      ratingScore,
      sector: p?.sector || "Unknown",
      companyName: p?.companyName || ticker,
    });
  }

  return fundamentals;
}

export function scoreFundamental(fd: FundamentalData | undefined): number {
  if (!fd) return 0;
  let score = 0;

  if (fd.revenueGrowth > 25) score += 20;
  else if (fd.revenueGrowth > 10) score += 14;
  else if (fd.revenueGrowth > 0) score += 6;
  else score -= 5;

  if (fd.grossMargin > 0.6) score += 12;
  else if (fd.grossMargin > 0.4) score += 8;
  else if (fd.grossMargin > 0.2) score += 4;

  if (fd.operatingMargin > 0.25) score += 12;
  else if (fd.operatingMargin > 0.15) score += 8;
  else if (fd.operatingMargin > 0.05) score += 4;

  if (fd.roe > 0.25) score += 15;
  else if (fd.roe > 0.15) score += 10;
  else if (fd.roe > 0.08) score += 5;
  else if (fd.roe < 0) score -= 5;

  if (fd.currentRatio > 2) score += 8;
  else if (fd.currentRatio > 1.5) score += 5;
  else if (fd.currentRatio < 1) score -= 5;

  if (fd.fcfYield > 8) score += 12;
  else if (fd.fcfYield > 4) score += 8;
  else if (fd.fcfYield > 0) score += 3;

  if (fd.earningsSurprisePct > 10) score += 10;
  else if (fd.earningsSurprisePct > 0) score += 5;

  if (fd.debtToEquity < 0.5) score += 6;
  else if (fd.debtToEquity > 2) score -= 5;

  return clamp(score);
}

/* ── Layer 3 Dim 4: Valuation Attractiveness ────────────── */

export function scoreValuation(fd: FundamentalData | undefined, currentPrice: number): number {
  if (!fd) return 0;
  let score = 0;

  if (fd.forwardPe > 0 && fd.forwardPe < 12) score += 18;
  else if (fd.forwardPe > 0 && fd.forwardPe < 20) score += 12;
  else if (fd.forwardPe > 0 && fd.forwardPe < 30) score += 5;
  else if (fd.forwardPe > 40) score -= 5;

  if (fd.peg > 0 && fd.peg < 1) score += 20;
  else if (fd.peg > 0 && fd.peg < 1.5) score += 14;
  else if (fd.peg > 0 && fd.peg < 2) score += 6;
  else if (fd.peg > 3) score -= 5;

  if (fd.evToEbitda > 0 && fd.evToEbitda < 10) score += 15;
  else if (fd.evToEbitda > 0 && fd.evToEbitda < 18) score += 8;
  else if (fd.evToEbitda > 30) score -= 5;

  if (fd.dcfValue && currentPrice > 0) {
    const dcfDiscount = ((fd.dcfValue - currentPrice) / currentPrice) * 100;
    if (dcfDiscount > 40) score += 22;
    else if (dcfDiscount > 20) score += 16;
    else if (dcfDiscount > 10) score += 8;
    else if (dcfDiscount < -20) score -= 8;
  }

  if (fd.priceToFcf > 0 && fd.priceToFcf < 15) score += 10;
  else if (fd.priceToFcf > 0 && fd.priceToFcf < 25) score += 5;

  return clamp(score);
}

/* ── Layer 3 Dim 5: Smart Money Flow ────────────────────── */

export function scoreSmartMoney(ticker: string, bundle: RawSignalBundle): number {
  let score = 0;

  const insiderBuys = bundle.insiderBuys.filter((i) => i.ticker === ticker);
  if (insiderBuys.length > 0) {
    const totalValue = insiderBuys.reduce((s, i) => s + i.value, 0);
    if (totalValue > 1_000_000) score += 25;
    else if (totalValue > 500_000) score += 18;
    else score += 10;

    if (insiderBuys.length >= 3) score += 15;
    else if (insiderBuys.length >= 2) score += 10;
  }

  const congressBuys = bundle.congressBuys.filter((c) => c.ticker === ticker);
  if (congressBuys.length > 0) {
    score += 15;
    const parties = new Set(congressBuys.map((c) => c.party));
    if (parties.size > 1) score += 10;
    if (congressBuys.length > 1) score += 5;
  }

  const institutional = bundle.institutional.filter((i) => i.ticker === ticker);
  if (institutional.length > 0) {
    score += 12;
    if (institutional.length >= 2) score += 8;
  }

  const grades = bundle.grades.filter((g) => g.ticker === ticker);
  const upgrades = grades.filter((g) => {
    const a = g.newGrade.toLowerCase();
    return a.includes("buy") || a.includes("outperform") || a.includes("overweight");
  });
  if (upgrades.length >= 2) score += 15;
  else if (upgrades.length === 1) score += 8;

  return clamp(score);
}

/* ── Layer 3 Dim 6: Catalyst & Sentiment ────────────────── */

const CATALYST_TIER: Record<string, number> = {
  "FDA/drug approval": 20, "M&A activity": 18, "Major contract/deal": 16,
  "Earnings beat": 14, "Record performance": 14, "Analyst upgrade": 12,
  "Defense/geopolitical": 12, "AI/tech catalyst": 10, "Shareholder return": 10,
  "Energy catalyst": 8, "Geopolitical/trade policy": 8,
};

export function scoreCatalyst(ticker: string, bundle: RawSignalBundle): number {
  let score = 0;

  const news = bundle.news.filter((n) => n.ticker === ticker && n.catalyst);
  for (const n of news.slice(0, 3)) {
    score += CATALYST_TIER[n.catalyst!] || 6;
  }

  const press = bundle.pressReleases.filter((p) => p.ticker === ticker && p.catalyst);
  for (const p of press.slice(0, 2)) {
    score += CATALYST_TIER[p.catalyst!] || 6;
  }

  if (bundle.mergers.some((m) => m.ticker === ticker)) score += 15;
  if (bundle.filings8k.some((f) => f.ticker === ticker)) score += 8;
  if (bundle.earnings.some((e) => e.ticker === ticker)) score += 6;

  return clamp(score);
}

async function batchSentimentAnalysis(
  tickers: string[],
  bundle: RawSignalBundle,
): Promise<Map<string, number>> {
  const sentiments = new Map<string, number>();
  if (tickers.length === 0) return sentiments;

  const tickerNewsMap: Record<string, string[]> = {};
  for (const t of tickers) {
    const headlines = bundle.news
      .filter((n) => n.ticker === t)
      .map((n) => n.title)
      .slice(0, 5);
    const pressHeadlines = bundle.pressReleases
      .filter((p) => p.ticker === t)
      .map((p) => p.title)
      .slice(0, 3);
    const all = [...headlines, ...pressHeadlines];
    if (all.length > 0) tickerNewsMap[t] = all;
  }

  const tickersWithNews = Object.keys(tickerNewsMap);
  if (tickersWithNews.length === 0) return sentiments;

  const context = tickersWithNews.map((t) =>
    `${t}:\n${tickerNewsMap[t].map((h, i) => `  ${i + 1}. ${h}`).join("\n")}`
  ).join("\n\n");

  try {
    const response = await generateCompletion(
      `You are a financial sentiment analyst. For each stock ticker, analyze the news headlines and rate the overall sentiment from -100 (extremely bearish) to +100 (extremely bullish). 0 is neutral. Return ONLY a JSON array: [{"ticker":"X","sentiment":N}]. No explanation.`,
      `Rate sentiment for these stocks based on recent headlines:\n\n${context}`,
      1024,
    );

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed: Array<{ ticker: string; sentiment: number }> = JSON.parse(jsonMatch[0]);
      for (const p of parsed) {
        if (p.ticker && typeof p.sentiment === "number") {
          sentiments.set(p.ticker.toUpperCase(), clamp(p.sentiment, -100, 100));
        }
      }
    }
  } catch (e) {
    console.error("[Conviction] Sentiment analysis failed:", e);
  }

  for (const t of tickers) {
    if (!sentiments.has(t)) sentiments.set(t, 0);
  }
  return sentiments;
}

/* ── Layer 3 Dim 7: Risk-Adjusted Return ────────────────── */

export function scoreRiskAdjusted(
  scan: ScanResult | undefined,
  fd: FundamentalData | undefined,
  currentPrice: number,
): number {
  if (!scan || !fd) return 30;

  const targetPrice = fd.analystTarget || (fd.dcfValue ? fd.dcfValue : currentPrice * 1.1);
  const expectedReturn = currentPrice > 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;

  const volatility = isNaN(scan.volatility) ? 30 : scan.volatility;
  const sharpe = volatility > 0 ? expectedReturn / volatility : 0;

  let score = 0;
  if (sharpe > 1.5) score += 35;
  else if (sharpe > 1.0) score += 25;
  else if (sharpe > 0.5) score += 15;
  else if (sharpe > 0) score += 5;

  if (scan.drawdown3m < 10) score += 20;
  else if (scan.drawdown3m < 20) score += 12;
  else if (scan.drawdown3m < 30) score += 5;
  else score -= 5;

  const beta = fd.beta || 1;
  if (beta < 0.8 && expectedReturn > 10) score += 15;
  else if (beta < 1.2) score += 8;
  else if (beta > 1.8) score -= 5;

  if (expectedReturn > 30) score += 15;
  else if (expectedReturn > 15) score += 10;
  else if (expectedReturn > 5) score += 5;
  else if (expectedReturn < 0) score -= 10;

  return clamp(score);
}

/* ── Layer 4: Sector Diversification ────────────────────── */

function applySectorCap(candidates: ScoredCandidate[], maxPerSector: number): ScoredCandidate[] {
  const sectorCounts = new Map<string, number>();
  const result: ScoredCandidate[] = [];

  for (const c of candidates) {
    const sector = c.fundamentals?.sector || "Unknown";
    const count = sectorCounts.get(sector) || 0;
    if (count < maxPerSector) {
      result.push(c);
      sectorCounts.set(sector, count + 1);
      if (result.length >= 10) break;
    }
  }

  if (result.length < 10) {
    for (const c of candidates) {
      if (!result.includes(c)) {
        result.push(c);
        if (result.length >= 10) break;
      }
    }
  }

  return result;
}

/* ── Target Price Blending ──────────────────────────────── */

function blendTargetPrice(
  fd: FundamentalData | undefined,
  scan: ScanResult | undefined,
  currentPrice: number,
): number {
  const sources: Array<{ value: number; weight: number }> = [];

  if (fd?.analystTarget && fd.analystTarget > 0) {
    sources.push({ value: fd.analystTarget, weight: 0.4 });
  }
  if (fd?.dcfValue && fd.dcfValue > 0) {
    sources.push({ value: fd.dcfValue, weight: 0.35 });
  }
  if (scan) {
    const techTarget = Math.max(
      scan.high20,
      scan.bollinger.upper,
      currentPrice * 1.1,
    );
    sources.push({ value: techTarget, weight: 0.25 });
  }

  if (sources.length === 0) return currentPrice * 1.15;

  const totalWeight = sources.reduce((s, src) => s + src.weight, 0);
  const blended = sources.reduce((s, src) => s + src.value * (src.weight / totalWeight), 0);

  return Math.round(blended * 100) / 100;
}

/* ── Hold Period Logic ──────────────────────────────────── */

function determineHoldPeriod(
  scan: ScanResult | undefined,
  fd: FundamentalData | undefined,
  sources: string[],
): { period: "SHORT" | "MEDIUM" | "LONG"; label: string } {
  const atrPct = scan && scan.price > 0 ? (scan.atr / scan.price) * 100 : 2;
  const beta = fd?.beta || 1;
  const hasMomentumCatalyst = sources.includes("screener") || sources.includes("earnings");
  const hasFundamentalCatalyst = sources.includes("insider") || sources.includes("congress") || sources.includes("grades");
  const hasValueCatalyst = sources.includes("institutional") || sources.includes("merger");

  if (atrPct > 3 || (beta > 1.5 && hasMomentumCatalyst)) {
    return { period: "SHORT", label: "1-4 weeks" };
  }
  if (hasValueCatalyst || (beta < 0.8 && !hasMomentumCatalyst)) {
    return { period: "LONG", label: "3-12 months" };
  }
  if (hasFundamentalCatalyst || atrPct < 1.5) {
    return { period: "MEDIUM", label: "1-3 months" };
  }

  return { period: "MEDIUM", label: "1-3 months" };
}

/* ── Confidence Band ────────────────────────────────────── */

function confidenceBand(score: number): "VERY_HIGH" | "HIGH" | "MODERATE" {
  if (score >= 45) return "VERY_HIGH";
  if (score >= 25) return "HIGH";
  return "MODERATE";
}

/* ── Enhanced AI Thesis Generation ──────────────────────── */

async function generateDeepTheses(
  picks: Array<{
    ticker: string;
    conviction: number;
    sources: string[];
    holdLabel: string;
    targetPrice: number;
    currentPrice: number;
    confidenceBand: string;
    fundamentals?: FundamentalData;
  }>,
  bundle: RawSignalBundle,
): Promise<Map<string, string>> {
  const theses = new Map<string, string>();

  const contextLines = picks.map((p) => {
    const parts: string[] = [
      `${p.ticker} (${p.fundamentals?.companyName || p.ticker}): conviction ${p.conviction}/100 [${p.confidenceBand}], target $${p.targetPrice.toFixed(2)} (current $${p.currentPrice.toFixed(2)}), hold ${p.holdLabel}`,
      `  Signals: ${p.sources.join(", ")}`,
    ];

    if (p.fundamentals) {
      const fd = p.fundamentals;
      parts.push(`  Fundamentals: Rev growth ${fd.revenueGrowth.toFixed(1)}%, GM ${(fd.grossMargin * 100).toFixed(0)}%, OPM ${(fd.operatingMargin * 100).toFixed(0)}%, ROE ${(fd.roe * 100).toFixed(0)}%`);
      parts.push(`  Valuation: Fwd P/E ${fd.forwardPe.toFixed(1)}, PEG ${fd.peg.toFixed(2)}, EV/EBITDA ${fd.evToEbitda.toFixed(1)}${fd.dcfValue ? `, DCF $${fd.dcfValue.toFixed(2)}` : ""}`);
      parts.push(`  Risk: Beta ${fd.beta.toFixed(2)}, D/E ${fd.debtToEquity.toFixed(2)}, Current ratio ${fd.currentRatio.toFixed(2)}`);
    }

    const news = bundle.news.filter((n) => n.ticker === p.ticker).slice(0, 3);
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
      `You are a senior equity analyst writing concise investment theses. For each stock, write EXACTLY 4 sentences in this structure:
1. Bull case — the primary reason to buy (mention specific catalysts and fundamentals)
2. Supporting evidence — what data confirms the thesis (insider activity, analyst consensus, valuation gap)
3. Key risk — the single biggest risk that could invalidate this pick
4. Catalyst timeline — when the thesis should play out

Be specific with numbers. Return a JSON array: [{"ticker": "X", "thesis": "..."}]`,
      `Generate investment theses for these top conviction picks:\n\n${contextLines.join("\n\n")}`,
      3072,
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
      const fd = p.fundamentals;
      const valInfo = fd ? ` Trading at ${fd.forwardPe.toFixed(1)}x forward P/E with ${fd.revenueGrowth.toFixed(0)}% revenue growth.` : "";
      theses.set(p.ticker, `${p.ticker} flagged by ${p.sources.length} signal sources (${p.sources.join(", ")}).${valInfo} Target price $${p.targetPrice.toFixed(2)} with ${p.holdLabel} hold period.`);
    }
  }

  return theses;
}

/* ── Main Generation Pipeline ───────────────────────────── */

/* ── Lightweight scorer for KoshPilot trading engine ────── */

export interface TradingConviction {
  compositeScore: number;
  dataConfidence: number;
  scores: Record<string, number>;
}

export async function scoreForTrading(
  tickers: string[],
  scanMap: Map<string, ScanResult>,
  signalMap: Map<string, TradeSignal>,
  bundle: RawSignalBundle,
  discovered: DiscoveredTicker[],
): Promise<Map<string, TradingConviction>> {
  const results = new Map<string, TradingConviction>();
  if (tickers.length === 0) return results;

  console.log(`[Conviction/Trading] Scoring ${tickers.length} tickers for KoshPilot...`);

  const fundamentals = await fetchFundamentals(tickers);

  for (const ticker of tickers) {
    const scan = scanMap.get(ticker);
    const signal = signalMap.get(ticker);
    const fd = fundamentals.get(ticker);
    const currentPrice = scan?.price || fd?.marketCap || 0;

    const { score: sigDiversityScore } = scoreSignalDiversity(ticker, bundle, discovered);
    const techScore = scoreTechnical(scan, signal);
    const fundScore = scoreFundamental(fd);
    const valScore = scoreValuation(fd, currentPrice);
    const smartScore = scoreSmartMoney(ticker, bundle);
    const catScore = scoreCatalyst(ticker, bundle);
    const riskScore = scoreRiskAdjusted(scan, fd, currentPrice);

    const scores = {
      signalDiversity: sigDiversityScore,
      technical: techScore,
      fundamental: fundScore,
      valuation: valScore,
      smartMoney: smartScore,
      catalystSentiment: catScore,
      riskAdjusted: riskScore,
    };

    const composite = Math.round(
      scores.signalDiversity * WEIGHTS.signalDiversity +
      scores.technical * WEIGHTS.technical +
      scores.fundamental * WEIGHTS.fundamental +
      scores.valuation * WEIGHTS.valuation +
      scores.smartMoney * WEIGHTS.smartMoney +
      scores.catalystSentiment * WEIGHTS.catalystSentiment +
      scores.riskAdjusted * WEIGHTS.riskAdjusted
    );

    const confidence = computeDataConfidence(fd, scan, bundle, ticker);

    console.log(`[Conviction/Trading] ${ticker}: composite=${composite} confidence=${confidence}% | sig=${sigDiversityScore} tech=${techScore} fund=${fundScore} val=${valScore} smart=${smartScore} cat=${catScore} risk=${riskScore}`);

    results.set(ticker, { compositeScore: composite, dataConfidence: confidence, scores });
  }

  return results;
}

/* ── Full conviction pipeline for Top 10 Picks ─────────── */

export async function generateConvictionPicks(): Promise<ConvictionPickResult[]> {
  console.log("[Conviction] Starting best-in-market pick generation...");
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

  const rawPool = [...allTickers].filter((t) => !t.includes("-") && t.length <= 5).slice(0, 80);
  console.log(`[Conviction] Raw candidate pool: ${rawPool.length} tickers`);

  /* ── Layer 2: Quality Gate ───────────────────── */

  const qualityProfiles = await fetchQualityProfiles(rawPool);
  const gateStats = { noProfile: 0, pennyStock: 0, lowCap: 0, lowVol: 0, negRevenue: 0, highDebt: 0, passed: 0 };
  const qualifiedTickers: string[] = [];
  for (const t of rawPool) {
    const qp = qualityProfiles.get(t);
    if (!qp) { gateStats.noProfile++; continue; }
    if (qp.price < 5) { gateStats.pennyStock++; continue; }
    if (qp.marketCap > 0 && qp.marketCap < 500_000_000) { gateStats.lowCap++; continue; }
    if (qp.avgVolume > 0 && qp.avgVolume < 500_000) { gateStats.lowVol++; continue; }
    if (qp.revenue !== null && qp.revenue <= 0) { gateStats.negRevenue++; continue; }
    if (qp.debtToEquity !== null && qp.debtToEquity > 3) { gateStats.highDebt++; continue; }
    gateStats.passed++;
    qualifiedTickers.push(t);
  }
  console.log(`[Conviction] After quality gate: ${qualifiedTickers.length}/${rawPool.length} tickers`);
  console.log(`[Conviction] Gate rejections: ${JSON.stringify(gateStats)}`);

  if (qualifiedTickers.length === 0) {
    console.log("[Conviction] No candidates passed quality gate. Returning empty.");
    return [];
  }

  /* ── Technical scan ─────────────────────────── */

  const scanResults = await scanMarket(qualifiedTickers);
  const scanMap = new Map(scanResults.map((s) => [s.ticker, s]));

  /* ── Fundamental enrichment ─────────────────── */

  const fundamentalsMap = await fetchFundamentals(qualifiedTickers);

  /* ── AI Sentiment batch ─────────────────────── */

  const sentimentMap = await batchSentimentAnalysis(qualifiedTickers, bundle);

  /* ── Layer 3: Score all 7 dimensions ────────── */

  const allScored: ScoredCandidate[] = [];
  for (const ticker of qualifiedTickers) {
    const { score: diversityScore, sources } = scoreSignalDiversity(ticker, bundle, discovered);
    if (sources.length === 0) continue;

    const scan = scanMap.get(ticker);
    const signal = scan ? generateSignals(scan) : undefined;
    const fd = fundamentalsMap.get(ticker);
    const sentiment = sentimentMap.get(ticker) || 0;
    const currentPrice = scan?.price || qualityProfiles.get(ticker)?.price || 0;

    const scores = {
      signalDiversity: diversityScore,
      technical: scoreTechnical(scan, signal),
      fundamental: scoreFundamental(fd),
      valuation: scoreValuation(fd, currentPrice),
      smartMoney: scoreSmartMoney(ticker, bundle),
      catalystSentiment: clamp(scoreCatalyst(ticker, bundle) + (sentiment > 0 ? sentiment * 0.3 : sentiment * 0.15)),
      riskAdjusted: scoreRiskAdjusted(scan, fd, currentPrice),
    };

    const compositeScore = Math.round(
      scores.signalDiversity * WEIGHTS.signalDiversity +
      scores.technical * WEIGHTS.technical +
      scores.fundamental * WEIGHTS.fundamental +
      scores.valuation * WEIGHTS.valuation +
      scores.smartMoney * WEIGHTS.smartMoney +
      scores.catalystSentiment * WEIGHTS.catalystSentiment +
      scores.riskAdjusted * WEIGHTS.riskAdjusted
    );

    allScored.push({
      ticker,
      scores,
      compositeScore,
      dataConfidence: computeDataConfidence(fd, scan, bundle, ticker),
      confidenceBand: confidenceBand(compositeScore),
      sources,
      scan,
      tradeSignal: signal,
      fundamentals: fd,
      sentimentScore: sentiment,
    });
  }

  // Rank by confidence-weighted conviction: a high conviction with thin data
  // should not outrank a slightly lower conviction backed by strong evidence
  allScored.sort((a, b) => {
    const aFinal = a.compositeScore * (0.6 + 0.4 * (a.dataConfidence / 100));
    const bFinal = b.compositeScore * (0.6 + 0.4 * (b.dataConfidence / 100));
    return bFinal - aFinal;
  });

  if (allScored.length > 0) {
    const top5 = allScored.slice(0, 5);
    for (const c of top5) {
      const finalRank = c.compositeScore * (0.6 + 0.4 * (c.dataConfidence / 100));
      console.log(`[Conviction] ${c.ticker}: composite=${c.compositeScore} confidence=${c.dataConfidence}% final=${Math.round(finalRank)} | div=${c.scores.signalDiversity} tech=${c.scores.technical} fund=${c.scores.fundamental} val=${c.scores.valuation} smart=${c.scores.smartMoney} cat=${c.scores.catalystSentiment} risk=${c.scores.riskAdjusted}`);
    }
  }

  const candidates = allScored.length > 10
    ? allScored.filter((c) => c.compositeScore >= MIN_COMPOSITE_SCORE).length >= 10
      ? allScored.filter((c) => c.compositeScore >= MIN_COMPOSITE_SCORE)
      : allScored.slice(0, Math.max(10, allScored.length))
    : allScored;

  console.log(`[Conviction] Scored candidates: ${allScored.length} total, ${candidates.length} selected (min score in selection: ${candidates.length > 0 ? candidates[candidates.length - 1].compositeScore : 0})`);

  /* ── Layer 4: Sector diversification ────────── */

  const diversified = applySectorCap(candidates, MAX_PER_SECTOR);
  const top10 = diversified.slice(0, 10);
  console.log(`[Conviction] Top 10 after sector cap: ${top10.map((c) => `${c.ticker}(${c.compositeScore})`).join(", ")}`);

  /* ── Layer 5: Enrich, target, thesis ────────── */

  const pickData: ConvictionPickResult[] = top10.map((candidate, idx) => {
    const currentPrice = candidate.scan?.price || qualityProfiles.get(candidate.ticker)?.price || 0;
    const targetPrice = blendTargetPrice(candidate.fundamentals, candidate.scan, currentPrice);
    const { period, label } = determineHoldPeriod(candidate.scan, candidate.fundamentals, candidate.sources);
    const upsidePct = currentPrice > 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;

    return {
      ticker: candidate.ticker,
      companyName: candidate.fundamentals?.companyName || qualityProfiles.get(candidate.ticker)?.companyName || candidate.ticker,
      rank: idx + 1,
      conviction: candidate.compositeScore,
      dataConfidence: candidate.dataConfidence,
      targetPrice: Math.round(targetPrice * 100) / 100,
      currentPrice: Math.round(currentPrice * 100) / 100,
      upsidePct: Math.round(upsidePct * 10) / 10,
      holdPeriod: period,
      holdLabel: label,
      holdDays: HOLD_PERIOD_DAYS[period] || 60,
      thesis: "",
      signals: candidate.sources,
      sector: candidate.fundamentals?.sector || qualityProfiles.get(candidate.ticker)?.sector || "Unknown",
    };
  });

  const theses = await generateDeepTheses(
    top10.map((c, i) => ({
      ticker: c.ticker,
      conviction: c.compositeScore,
      sources: c.sources,
      holdLabel: pickData[i].holdLabel,
      targetPrice: pickData[i].targetPrice,
      currentPrice: pickData[i].currentPrice,
      confidenceBand: c.confidenceBand,
      fundamentals: c.fundamentals,
    })),
    bundle,
  );

  for (const pick of pickData) {
    pick.thesis = theses.get(pick.ticker) || pick.thesis;
  }

  /* ── Persist ────────────────────────────────── */

  await prisma.convictionPick.createMany({
    data: pickData.map((p) => ({
      ticker: p.ticker,
      companyName: p.companyName,
      rank: p.rank,
      conviction: p.conviction,
      dataConfidence: p.dataConfidence,
      targetPrice: p.targetPrice,
      currentPrice: p.currentPrice,
      holdPeriod: p.holdPeriod,
      holdLabel: p.holdLabel,
      holdDays: p.holdDays,
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

/* ── Performance Tracking ───────────────────────────────── */

export async function updatePickPerformance(): Promise<{ updated: number }> {
  const picks = await prisma.convictionPick.findMany({
    where: {
      pickedAt: { gte: new Date(Date.now() - 365 * 86400000) },
    },
    select: {
      id: true, ticker: true, currentPrice: true, peakPrice: true,
      targetPrice: true, pickedAt: true, hitTarget: true, hitTargetAt: true,
      holdPeriod: true, holdDays: true,
    },
  });

  const uniqueTickers: string[] = Array.from(new Set(picks.map((p: any) => String(p.ticker))));
  const quoteMap = new Map<string, number>();

  const batchSize = 5;
  for (let i = 0; i < uniqueTickers.length; i += batchSize) {
    const batch = uniqueTickers.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((t: string) => getQuote(t)));
    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled" && r.value?.price) {
        quoteMap.set(batch[j] as string, r.value.price);
      }
    }
  }

  let updated = 0;
  for (const pick of picks as any[]) {
    const latestPrice = quoteMap.get(pick.ticker);
    if (!latestPrice) continue;

    const returnPct = ((latestPrice - pick.currentPrice) / pick.currentPrice) * 100;
    const newPeak = Math.max(latestPrice, pick.peakPrice || latestPrice);
    const peakReturnPct = ((newPeak - pick.currentPrice) / pick.currentPrice) * 100;
    const targetReached = latestPrice >= pick.targetPrice || newPeak >= pick.targetPrice;
    const daysSincePick = Math.floor((Date.now() - new Date(pick.pickedAt).getTime()) / 86400000);
    const expectedDays = pick.holdDays || HOLD_PERIOD_DAYS[pick.holdPeriod] || 60;
    const graceWindow = 60;

    const alreadyHit = pick.hitTarget === true;
    const hitTargetNow = alreadyHit || targetReached;
    const hitTargetAt = alreadyHit ? pick.hitTargetAt : (targetReached ? new Date() : null);

    let withinTimeline: boolean | null = null;
    if (hitTargetNow && hitTargetAt) {
      const hitDays = Math.floor((new Date(hitTargetAt).getTime() - new Date(pick.pickedAt).getTime()) / 86400000);
      withinTimeline = hitDays <= (expectedDays + graceWindow);
    }

    let outcome: string | null = null;
    if (hitTargetNow && withinTimeline === true) {
      outcome = "BULLSEYE";
    } else if (hitTargetNow && withinTimeline === false) {
      outcome = "LATE_HIT";
    } else if (daysSincePick > expectedDays + graceWindow) {
      outcome = returnPct > 0 ? "WINNER" : "MISS";
    }

    await prisma.convictionPick.update({
      where: { id: pick.id },
      data: {
        latestPrice: Math.round(latestPrice * 100) / 100,
        returnPct: Math.round(returnPct * 100) / 100,
        peakPrice: Math.round(newPeak * 100) / 100,
        peakReturnPct: Math.round(peakReturnPct * 100) / 100,
        lastTrackedAt: new Date(),
        hitTarget: hitTargetNow,
        ...(hitTargetAt && !alreadyHit ? { hitTargetAt } : {}),
        ...(withinTimeline !== null ? { withinTimeline } : {}),
        ...(outcome ? { outcome } : {}),
      },
    });
    updated++;

    if (daysSincePick > 0) {
      console.log(`[Conviction] ${pick.ticker}: ${returnPct.toFixed(1)}% return, peak ${peakReturnPct.toFixed(1)}%, ${hitTargetNow ? "HIT" : "pending"}, ${outcome || "tracking"}, ${daysSincePick}d`);
    }
  }

  return { updated };
}
