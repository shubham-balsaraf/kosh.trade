import {
  getCashFlow,
  getIncomeStatement,
  getBalanceSheet,
  getKeyMetrics,
  getRatios,
  getDCFValuation,
  getProfile,
  getEarningsSurprises,
  getStockScreener,
} from "@/lib/api/fmp";
import { type RawSignalBundle } from "./discovery";

/* ── Interfaces ──────────────────────────────────────────── */

export interface BuffettFundamentals {
  ticker: string;
  companyName: string;
  sector: string;
  marketCap: number;
  price: number;

  cashFlows: Array<{
    year: string;
    operatingCashFlow: number;
    capitalExpenditure: number;
    freeCashFlow: number;
    stockBasedCompensation: number;
    dividendsPaid: number;
    shareRepurchases: number;
  }>;

  incomeStatements: Array<{
    year: string;
    revenue: number;
    netIncome: number;
    grossProfit: number;
    operatingIncome: number;
    researchAndDevelopment: number;
  }>;

  balanceSheets: Array<{
    year: string;
    totalDebt: number;
    totalStockholdersEquity: number;
    totalCurrentAssets: number;
    totalCurrentLiabilities: number;
    cashAndEquivalents: number;
    goodwill: number;
    totalAssets: number;
    interestExpense: number;
  }>;

  ratios: Array<{
    year: string;
    grossProfitMargin: number;
    operatingProfitMargin: number;
    returnOnEquity: number;
    returnOnCapitalEmployed: number;
    currentRatio: number;
  }>;

  historicalPE: number[];
  historicalEvEbitda: number[];

  dcfValue: number | null;
  analystTarget: number | null;
  earningsSurprises: Array<{ actual: number; estimate: number }>;
  pe: number;
  forwardPe: number;
  peg: number;
  fcfYield: number;
  beta: number;
}

export interface BuffettScores {
  cashFlowQuality: number;       // 0-25
  earningsQuality: number;       // 0-20
  moatStrength: number;          // 0-20
  balanceSheetFortress: number;  // 0-15
  valuationSafety: number;       // 0-10
  macroOverlay: number;          // 0-10
  historicalValuation: number;   // 0-10
  moatErosion: number;           // 0-10
  capitalAllocation: number;     // 0-10
  total: number;                 // 0-130
}

export interface OraclePick {
  ticker: string;
  companyName: string;
  sector: string;
  price: number;
  marketCap: number;
  buffettScore: number;
  weightedRank: number;
  scores: BuffettScores;
  moatRating: "Wide" | "Narrow" | "None" | "Eroding";
  marginOfSafety: number;
  keyMetrics: {
    fcfMargin: number;
    fcfYield: number;
    sbcToRevenue: number;
    debtToEquity: number;
    roe: number;
    grossMargin: number;
    revenueGrowthCAGR: number;
    fcfGrowthCAGR: number;
    peDiscount: number;
    evEbitdaDiscount: number;
    shareholderYield: number;
    goodwillRatio: number;
    buybackYears: number;
  };
  thesis: string;
}

/* ── Helpers ─────────────────────────────────────────────── */

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

function cagr(start: number, end: number, years: number): number {
  if (start <= 0 || end <= 0 || years <= 0) return 0;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return 999;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

async function batchFetch<T>(
  tickers: string[],
  fetcher: (t: string) => Promise<T>,
  batchSize = 3,
  delayMs = 800,
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

/* ── Universe Selection ──────────────────────────────────── */

const BUFFETT_UNIVERSE = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "META", "JNJ", "UNH", "V", "MA",
  "PG", "HD", "KO", "PEP", "COST", "MRK", "ABBV", "LLY", "AVGO",
  "MCD", "TXN", "UNP", "HON", "AMGN", "ADP", "ISRG", "ACN",
  "SPGI", "MCO", "SHW", "WMT", "CAT", "DE", "NVDA", "INTU",
  "NOW", "ADBE", "CRM", "ORCL", "WM", "CME",
];

async function selectUniverse(bundle: RawSignalBundle | null): Promise<string[]> {
  const candidates = new Set<string>(BUFFETT_UNIVERSE);

  if (bundle) {
    for (const ib of bundle.insiderBuys) if (ib.ticker.length <= 5) candidates.add(ib.ticker);
    for (const cb of bundle.congressBuys) if (cb.ticker.length <= 5) candidates.add(cb.ticker);
    for (const inst of bundle.institutional) if (inst.ticker.length <= 5) candidates.add(inst.ticker);
  }

  try {
    const screened = await getStockScreener({
      marketCapMoreThan: "5000000000",
      betaLowerThan: "1.5",
      isActivelyTrading: "true",
      limit: "50",
    });
    if (Array.isArray(screened)) {
      for (const s of screened) {
        if (s.symbol && s.symbol.length <= 5 && !s.symbol.includes("-")) {
          candidates.add(s.symbol);
        }
      }
    }
  } catch (e) {
    console.warn("[Oracle] Screener enrichment failed:", (e as Error).message);
  }

  return [...candidates].filter((t) => !t.includes("-") && t.length <= 5);
}

/* ── Deep Fundamental Fetch ──────────────────────────────── */

export async function fetchBuffettFundamentals(tickers: string[]): Promise<Map<string, BuffettFundamentals>> {
  const result = new Map<string, BuffettFundamentals>();
  const empty = new Map<string, any>();

  console.log(`[Oracle] Phase 1: fetching core data (CF, IS, Profile) for ${tickers.length} tickers...`);

  const cfMap = await batchFetch(tickers, (t) => getCashFlow(t, "annual", 5)).catch(() => empty);
  const isMap = await batchFetch(tickers, (t) => getIncomeStatement(t, "annual", 5)).catch(() => empty);
  const profMap = await batchFetch(tickers, (t) => getProfile(t)).catch(() => empty);

  console.log(`[Oracle] Phase 1 results: CF=${cfMap.size} IS=${isMap.size} Prof=${profMap.size}`);

  const phase1Survivors = tickers.filter((t) => {
    const cf = cfMap.get(t);
    const is_ = isMap.get(t);
    const prof = profMap.get(t);
    const p = Array.isArray(prof) ? prof[0] : prof;
    const mktCap = p?.mktCap || 0;
    if (!Array.isArray(cf) || cf.length < 2) return false;
    if (!Array.isArray(is_) || is_.length < 2) return false;
    if (mktCap < 5_000_000_000) return false;
    return true;
  });

  console.log(`[Oracle] Phase 1 gate: ${phase1Survivors.length}/${tickers.length} tickers survived (CF>=2, IS>=2, mktCap>=$5B)`);

  if (phase1Survivors.length === 0) {
    console.error("[Oracle] No tickers passed Phase 1 quality gate — check FMP API key and connectivity");
    return result;
  }

  console.log(`[Oracle] Phase 2: fetching supplementary data (BS, KM, Ratios, DCF, Surprises) for ${phase1Survivors.length} tickers...`);

  const bsMap = await batchFetch(phase1Survivors, (t) => getBalanceSheet(t, "annual", 5)).catch(() => empty);
  const kmMap = await batchFetch(phase1Survivors, (t) => getKeyMetrics(t, "annual", 5)).catch(() => empty);
  const rtMap = await batchFetch(phase1Survivors, (t) => getRatios(t, "annual", 5)).catch(() => empty);
  const dcfMap = await batchFetch(phase1Survivors, (t) => getDCFValuation(t)).catch(() => empty);
  const surpriseMap = await batchFetch(phase1Survivors, (t) => getEarningsSurprises(t)).catch(() => empty);

  console.log(`[Oracle] Phase 2 results: BS=${bsMap.size} KM=${kmMap.size} RT=${rtMap.size} DCF=${dcfMap.size} Surp=${surpriseMap.size}`);

  for (const ticker of phase1Survivors) {
    const cf = cfMap.get(ticker);
    const is_ = isMap.get(ticker);
    const bs = bsMap.get(ticker);
    const km = kmMap.get(ticker);
    const rt = rtMap.get(ticker);
    const dcf = dcfMap.get(ticker);
    const prof = profMap.get(ticker);
    const surp = surpriseMap.get(ticker);

    if (!Array.isArray(cf) || cf.length < 2) continue;
    if (!Array.isArray(is_) || is_.length < 2) continue;

    const p = Array.isArray(prof) ? prof[0] : prof;
    const marketCap = p?.mktCap || 0;
    if (marketCap < 5_000_000_000) continue;

    const cashFlows = cf.slice(0, 5).map((c: any) => ({
      year: c.date?.slice(0, 4) || "",
      operatingCashFlow: c.operatingCashFlow || 0,
      capitalExpenditure: Math.abs(c.capitalExpenditure || 0),
      freeCashFlow: c.freeCashFlow || 0,
      stockBasedCompensation: c.stockBasedCompensation || 0,
      dividendsPaid: Math.abs(c.dividendsPaid || 0),
      shareRepurchases: Math.abs(c.commonStockRepurchased || 0),
    }));

    const incomeStatements = (is_ || []).slice(0, 5).map((i: any) => ({
      year: i.date?.slice(0, 4) || "",
      revenue: i.revenue || 0,
      netIncome: i.netIncome || 0,
      grossProfit: i.grossProfit || 0,
      operatingIncome: i.operatingIncome || 0,
      researchAndDevelopment: i.researchAndDevelopmentExpenses || 0,
    }));

    const balanceSheets = (Array.isArray(bs) ? bs : []).slice(0, 5).map((b: any) => ({
      year: b.date?.slice(0, 4) || "",
      totalDebt: b.totalDebt || 0,
      totalStockholdersEquity: b.totalStockholdersEquity || 1,
      totalCurrentAssets: b.totalCurrentAssets || 0,
      totalCurrentLiabilities: b.totalCurrentLiabilities || 1,
      cashAndEquivalents: b.cashAndCashEquivalents || 0,
      goodwill: b.goodwill || 0,
      totalAssets: b.totalAssets || 0,
      interestExpense: b.interestExpense || 0,
    }));

    const ratios = (Array.isArray(rt) ? rt : []).slice(0, 5).map((r: any) => ({
      year: r.date?.slice(0, 4) || "",
      grossProfitMargin: r.grossProfitMargin || 0,
      operatingProfitMargin: r.operatingProfitMargin || 0,
      returnOnEquity: r.returnOnEquity || 0,
      returnOnCapitalEmployed: r.returnOnCapitalEmployed || 0,
      currentRatio: r.currentRatio || 0,
    }));

    const kmArr = Array.isArray(km) ? km.slice(0, 5) : [];
    const km0 = kmArr[0] || null;
    const dcfArr = Array.isArray(dcf) ? dcf : [];
    const surprises = Array.isArray(surp) ? surp.slice(0, 8) : [];

    const historicalPE = kmArr
      .map((k: any) => k.peRatio as number)
      .filter((v: number) => v > 0 && v < 500);
    const historicalEvEbitda = kmArr
      .map((k: any) => (k.enterpriseValueOverEBITDA || k.evToEbitda) as number)
      .filter((v: number) => v > 0 && v < 200);

    const latestFCF = cashFlows[0]?.freeCashFlow || 0;

    result.set(ticker, {
      ticker,
      companyName: p?.companyName || ticker,
      sector: p?.sector || "Unknown",
      marketCap,
      price: p?.price || 0,
      cashFlows,
      incomeStatements,
      balanceSheets,
      ratios,
      historicalPE,
      historicalEvEbitda,
      dcfValue: dcfArr[0]?.dcf || null,
      analystTarget: null,
      earningsSurprises: surprises.map((s: any) => ({
        actual: s.actualEarningResult || s.actual || 0,
        estimate: s.estimatedEarning || s.estimate || 0,
      })),
      pe: km0?.peRatio || 0,
      forwardPe: km0?.forwardPeRatio || 0,
      peg: km0?.pegRatio || 0,
      fcfYield: marketCap > 0 ? (latestFCF / marketCap) * 100 : 0,
      beta: p?.beta || 1,
    });
  }

  console.log(`[Oracle] ${result.size}/${tickers.length} tickers passed fundamental quality gate`);
  return result;
}

/* ── 6-Dimension Scoring ─────────────────────────────────── */

export function scoreBuffettDimensions(
  fd: BuffettFundamentals,
  bundle: RawSignalBundle | null,
): BuffettScores {
  const scores: BuffettScores = {
    cashFlowQuality: 0,
    earningsQuality: 0,
    moatStrength: 0,
    balanceSheetFortress: 0,
    valuationSafety: 0,
    macroOverlay: 0,
    historicalValuation: 0,
    moatErosion: 0,
    capitalAllocation: 0,
    total: 0,
  };

  /* ── 1. Cash Flow Quality (0-25 pts) ──────────────────── */
  {
    const cf0 = fd.cashFlows[0];
    const rev0 = fd.incomeStatements[0]?.revenue || 1;
    const ni0 = fd.incomeStatements[0]?.netIncome || 1;
    let pts = 0;

    const fcfMargin = cf0 ? cf0.freeCashFlow / rev0 : 0;
    if (fcfMargin > 0.20) pts += 8;
    else if (fcfMargin > 0.10) pts += 5;
    else if (fcfMargin > 0.05) pts += 3;

    const fcfToNI = ni0 !== 0 ? cf0?.freeCashFlow / ni0 : 0;
    if (fcfToNI > 1.2) pts += 6;
    else if (fcfToNI > 1.0) pts += 4;
    else if (fcfToNI > 0.8) pts += 2;

    const years = fd.cashFlows.length;
    if (years >= 3) {
      const oldest = fd.cashFlows[years - 1]?.freeCashFlow || 0;
      const newest = cf0?.freeCashFlow || 0;
      const fcfCAGR = cagr(Math.abs(oldest), Math.abs(newest), years - 1);
      if (oldest > 0 && newest > oldest) {
        if (fcfCAGR > 15) pts += 6;
        else if (fcfCAGR > 8) pts += 4;
        else if (fcfCAGR > 0) pts += 2;
      }
    }

    const positiveOCF = fd.cashFlows.filter((c) => c.operatingCashFlow > 0).length;
    if (positiveOCF >= 5) pts += 5;
    else if (positiveOCF >= 4) pts += 3;
    else if (positiveOCF >= 3) pts += 1;

    scores.cashFlowQuality = Math.min(25, pts);
  }

  /* ── 2. Earnings Quality & SBC (0-20 pts) ─────────────── */
  {
    let pts = 0;
    const cf0 = fd.cashFlows[0];
    const rev0 = fd.incomeStatements[0]?.revenue || 1;
    const fcf0 = cf0?.freeCashFlow || 1;

    const sbcToRev = (cf0?.stockBasedCompensation || 0) / rev0;
    if (sbcToRev < 0.02) pts += 8;
    else if (sbcToRev < 0.05) pts += 5;
    else if (sbcToRev < 0.10) pts += 2;
    else if (sbcToRev > 0.15) pts -= 3;

    const sbcToFCF = fcf0 > 0 ? (cf0?.stockBasedCompensation || 0) / fcf0 : 999;
    if (sbcToFCF < 0.20) pts += 4;
    else if (sbcToFCF < 0.50) pts += 2;
    else if (sbcToFCF > 1.0) pts -= 2;

    const revenues = fd.incomeStatements.map((i) => i.revenue).reverse();
    let growingYears = 0;
    for (let i = 1; i < revenues.length; i++) {
      if (revenues[i] > revenues[i - 1]) growingYears++;
    }
    const revYears = revenues.length - 1;
    if (growingYears >= 4) pts += 4;
    else if (growingYears >= 3) pts += 3;
    else if (growingYears >= 2) pts += 1;

    if (fd.earningsSurprises.length > 0) {
      const avgSurprise = fd.earningsSurprises.reduce((s, e) => {
        if (e.estimate === 0) return s;
        return s + ((e.actual - e.estimate) / Math.abs(e.estimate)) * 100;
      }, 0) / fd.earningsSurprises.length;
      if (avgSurprise > 5) pts += 4;
      else if (avgSurprise > 0) pts += 2;
    }

    scores.earningsQuality = clamp(pts, 0, 20);
  }

  /* ── 3. Moat Strength (0-20 pts) ──────────────────────── */
  {
    let pts = 0;
    const margins = fd.ratios.map((r) => r.grossProfitMargin).reverse();
    const latestGM = margins.length > 0 ? margins[margins.length - 1] : 0;
    const avgGM = margins.length > 0 ? margins.reduce((s, v) => s + v, 0) / margins.length : 0;
    const gmTrending = margins.length >= 3 && margins[margins.length - 1] >= margins[0];

    if (latestGM > 0.50 && gmTrending) pts += 6;
    else if (latestGM > 0.50) pts += 5;
    else if (latestGM > 0.40) pts += 4;
    else if (latestGM > 0.30) pts += 2;

    const roes = fd.ratios.map((r) => r.returnOnEquity);
    const highROEyears = roes.filter((r) => r > 0.20).length;
    if (highROEyears >= 3) pts += 5;
    else if (roes.filter((r) => r > 0.15).length >= 3) pts += 3;
    else if (roes.some((r) => r > 0.15)) pts += 1;

    const opMargins = fd.ratios.map((r) => r.operatingProfitMargin).reverse();
    if (opMargins.length >= 3) {
      const first = opMargins[0];
      const last = opMargins[opMargins.length - 1];
      if (last > first * 1.05) pts += 5;
      else if (last >= first * 0.95) pts += 3;
      else pts += 1;
    }

    const revGrowths = fd.incomeStatements.map((i) => i.revenue).reverse();
    if (revGrowths.length >= 3) {
      const growthRates = [];
      for (let i = 1; i < revGrowths.length; i++) {
        if (revGrowths[i - 1] > 0) growthRates.push((revGrowths[i] - revGrowths[i - 1]) / revGrowths[i - 1]);
      }
      const cv = coefficientOfVariation(growthRates);
      if (cv < 0.3) pts += 4;
      else if (cv < 0.6) pts += 2;
    }

    scores.moatStrength = Math.min(20, pts);
  }

  /* ── 4. Balance Sheet Fortress (0-15 pts) ─────────────── */
  {
    let pts = 0;
    const bs0 = fd.balanceSheets[0];
    if (bs0) {
      const de = bs0.totalStockholdersEquity > 0 ? bs0.totalDebt / bs0.totalStockholdersEquity : 99;
      if (de < 0.3) pts += 5;
      else if (de < 0.7) pts += 3;
      else if (de < 1.5) pts += 1;
      else if (de > 3) pts -= 2;

      const operatingIncome = fd.incomeStatements[0]?.operatingIncome || 0;
      const intExp = bs0.interestExpense || 1;
      const coverage = intExp > 0 ? operatingIncome / intExp : 999;
      if (coverage > 10) pts += 4;
      else if (coverage > 5) pts += 2;

      const cr = bs0.totalCurrentLiabilities > 0 ? bs0.totalCurrentAssets / bs0.totalCurrentLiabilities : 0;
      if (cr > 1.5) pts += 3;
      else if (cr > 1.0) pts += 2;

      const cashPct = fd.marketCap > 0 ? (bs0.cashAndEquivalents / fd.marketCap) * 100 : 0;
      if (cashPct > 15) pts += 3;
      else if (cashPct > 5) pts += 2;
    }

    scores.balanceSheetFortress = clamp(pts, 0, 15);
  }

  /* ── 5. Valuation & Margin of Safety (0-10 pts) ───────── */
  {
    let pts = 0;

    if (fd.dcfValue && fd.price > 0) {
      const upside = ((fd.dcfValue - fd.price) / fd.price) * 100;
      if (upside > 30) pts += 4;
      else if (upside > 10) pts += 2;
    }

    if (fd.fcfYield > 6) pts += 3;
    else if (fd.fcfYield > 3) pts += 2;
    else if (fd.fcfYield > 1) pts += 1;

    if (fd.peg > 0 && fd.peg < 1.0) pts += 3;
    else if (fd.peg > 0 && fd.peg < 1.5) pts += 2;
    else if (fd.peg > 0 && fd.peg < 2.0) pts += 1;

    scores.valuationSafety = Math.min(10, pts);
  }

  /* ── 6. Macro & Catalyst Overlay (0-10 pts) ───────────── */
  {
    let pts = 0;

    if (bundle) {
      const sectorPerf = bundle.sectorPerformance.find((s) =>
        s.sector.toLowerCase().includes(fd.sector.toLowerCase().split(" ")[0]),
      );
      if (sectorPerf && sectorPerf.changePct > 0.5) pts += 3;
      else if (sectorPerf && sectorPerf.changePct > 0) pts += 1;

      if (bundle.fearGreed) {
        if (bundle.fearGreed.score <= 25) pts += 3;
        else if (bundle.fearGreed.score <= 45) pts += 2;
        else if (bundle.fearGreed.score >= 75) pts += 1;
      }

      const tickerNews = bundle.news.filter((n) => n.ticker === fd.ticker && n.catalyst);
      if (tickerNews.length > 0) pts += 2;

      const hasInsider = bundle.insiderBuys.some((i) => i.ticker === fd.ticker);
      const hasInst = bundle.institutional.some((i) => i.ticker === fd.ticker);
      if (hasInsider && hasInst) pts += 2;
      else if (hasInsider || hasInst) pts += 1;
    }

    scores.macroOverlay = Math.min(10, pts);
  }

  /* ── 7. Historical Valuation Attractiveness (0-10 pts) ── */
  {
    let pts = 0;

    if (fd.historicalPE.length >= 2 && fd.pe > 0) {
      const avgPE = fd.historicalPE.reduce((s, v) => s + v, 0) / fd.historicalPE.length;
      const peRatio = fd.pe / avgPE;
      if (peRatio < 0.70) pts += 4;
      else if (peRatio < 0.85) pts += 2;
    }

    if (fd.historicalEvEbitda.length >= 2) {
      const currentEV = fd.historicalEvEbitda[0] || 0;
      const avgEV = fd.historicalEvEbitda.reduce((s, v) => s + v, 0) / fd.historicalEvEbitda.length;
      if (currentEV > 0 && avgEV > 0) {
        const evRatio = currentEV / avgEV;
        if (evRatio < 0.75) pts += 3;
        else if (evRatio < 0.90) pts += 2;
      }
    }

    if (fd.forwardPe > 0 && fd.pe > 0) {
      const fwdRatio = fd.forwardPe / fd.pe;
      if (fwdRatio < 0.80) pts += 3;
      else if (fwdRatio < 0.90) pts += 2;
    }

    scores.historicalValuation = Math.min(10, pts);
  }

  /* ── 8. Moat Erosion Risk (0-10 pts, base 5) ──────────── */
  {
    let pts = 5;
    const gms = fd.ratios.map((r) => r.grossProfitMargin).reverse();
    if (gms.length >= 3) {
      const gmDelta = (gms[gms.length - 1] - gms[0]) * 100;
      if (gmDelta < -3) pts -= 3;
      else if (gmDelta < -1) pts -= 1;
      else pts += 2;
    }

    const roes = fd.ratios.map((r) => r.returnOnEquity).reverse();
    if (roes.length >= 3) {
      const roeDelta = roes[roes.length - 1] - roes[0];
      if (roeDelta < -0.03) pts -= 2;
      else if (roeDelta >= 0) pts += 2;
    }

    const rdRatios = fd.incomeStatements.map((i) =>
      i.revenue > 0 ? i.researchAndDevelopment / i.revenue : 0,
    ).reverse();
    if (rdRatios.length >= 3 && rdRatios[0] > 0) {
      const rdDelta = rdRatios[rdRatios.length - 1] - rdRatios[0];
      if (rdDelta >= 0) pts += 2;
      else pts -= 1;
    }

    const opMs = fd.ratios.map((r) => r.operatingProfitMargin).reverse();
    if (opMs.length >= 4) {
      const firstHalf = (opMs[1] - opMs[0]);
      const secondHalf = (opMs[opMs.length - 1] - opMs[opMs.length - 2]);
      if (secondHalf > firstHalf && secondHalf > 0) pts += 2;
    }

    scores.moatErosion = clamp(pts, 0, 10);
  }

  /* ── 9. Capital Allocation Quality (0-10 pts) ──────────── */
  {
    let pts = 0;

    const latestCF = fd.cashFlows[0];
    if (latestCF && fd.marketCap > 0) {
      const netReturn = (latestCF.dividendsPaid + latestCF.shareRepurchases - latestCF.stockBasedCompensation);
      const shareholderYield = (netReturn / fd.marketCap) * 100;
      if (shareholderYield > 5) pts += 4;
      else if (shareholderYield > 3) pts += 3;
      else if (shareholderYield > 1) pts += 2;
    }

    const buybackYears = fd.cashFlows.filter((c) => c.shareRepurchases > c.stockBasedCompensation).length;
    if (buybackYears >= 5) pts += 3;
    else if (buybackYears >= 3) pts += 2;
    else if (buybackYears >= 1) pts += 1;

    const bs0 = fd.balanceSheets[0];
    if (bs0 && bs0.totalAssets > 0) {
      const gwRatio = bs0.goodwill / bs0.totalAssets;
      if (gwRatio < 0.10) pts += 2;
      else if (gwRatio < 0.20) pts += 1;
      else if (gwRatio > 0.40) pts -= 1;
    }

    const divYears = fd.cashFlows.filter((c) => c.dividendsPaid > 0).length;
    if (divYears >= 5) {
      const divs = fd.cashFlows.map((c) => c.dividendsPaid).reverse();
      const growing = divs.length >= 2 && divs[divs.length - 1] >= divs[0];
      if (growing) pts += 1;
    }

    scores.capitalAllocation = clamp(pts, 0, 10);
  }

  scores.total = scores.cashFlowQuality + scores.earningsQuality + scores.moatStrength +
    scores.balanceSheetFortress + scores.valuationSafety + scores.macroOverlay +
    scores.historicalValuation + scores.moatErosion + scores.capitalAllocation;

  return scores;
}

/* ── Moat Rating ─────────────────────────────────────────── */

function classifyMoat(scores: BuffettScores): "Wide" | "Narrow" | "None" | "Eroding" {
  if (scores.moatErosion <= 2) return "Eroding";
  if (scores.moatStrength >= 15 && scores.cashFlowQuality >= 18) return "Wide";
  if (scores.moatStrength >= 10 || scores.cashFlowQuality >= 15) return "Narrow";
  return "None";
}

/* ── Thesis Generation ───────────────────────────────────── */

function generateThesis(fd: BuffettFundamentals, scores: BuffettScores, moat: string): string {
  const parts: string[] = [];
  const cf0 = fd.cashFlows[0];
  const rev0 = fd.incomeStatements[0]?.revenue || 1;
  const fcfMargin = cf0 ? ((cf0.freeCashFlow / rev0) * 100).toFixed(0) : "0";
  const sbcPct = cf0 ? ((cf0.stockBasedCompensation / rev0) * 100).toFixed(1) : "0";
  const gm = fd.ratios[0]?.grossProfitMargin ? (fd.ratios[0].grossProfitMargin * 100).toFixed(0) : "?";

  if (moat === "Eroding") parts.push(`Moat under pressure — ${gm}% gross margins but declining`);
  else if (moat === "Wide") parts.push(`${moat} moat with ${gm}% gross margins`);
  else parts.push(`${moat} moat — ${gm}% gross margins`);

  parts.push(`${fcfMargin}% FCF margin`);

  if (parseFloat(sbcPct) < 3) parts.push(`minimal dilution (${sbcPct}% SBC)`);
  else if (parseFloat(sbcPct) > 10) parts.push(`high SBC at ${sbcPct}% of revenue`);

  if (scores.balanceSheetFortress >= 12) parts.push("fortress balance sheet");
  else if (scores.balanceSheetFortress >= 8) parts.push("solid balance sheet");

  if (scores.historicalValuation >= 7) parts.push("trading well below historical valuation");
  else if (scores.historicalValuation >= 4) parts.push("reasonably priced vs history");

  if (scores.capitalAllocation >= 7) parts.push("excellent capital allocation");
  else if (scores.capitalAllocation >= 4) parts.push("solid shareholder returns");

  if (fd.dcfValue && fd.price > 0) {
    const upside = ((fd.dcfValue - fd.price) / fd.price) * 100;
    if (upside > 15) parts.push(`~${upside.toFixed(0)}% DCF upside`);
  }

  return parts.join(", ") + ".";
}

/* ── Main Pipeline ───────────────────────────────────────── */

export async function generateOraclePicks(bundle: RawSignalBundle | null): Promise<OraclePick[]> {
  console.log("[Oracle] Starting Buffett-style long-term analysis...");
  const startTime = Date.now();

  const universe = await selectUniverse(bundle);
  console.log(`[Oracle] Universe: ${universe.length} candidates`);

  const fundamentals = await fetchBuffettFundamentals(universe);
  console.log(`[Oracle] ${fundamentals.size} tickers with deep fundamentals`);

  const scored: OraclePick[] = [];
  for (const [ticker, fd] of fundamentals) {
    const scores = scoreBuffettDimensions(fd, bundle);
    const moat = classifyMoat(scores);

    const cf0 = fd.cashFlows[0];
    const rev0 = fd.incomeStatements[0]?.revenue || 1;
    const fcfMargin = cf0 ? (cf0.freeCashFlow / rev0) * 100 : 0;
    const sbcToRev = cf0 ? (cf0.stockBasedCompensation / rev0) * 100 : 0;
    const de = fd.balanceSheets[0]
      ? fd.balanceSheets[0].totalDebt / (fd.balanceSheets[0].totalStockholdersEquity || 1)
      : 0;
    const roe = fd.ratios[0]?.returnOnEquity ? fd.ratios[0].returnOnEquity * 100 : 0;
    const gm = fd.ratios[0]?.grossProfitMargin ? fd.ratios[0].grossProfitMargin * 100 : 0;

    const revenues = fd.incomeStatements.map((i) => i.revenue).reverse();
    const revCAGR = revenues.length >= 3
      ? cagr(revenues[0], revenues[revenues.length - 1], revenues.length - 1)
      : 0;

    const fcfs = fd.cashFlows.map((c) => c.freeCashFlow).reverse();
    const fcfCAGR = fcfs.length >= 3 && fcfs[0] > 0
      ? cagr(fcfs[0], fcfs[fcfs.length - 1], fcfs.length - 1)
      : 0;

    let marginOfSafety = 0;
    if (fd.dcfValue && fd.price > 0) {
      marginOfSafety = ((fd.dcfValue - fd.price) / fd.price) * 100;
    }

    let peDiscount = 0;
    if (fd.historicalPE.length >= 2 && fd.pe > 0) {
      const avgPE = fd.historicalPE.reduce((s, v) => s + v, 0) / fd.historicalPE.length;
      peDiscount = Math.round((1 - fd.pe / avgPE) * 1000) / 10;
    }
    let evEbitdaDiscount = 0;
    if (fd.historicalEvEbitda.length >= 2) {
      const cur = fd.historicalEvEbitda[0] || 0;
      const avg = fd.historicalEvEbitda.reduce((s, v) => s + v, 0) / fd.historicalEvEbitda.length;
      if (cur > 0 && avg > 0) evEbitdaDiscount = Math.round((1 - cur / avg) * 1000) / 10;
    }

    let shareholderYield = 0;
    if (cf0 && fd.marketCap > 0) {
      const netReturn = cf0.dividendsPaid + cf0.shareRepurchases - cf0.stockBasedCompensation;
      shareholderYield = Math.round((netReturn / fd.marketCap) * 1000) / 10;
    }

    const gwRatio = fd.balanceSheets[0] && fd.balanceSheets[0].totalAssets > 0
      ? Math.round((fd.balanceSheets[0].goodwill / fd.balanceSheets[0].totalAssets) * 1000) / 10
      : 0;

    const buybackYears = fd.cashFlows.filter((c) => c.shareRepurchases > c.stockBasedCompensation).length;

    const weightedRank = scores.total * 0.70
      + scores.historicalValuation * 1.5
      + scores.capitalAllocation * 1.2
      - (10 - scores.moatErosion) * 1.0;

    scored.push({
      ticker,
      companyName: fd.companyName,
      sector: fd.sector,
      price: fd.price,
      marketCap: fd.marketCap,
      buffettScore: scores.total,
      weightedRank: Math.round(weightedRank * 10) / 10,
      scores,
      moatRating: moat,
      marginOfSafety: Math.round(marginOfSafety * 10) / 10,
      keyMetrics: {
        fcfMargin: Math.round(fcfMargin * 10) / 10,
        fcfYield: Math.round(fd.fcfYield * 10) / 10,
        sbcToRevenue: Math.round(sbcToRev * 10) / 10,
        debtToEquity: Math.round(de * 100) / 100,
        roe: Math.round(roe * 10) / 10,
        grossMargin: Math.round(gm * 10) / 10,
        revenueGrowthCAGR: Math.round(revCAGR * 10) / 10,
        fcfGrowthCAGR: Math.round(fcfCAGR * 10) / 10,
        peDiscount: peDiscount,
        evEbitdaDiscount: evEbitdaDiscount,
        shareholderYield: shareholderYield,
        goodwillRatio: gwRatio,
        buybackYears: buybackYears,
      },
      thesis: generateThesis(fd, scores, moat),
    });
  }

  scored.sort((a, b) => b.weightedRank - a.weightedRank);

  const topPicks = scored.slice(0, 15);
  const elapsed = Date.now() - startTime;
  console.log(`[Oracle] Complete in ${elapsed}ms — ${scored.length} scored → top ${topPicks.length} picks`);
  if (topPicks.length > 0) {
    console.log(`[Oracle] Top 5: ${topPicks.slice(0, 5).map((p) => `${p.ticker}(${p.buffettScore},${p.moatRating})`).join(" | ")}`);
  }

  return topPicks;
}
