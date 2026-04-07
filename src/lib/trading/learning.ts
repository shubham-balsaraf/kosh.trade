import { prisma } from "@/lib/db";
import type { TradeSignal } from "./signals";
import type { ScanResult } from "./scanner";
import type { TradingConviction } from "./conviction";

/* ═══════════════════════════════════════════════════════════
   KoshPilot Self-Learning Engine
   ═══════════════════════════════════════════════════════════ */

/* ── Types ──────────────────────────────────────────────── */

export interface ConvictionWeights {
  signalDiversity: number;
  technical: number;
  fundamental: number;
  valuation: number;
  smartMoney: number;
  catalystSentiment: number;
  riskAdjusted: number;
}

export const DEFAULT_WEIGHTS: ConvictionWeights = {
  signalDiversity: 0.15,
  technical: 0.15,
  fundamental: 0.15,
  valuation: 0.15,
  smartMoney: 0.15,
  catalystSentiment: 0.15,
  riskAdjusted: 0.10,
};

const WEIGHT_FLOOR = 0.05;
const WEIGHT_CEILING = 0.35;
const MAX_CHANGE_PER_RECAL = 0.20;
const MIN_TRADES_FOR_LEARNING = 20;
const EMA_ALPHA = 0.15;

interface SnapshotInput {
  autoTradeId: string;
  signal: TradeSignal;
  scan?: ScanResult;
  conviction?: TradingConviction;
  signalSource: string;
  discoveryReason?: string | null;
  fearGreed?: number;
  sector?: string;
}

/* ── Phase 1: Trade Snapshot ────────────────────────────── */

export async function saveTradeSnapshot(input: SnapshotInput): Promise<void> {
  try {
    const { signal, scan, conviction, autoTradeId } = input;

    const indicatorScores: Record<string, number> = {};
    for (const ind of signal.signals) {
      indicatorScores[ind.name.toLowerCase()] = ind.score;
    }

    await prisma.tradeSnapshot.create({
      data: {
        autoTradeId,
        rsiScore: indicatorScores["rsi"] ?? null,
        macdScore: indicatorScores["macd"] ?? null,
        bollingerScore: indicatorScores["bollinger"] ?? null,
        trendScore: indicatorScores["trend"] ?? null,
        volumeScore: indicatorScores["volume"] ?? null,
        momentumScore: indicatorScores["momentum"] ?? null,
        vwapScore: indicatorScores["vwap"] ?? null,
        srScore: indicatorScores["s/r"] ?? null,
        compositeSignal: signal.score,
        cvTechnical: conviction?.scores?.technical ?? null,
        cvFundamental: conviction?.scores?.fundamental ?? null,
        cvValuation: conviction?.scores?.valuation ?? null,
        cvSmartMoney: conviction?.scores?.smartMoney ?? null,
        cvCatalyst: conviction?.scores?.catalystSentiment ?? null,
        cvRisk: conviction?.scores?.riskAdjusted ?? null,
        cvDiversity: conviction?.scores?.signalDiversity ?? null,
        cvComposite: conviction?.compositeScore ?? null,
        dataConfidence: conviction?.dataConfidence ?? null,
        rsi: scan?.rsi ?? null,
        atr: scan?.atr ?? null,
        volumeRatio: scan?.volumeRatio ?? null,
        fearGreed: input.fearGreed ?? null,
        signalSource: input.signalSource,
        discoveryReason: input.discoveryReason ?? null,
        strategy: signal.strategy,
        sector: input.sector ?? null,
      },
    });
  } catch (e: any) {
    console.warn(`[Learning] saveTradeSnapshot failed (non-fatal): ${e.message}`);
  }
}

/* ── Phase 2: Strategy Ledger ──────────────────────────── */

function getWeekKey(d: Date): string {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface LedgerRow {
  dimension: string;
  pnl: number;
  holdDays: number;
}

export async function updateLedger(userId: string): Promise<{ upserted: number }> {
  const closed = await prisma.autoTrade.findMany({
    where: { userId, status: "CLOSED", pnl: { not: null } },
    include: { snapshot: true },
    orderBy: { exitAt: "desc" },
  });

  if (closed.length === 0) return { upserted: 0 };

  const buckets = new Map<string, { period: string; dimension: string; pnls: number[]; holdDays: number[] }>();

  function addRow(period: string, row: LedgerRow) {
    const key = `${period}::${row.dimension}`;
    let b = buckets.get(key);
    if (!b) { b = { period, dimension: row.dimension, pnls: [], holdDays: [] }; buckets.set(key, b); }
    b.pnls.push(row.pnl);
    b.holdDays.push(row.holdDays);
  }

  for (const trade of closed) {
    const pnl = trade.pnl!;
    const entryAt = trade.entryAt || trade.createdAt;
    const exitAt = trade.exitAt || new Date();
    const holdDays = Math.max(1, Math.floor((exitAt.getTime() - entryAt.getTime()) / 86400000));
    const snapshot = trade.snapshot;
    const strategy = trade.strategy || "UNKNOWN";
    const source = snapshot?.signalSource || "watchlist";
    const sector = snapshot?.sector || "Unknown";
    const cvComposite = snapshot?.cvComposite ?? trade.aiConfidence ?? 50;
    const cvBucket = cvComposite >= 70 ? "high" : cvComposite >= 40 ? "medium" : "low";

    const weekKey = getWeekKey(exitAt);
    const monthKey = getMonthKey(exitAt);

    const rows: LedgerRow[] = [
      { dimension: `strategy:${strategy}`, pnl, holdDays },
      { dimension: `source:${source}`, pnl, holdDays },
      { dimension: `sector:${sector}`, pnl, holdDays },
      { dimension: `conviction:${cvBucket}`, pnl, holdDays },
    ];

    for (const r of rows) {
      addRow("all-time", r);
      addRow(weekKey, r);
      addRow(monthKey, r);
    }
  }

  let upserted = 0;
  for (const b of buckets.values()) {
    const trades = b.pnls.length;
    const wins = b.pnls.filter((p) => p > 0).length;
    const totalPnl = b.pnls.reduce((s, p) => s + p, 0);
    const avgPnl = trades > 0 ? totalPnl / trades : 0;
    const winRate = trades > 0 ? (wins / trades) * 100 : 0;
    const avgHoldDays = trades > 0 ? b.holdDays.reduce((s, d) => s + d, 0) / trades : 0;

    await prisma.strategyLedger.upsert({
      where: { userId_period_dimension: { userId, period: b.period, dimension: b.dimension } },
      create: { userId, period: b.period, dimension: b.dimension, trades, wins, totalPnl: Math.round(totalPnl * 100) / 100, avgPnl: Math.round(avgPnl * 100) / 100, winRate: Math.round(winRate * 10) / 10, avgHoldDays: Math.round(avgHoldDays * 10) / 10 },
      update: { trades, wins, totalPnl: Math.round(totalPnl * 100) / 100, avgPnl: Math.round(avgPnl * 100) / 100, winRate: Math.round(winRate * 10) / 10, avgHoldDays: Math.round(avgHoldDays * 10) / 10 },
    });
    upserted++;
  }

  console.log(`[Learning] Ledger updated: ${upserted} buckets from ${closed.length} closed trades`);
  return { upserted };
}

/* ── Phase 3: Adaptive Weight Recalibration ────────────── */

export async function recalibrate(userId: string): Promise<{
  updated: boolean;
  reason: string;
  weights?: ConvictionWeights;
  version?: number;
  changes?: Record<string, { from: number; to: number }>;
}> {
  const closed = await prisma.autoTrade.findMany({
    where: { userId, status: "CLOSED", pnl: { not: null } },
    include: { snapshot: true },
    orderBy: { exitAt: "desc" },
    take: 200,
  });

  if (closed.length < MIN_TRADES_FOR_LEARNING) {
    return { updated: false, reason: `Need ${MIN_TRADES_FOR_LEARNING} closed trades, have ${closed.length}` };
  }

  const withSnapshots = closed.filter((t) => t.snapshot?.cvComposite != null);
  if (withSnapshots.length < MIN_TRADES_FOR_LEARNING) {
    return { updated: false, reason: `Need ${MIN_TRADES_FOR_LEARNING} trades with snapshots, have ${withSnapshots.length}` };
  }

  const existing = await prisma.learningWeights.findUnique({ where: { userId } });
  const currentWeights: ConvictionWeights = existing
    ? { ...DEFAULT_WEIGHTS, ...(existing.weights as Partial<ConvictionWeights>) }
    : { ...DEFAULT_WEIGHTS };

  const dims = Object.keys(DEFAULT_WEIGHTS) as (keyof ConvictionWeights)[];
  const dimCorrelations = new Map<keyof ConvictionWeights, number>();

  for (const dim of dims) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < withSnapshots.length; i++) {
      const trade = withSnapshots[i];
      const snap = trade.snapshot!;
      const pnl = trade.pnl!;
      const win = pnl > 0 ? 1 : 0;

      let dimScore: number | null = null;
      switch (dim) {
        case "technical": dimScore = snap.cvTechnical; break;
        case "fundamental": dimScore = snap.cvFundamental; break;
        case "valuation": dimScore = snap.cvValuation; break;
        case "smartMoney": dimScore = snap.cvSmartMoney; break;
        case "catalystSentiment": dimScore = snap.cvCatalyst; break;
        case "riskAdjusted": dimScore = snap.cvRisk; break;
        case "signalDiversity": dimScore = snap.cvDiversity; break;
      }

      if (dimScore == null) continue;

      const recency = Math.pow(1 - EMA_ALPHA, i);
      const normalized = dimScore / 100;
      const predictive = normalized * win + (1 - normalized) * (1 - win);
      weightedSum += predictive * recency;
      totalWeight += recency;
    }

    dimCorrelations.set(dim, totalWeight > 0 ? weightedSum / totalWeight : 0.5);
  }

  const totalCorr = Array.from(dimCorrelations.values()).reduce((s, v) => s + v, 0);
  if (totalCorr <= 0) {
    return { updated: false, reason: "Correlation sum is zero — insufficient signal" };
  }

  const newWeights = { ...currentWeights };
  const changes: Record<string, { from: number; to: number }> = {};

  for (const dim of dims) {
    const corr = dimCorrelations.get(dim)!;
    const idealWeight = corr / totalCorr;
    const current = currentWeights[dim];
    const maxDelta = current * MAX_CHANGE_PER_RECAL;
    const delta = Math.max(-maxDelta, Math.min(maxDelta, idealWeight - current));
    let proposed = current + delta;
    proposed = Math.max(WEIGHT_FLOOR, Math.min(WEIGHT_CEILING, proposed));
    if (Math.abs(proposed - current) > 0.001) {
      changes[dim] = { from: Math.round(current * 1000) / 1000, to: Math.round(proposed * 1000) / 1000 };
    }
    newWeights[dim] = proposed;
  }

  const sum = Object.values(newWeights).reduce((s, v) => s + v, 0);
  for (const dim of dims) {
    newWeights[dim] = Math.round((newWeights[dim] / sum) * 1000) / 1000;
  }

  const renormSum = Object.values(newWeights).reduce((s, v) => s + v, 0);
  const diff = 1 - renormSum;
  if (Math.abs(diff) > 0.001) newWeights.riskAdjusted += diff;

  if (Object.keys(changes).length === 0) {
    return { updated: false, reason: "Weights already optimal for current data" };
  }

  const version = (existing?.version || 0) + 1;
  await prisma.learningWeights.upsert({
    where: { userId },
    create: { userId, weights: newWeights as any, version },
    update: { weights: newWeights as any, version },
  });

  console.log(`[Learning] Recalibrated v${version} for ${userId}: ${JSON.stringify(changes)}`);
  return { updated: true, reason: `Updated ${Object.keys(changes).length} weights`, weights: newWeights, version, changes };
}

/* ── Weight Loading ────────────────────────────────────── */

export async function getLearnedWeights(userId: string): Promise<ConvictionWeights> {
  try {
    const learned = await prisma.learningWeights.findUnique({ where: { userId } });
    if (!learned) return { ...DEFAULT_WEIGHTS };
    const w = learned.weights as Partial<ConvictionWeights>;
    return {
      signalDiversity: w.signalDiversity ?? DEFAULT_WEIGHTS.signalDiversity,
      technical: w.technical ?? DEFAULT_WEIGHTS.technical,
      fundamental: w.fundamental ?? DEFAULT_WEIGHTS.fundamental,
      valuation: w.valuation ?? DEFAULT_WEIGHTS.valuation,
      smartMoney: w.smartMoney ?? DEFAULT_WEIGHTS.smartMoney,
      catalystSentiment: w.catalystSentiment ?? DEFAULT_WEIGHTS.catalystSentiment,
      riskAdjusted: w.riskAdjusted ?? DEFAULT_WEIGHTS.riskAdjusted,
    };
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

/* ── Phase 4: Self-Healing ─────────────────────────────── */

export {
  recordApiFailure,
  recordApiSuccess,
  isApiHealthy,
  getApiHealthSummary,
} from "@/lib/api/api-health";

export async function detectDrift(userId: string): Promise<{ drifting: boolean; alerts: string[] }> {
  const alerts: string[] = [];

  const ledger = await prisma.strategyLedger.findMany({
    where: { userId, period: "all-time" },
  });

  for (const row of ledger) {
    if (row.trades < 10) continue;

    if (row.dimension.startsWith("strategy:") && row.winRate < 25) {
      alerts.push(`${row.dimension} win rate dropped to ${row.winRate.toFixed(1)}% across ${row.trades} trades`);
    }

    if (row.dimension.startsWith("source:") && row.trades >= 15 && row.avgPnl < -5) {
      alerts.push(`${row.dimension} averaging -$${Math.abs(row.avgPnl).toFixed(2)} per trade across ${row.trades} trades`);
    }

    if (row.dimension.startsWith("conviction:low") && row.trades >= 10 && row.winRate < 30) {
      alerts.push(`Low-conviction trades winning only ${row.winRate.toFixed(1)}% — consider raising MIN_TRADE_CONVICTION`);
    }
  }

  if (alerts.length > 0) {
    console.warn(`[Learning/Drift] ${alerts.length} alerts for ${userId}: ${alerts.join("; ")}`);
  }

  return { drifting: alerts.length > 0, alerts };
}

/* ── Phase 4c: Search Click Learning ───────────────────── */

const searchClickCache = new Map<string, Map<string, number>>();
const CLICK_CACHE_TTL = 10 * 60 * 1000;
let clickCacheAt = 0;

export async function getSearchBoosts(userId: string, queryPrefix: string): Promise<Map<string, number>> {
  const now = Date.now();
  if (now - clickCacheAt > CLICK_CACHE_TTL) {
    searchClickCache.clear();
    clickCacheAt = now;
  }

  const cacheKey = `${userId}::${queryPrefix.toLowerCase()}`;
  const cached = searchClickCache.get(cacheKey);
  if (cached) return cached;

  try {
    const history = await prisma.searchHistory.findMany({
      where: { userId },
      select: { ticker: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const freq = new Map<string, number>();
    for (const h of history) {
      const t = h.ticker.toUpperCase();
      freq.set(t, (freq.get(t) || 0) + 1);
    }

    searchClickCache.set(cacheKey, freq);
    return freq;
  } catch {
    return new Map();
  }
}

/* ── Learning Stats for UI ─────────────────────────────── */

export interface LearningStats {
  totalClosedTrades: number;
  snapshotCoverage: number;
  currentWeights: ConvictionWeights;
  weightVersion: number;
  lastRecalibration: string | null;
  strategyPerformance: Array<{ strategy: string; trades: number; winRate: number; avgPnl: number; totalPnl: number }>;
  sourcePerformance: Array<{ source: string; trades: number; winRate: number; avgPnl: number }>;
  convictionPerformance: Array<{ bucket: string; trades: number; winRate: number; avgPnl: number }>;
  driftAlerts: string[];
}

export async function getLearningStats(userId: string): Promise<LearningStats> {
  const [closedCount, snapshotCount, learned, ledger, drift] = await Promise.all([
    prisma.autoTrade.count({ where: { userId, status: "CLOSED" } }),
    prisma.tradeSnapshot.count({ where: { autoTrade: { userId } } }),
    prisma.learningWeights.findUnique({ where: { userId } }),
    prisma.strategyLedger.findMany({ where: { userId, period: "all-time" } }),
    detectDrift(userId),
  ]);

  const weights: ConvictionWeights = learned
    ? { ...DEFAULT_WEIGHTS, ...(learned.weights as Partial<ConvictionWeights>) }
    : { ...DEFAULT_WEIGHTS };

  const strategyPerformance = ledger
    .filter((r) => r.dimension.startsWith("strategy:"))
    .map((r) => ({ strategy: r.dimension.replace("strategy:", ""), trades: r.trades, winRate: r.winRate, avgPnl: r.avgPnl, totalPnl: r.totalPnl }));

  const sourcePerformance = ledger
    .filter((r) => r.dimension.startsWith("source:"))
    .map((r) => ({ source: r.dimension.replace("source:", ""), trades: r.trades, winRate: r.winRate, avgPnl: r.avgPnl }));

  const convictionPerformance = ledger
    .filter((r) => r.dimension.startsWith("conviction:"))
    .map((r) => ({ bucket: r.dimension.replace("conviction:", ""), trades: r.trades, winRate: r.winRate, avgPnl: r.avgPnl }));

  return {
    totalClosedTrades: closedCount,
    snapshotCoverage: closedCount > 0 ? Math.round((snapshotCount / closedCount) * 100) : 0,
    currentWeights: weights,
    weightVersion: learned?.version || 0,
    lastRecalibration: learned?.updatedAt?.toISOString() || null,
    strategyPerformance,
    sourcePerformance,
    convictionPerformance,
    driftAlerts: drift.alerts,
  };
}
