import { prisma } from "@/lib/db";
import { scanMarket, type ScanResult } from "./scanner";
import { rankSignals, type TradeSignal } from "./signals";
import { calculatePosition, isMarketHours } from "./risk";
import { executeEntry, checkExits, getPortfolioSummary } from "./executor";
import { getDailyBriefing } from "./ai-analyst";
import { sendTradeNotification, sendDailySummary } from "./notifications";
import { discoverOpportunities, getRawSignals, type DiscoveredTicker } from "./discovery";
import { scoreForTrading } from "./conviction";
import { getLearnedWeights, saveTradeSnapshot, updateLedger, type ConvictionWeights } from "./learning";

interface EngineResult {
  status: "OK" | "SKIPPED" | "ERROR";
  reason: string;
  scanned: number;
  signalsFound: number;
  tradesExecuted: number;
  exitsExecuted: number;
  details: any[];
  discovered?: DiscoveredTicker[];
  allSignals?: any[];
}

export interface RiskProfileParams {
  minScore: number;
  minConfidence: number;
  positionMultiplier: number;
  riskRewardRatio: number;
  atrMultiplier: number;
  maxHoldDays: number;
  maxPositionPct: number;
  maxDailyLossPct: number;
  maxOpenPositions: number;
  weeklyTargetPct: number;
  maxPositionsPerTicker: number;
  maxTickerExposurePct: number;
  addToWinnerMinGainPct: number;
  addToLoserMaxDropPct: number;
  addScoreMultiplier: number;
  addOnSizeMultiplier: number;
}

export function getRiskProfile(profile: string): RiskProfileParams {
  switch (profile) {
    case "CONSERVATIVE":
      return {
        minScore: 15,
        minConfidence: 45,
        positionMultiplier: 0.6,
        riskRewardRatio: 3,
        atrMultiplier: 1.2,
        maxHoldDays: 15,
        maxPositionPct: 3,
        maxDailyLossPct: 1,
        maxOpenPositions: 3,
        weeklyTargetPct: 5,
        maxPositionsPerTicker: 1,
        maxTickerExposurePct: 5,
        addToWinnerMinGainPct: 999,
        addToLoserMaxDropPct: 0,
        addScoreMultiplier: 999,
        addOnSizeMultiplier: 0,
      };
    case "AGGRESSIVE":
      return {
        minScore: 4,
        minConfidence: 15,
        positionMultiplier: 1.4,
        riskRewardRatio: 1.5,
        atrMultiplier: 2,
        maxHoldDays: 5,
        maxPositionPct: 10,
        maxDailyLossPct: 5,
        maxOpenPositions: 10,
        weeklyTargetPct: 20,
        maxPositionsPerTicker: 3,
        maxTickerExposurePct: 20,
        addToWinnerMinGainPct: 2,
        addToLoserMaxDropPct: 8,
        addScoreMultiplier: 1.0,
        addOnSizeMultiplier: 0.6,
      };
    default: // MODERATE
      return {
        minScore: 8,
        minConfidence: 30,
        positionMultiplier: 1,
        riskRewardRatio: 2,
        atrMultiplier: 1.5,
        maxHoldDays: 10,
        maxPositionPct: 5,
        maxDailyLossPct: 3,
        maxOpenPositions: 5,
        weeklyTargetPct: 10,
        maxPositionsPerTicker: 2,
        maxTickerExposurePct: 10,
        addToWinnerMinGainPct: 3,
        addToLoserMaxDropPct: 5,
        addScoreMultiplier: 1.3,
        addOnSizeMultiplier: 0.5,
      };
  }
}

function getAlpacaConfig(user: any) {
  return {
    apiKey: user.alpacaApiKey || process.env.ALPACA_API_KEY || "",
    secretKey: user.alpacaSecretKey || process.env.ALPACA_SECRET_KEY || "",
    paper: user.alpacaPaper !== false,
  };
}

interface MarketSentiment {
  score: number;
  rating: string;
  brief: string;
}

function getSentimentMultiplier(score: number): number {
  if (score <= 20) return 0.3;
  if (score <= 35) return 0.5;
  if (score <= 50) return 0.7;
  if (score <= 65) return 1.0;
  if (score <= 80) return 1.0;
  return 0.8;
}

async function fetchMarketSentiment(): Promise<MarketSentiment> {
  const defaultSentiment: MarketSentiment = { score: 50, rating: "Neutral", brief: "" };
  try {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/market/fear-greed`, { cache: "no-store" });
    if (!res.ok) return defaultSentiment;
    const data = await res.json();
    return {
      score: data.score ?? 50,
      rating: data.rating ?? "Neutral",
      brief: data.brief ?? "",
    };
  } catch {
    return defaultSentiment;
  }
}

interface WatchlistContext {
  all: string[];
  configSet: Set<string>;
  userSet: Set<string>;
}

async function getWatchlistContext(userId: string, configWatchlist: string[]): Promise<WatchlistContext> {
  const userWatchlist = await prisma.watchlistItem.findMany({
    where: { userId },
    select: { ticker: true },
  });
  const fromConfig = configWatchlist.map((t) => t.toUpperCase());
  const fromUser = userWatchlist.map((w) => w.ticker.toUpperCase());
  const combined = new Set([...fromConfig, ...fromUser]);
  return {
    all: [...combined],
    configSet: new Set(fromConfig),
    userSet: new Set(fromUser),
  };
}

function unionScanTickers(lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const t of list) {
      const u = t.toUpperCase();
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

function signalSource(
  ticker: string,
  discoveryMap: Map<string, string>,
  recommendedSet: Set<string>,
  ctx: WatchlistContext,
): "watchlist" | "discovered" | "recommended" {
  const u = ticker.toUpperCase();
  if (discoveryMap.has(u)) return "discovered";
  if (ctx.configSet.has(u) || ctx.userSet.has(u)) return "watchlist";
  if (recommendedSet.has(u)) return "recommended";
  return "watchlist";
}

async function runPaperTradingCycle(userId: string, config: any, email: string | null): Promise<EngineResult> {
  try {
    console.log(`[Engine] Paper cycle for ${email || userId} | profile=${config.riskProfile || "MODERATE"} | watchlist=${config.watchlist?.length || 0} tickers`);
    const riskProfile = getRiskProfile(config.riskProfile || "MODERATE");

    let learnedWeights: ConvictionWeights | undefined;
    try {
      learnedWeights = await getLearnedWeights(userId);
      console.log(`[Engine] Loaded learned weights v${learnedWeights ? "custom" : "default"}`);
    } catch { /* fall back to defaults */ }

    const openTrades = await prisma.autoTrade.findMany({
      where: { userId, status: "OPEN" },
    });

    const openTickers = new Set(openTrades.map((t) => t.ticker));

    interface HeldPosition { count: number; totalQty: number; totalCost: number; avgEntry: number; }
    const heldPositions = new Map<string, HeldPosition>();
    for (const t of openTrades) {
      const existing = heldPositions.get(t.ticker);
      const cost = (t.entryPrice || 0) * t.qty;
      if (existing) {
        existing.count++;
        existing.totalQty += t.qty;
        existing.totalCost += cost;
        existing.avgEntry = existing.totalCost / existing.totalQty;
      } else {
        heldPositions.set(t.ticker, { count: 1, totalQty: t.qty, totalCost: cost, avgEntry: t.entryPrice || 0 });
      }
    }

    const exits: any[] = [];
    for (const trade of openTrades) {
      try {
        const scanResult = await import("./scanner").then(m => m.scanStock(trade.ticker));
        if (!scanResult) continue;

        const currentPrice = scanResult.price;
        const entryAt = trade.entryAt || trade.createdAt;
        const holdingDays = Math.floor((Date.now() - new Date(entryAt).getTime()) / (1000 * 60 * 60 * 24));
        const { shouldExitPosition } = await import("./risk");
        const exitCheck = shouldExitPosition(
          currentPrice,
          trade.entryPrice || 0,
          trade.stopLoss || 0,
          trade.takeProfit || 0,
          holdingDays,
          riskProfile.maxHoldDays
        );

        if (exitCheck.exit) {
          const pnl = (currentPrice - (trade.entryPrice || 0)) * trade.qty;
          await prisma.autoTrade.update({
            where: { id: trade.id },
            data: {
              status: "CLOSED",
              exitPrice: currentPrice,
              exitAt: new Date(),
              exitReason: exitCheck.reason,
              pnl: Math.round(pnl * 100) / 100,
            },
          });
          openTickers.delete(trade.ticker);
          exits.push({
            ticker: trade.ticker,
            action: "SELL",
            reason: exitCheck.reason,
            pnl: Math.round(pnl * 100) / 100,
            price: currentPrice,
          });
        }
      } catch {}
    }

    if (exits.length > 0) {
      updateLedger(userId).catch((e) => console.warn("[Engine] updateLedger failed (non-fatal):", e));
    }

    const wlCtx = await getWatchlistContext(userId, config.watchlist);
    const recRawPaper: string[] = Array.isArray(config.recommendedTickers) ? config.recommendedTickers : [];
    const recommended = recRawPaper.map((t) => String(t).toUpperCase());
    const recommendedSet = new Set<string>(recommended);
    const alreadyInPool = new Set<string>([...wlCtx.all, ...recommended]);

    let discovered: DiscoveredTicker[] = [];
    try {
      discovered = await discoverOpportunities();
    } catch (e) {
      console.error("[Engine] Discovery failed (non-fatal):", e);
    }
    const discoveredTickers = discovered
      .map((d) => d.ticker)
      .filter((t) => !alreadyInPool.has(t.toUpperCase()));
    const allTickers = unionScanTickers([wlCtx.all, recommended, discoveredTickers.slice(0, 15)]);
    console.log(
      `[Engine] Scanning ${allTickers.length} tickers (${wlCtx.all.length} watchlist + ${recommended.length} recommended + ${discoveredTickers.length} discovered raw)`,
    );

    const scanResults = await scanMarket(allTickers);
    const rankedSignals = rankSignals(scanResults);
    console.log(`[Engine] Scan complete: ${scanResults.length} scanned → ${rankedSignals.length} actionable signals`);
    if (rankedSignals.length > 0) {
      console.log(`[Engine] Top signals: ${rankedSignals.slice(0, 5).map((s) => `${s.ticker}(${s.action},score=${s.score.toFixed(1)},strat=${s.strategy})`).join(" | ")}`);
    }

    const currentOpen = await prisma.autoTrade.count({ where: { userId, status: "OPEN" } });
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTrades = await prisma.autoTrade.findMany({
      where: { userId, status: "CLOSED", exitAt: { gte: todayStart } },
      select: { pnl: true },
    });
    const dailyPnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);

    const paperBalance = config.paperBalance || 10000;
    const totalPnl = (await prisma.autoTrade.findMany({
      where: { userId, status: "CLOSED" },
      select: { pnl: true },
    })).reduce((s, t) => s + (t.pnl || 0), 0);
    const currentEquity = paperBalance + totalPnl;

    const discoveryMap = new Map<string, string>();
    for (const d of discovered) {
      discoveryMap.set(d.ticker.toUpperCase(), `${d.source}: ${d.reason}`);
    }

    // 7-dimension conviction scoring for top candidates
    let bundle;
    try {
      bundle = await getRawSignals();
    } catch (e) {
      console.warn("[Engine] getRawSignals failed (non-fatal):", e);
    }

    const topCandidateTickers = rankedSignals.slice(0, 15).map((s) => s.ticker);
    const scanLookup = new Map<string, ScanResult>();
    for (const sr of scanResults) scanLookup.set(sr.ticker, sr);
    const signalLookup = new Map<string, TradeSignal>();
    for (const s of rankedSignals) signalLookup.set(s.ticker, s);

    let convictionScores = new Map<string, { compositeScore: number; dataConfidence: number; scores: Record<string, number> }>();
    if (bundle && topCandidateTickers.length > 0) {
      try {
        convictionScores = await scoreForTrading(topCandidateTickers, scanLookup, signalLookup, bundle, discovered, learnedWeights);
        console.log(`[Engine] Conviction scores: ${[...convictionScores.entries()].map(([t, c]) => `${t}=${c.compositeScore}`).join(", ")}`);
      } catch (e) {
        console.warn("[Engine] scoreForTrading failed (non-fatal):", e);
      }
    }

    const signalMap = new Map<string, any>();
    for (const s of rankedSignals) {
      const cv = convictionScores.get(s.ticker);
      const src = signalSource(s.ticker, discoveryMap, recommendedSet, wlCtx);
      signalMap.set(s.ticker, {
        ticker: s.ticker,
        action: s.action,
        score: s.score,
        confidence: s.confidence,
        convictionScore: cv?.compositeScore ?? null,
        strategy: s.strategy,
        price: s.price,
        stopLoss: s.stopLoss,
        takeProfit: s.takeProfit,
        indicators: s.signals.map((ind) => ({
          name: ind.name,
          score: ind.score,
          reason: ind.reason,
        })),
        source: src,
        discoveryReason: discoveryMap.get(s.ticker.toUpperCase()) || null,
        decision: "NOT_EVALUATED" as string,
        decisionReason: "Beyond max new trades limit" as string | null,
      });
    }

    const sentiment = await fetchMarketSentiment();
    const sentimentMultiplier = getSentimentMultiplier(sentiment.score);
    const effectiveMinScore = riskProfile.minScore + (sentiment.score < 35 ? 5 : 0);

    const MIN_TRADE_CONVICTION = 20;
    const details: any[] = [...exits];
    let tradesExecuted = 0;
    const rawMaxNew = Math.max(0, config.maxOpenPositions - currentOpen);
    const maxNewTrades = Math.max(1, Math.floor(rawMaxNew * sentimentMultiplier));

    details.unshift({
      ticker: "MARKET",
      action: "SENTIMENT",
      reason: `Market sentiment: ${sentiment.rating} (${sentiment.score}/100). Trade capacity adjusted to ${maxNewTrades}/${rawMaxNew} (${(sentimentMultiplier * 100).toFixed(0)}%).${sentiment.brief ? " " + sentiment.brief : ""}`,
      score: sentiment.score,
    });

    for (const signal of rankedSignals.slice(0, maxNewTrades + riskProfile.maxPositionsPerTicker)) {
      let isAddOn = false;
      const held = heldPositions.get(signal.ticker);

      if (held) {
        if (riskProfile.maxPositionsPerTicker <= 1) {
          const skipReason = `Already holding ${signal.ticker} (${config.riskProfile || "MODERATE"} doesn't allow adding)`;
          details.push({ ticker: signal.ticker, action: "SKIP", reason: skipReason, score: signal.score });
          const sm = signalMap.get(signal.ticker);
          if (sm) { sm.decision = "SKIPPED"; sm.decisionReason = skipReason; }
          continue;
        }

        if (held.count >= riskProfile.maxPositionsPerTicker) {
          const skipReason = `Max positions per ticker reached (${held.count}/${riskProfile.maxPositionsPerTicker})`;
          details.push({ ticker: signal.ticker, action: "SKIP", reason: skipReason, score: signal.score });
          const sm = signalMap.get(signal.ticker);
          if (sm) { sm.decision = "SKIPPED"; sm.decisionReason = skipReason; }
          continue;
        }

        const currentExposurePct = (held.totalCost / currentEquity) * 100;
        if (currentExposurePct >= riskProfile.maxTickerExposurePct) {
          const skipReason = `Ticker exposure ${currentExposurePct.toFixed(1)}% exceeds ${riskProfile.maxTickerExposurePct}% limit`;
          details.push({ ticker: signal.ticker, action: "SKIP", reason: skipReason, score: signal.score });
          const sm = signalMap.get(signal.ticker);
          if (sm) { sm.decision = "SKIPPED"; sm.decisionReason = skipReason; }
          continue;
        }

        const gainPct = ((signal.price - held.avgEntry) / held.avgEntry) * 100;
        const isWinner = gainPct >= riskProfile.addToWinnerMinGainPct;
        const isLoserDip = gainPct <= -riskProfile.addToLoserMaxDropPct && (signal.action === "BUY" || signal.action === "STRONG_BUY");

        if (!isWinner && !isLoserDip) {
          const skipReason = `Already holding (${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}% P&L) — need ≥+${riskProfile.addToWinnerMinGainPct}% to add or ≥-${riskProfile.addToLoserMaxDropPct}% dip with BUY signal`;
          details.push({ ticker: signal.ticker, action: "SKIP", reason: skipReason, score: signal.score });
          const sm = signalMap.get(signal.ticker);
          if (sm) { sm.decision = "SKIPPED"; sm.decisionReason = skipReason; }
          continue;
        }

        const minScoreForAdd = riskProfile.minScore * riskProfile.addScoreMultiplier;
        if (signal.score < minScoreForAdd) {
          const skipReason = `Signal too weak to add (score ${signal.score.toFixed(1)} < ${minScoreForAdd.toFixed(0)} required for add-on)`;
          details.push({ ticker: signal.ticker, action: "SKIP", reason: skipReason, score: signal.score });
          const sm = signalMap.get(signal.ticker);
          if (sm) { sm.decision = "SKIPPED"; sm.decisionReason = skipReason; }
          continue;
        }

        isAddOn = true;
        console.log(`[Engine] ADD-ON eligible: ${signal.ticker} | held ${held.count}x, avg $${held.avgEntry.toFixed(2)}, P&L ${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}% | ${isWinner ? "pyramiding winner" : "averaging dip"}`);
      }

      if (signal.score < effectiveMinScore || signal.confidence < riskProfile.minConfidence) {
        const skipReason = `Below ${config.riskProfile || "MODERATE"} threshold (score ${signal.score.toFixed(1)} < ${effectiveMinScore}, conf ${signal.confidence}% < ${riskProfile.minConfidence}%)`;
        details.push({ ticker: signal.ticker, action: "SKIP", reason: skipReason, score: signal.score });
        const sm = signalMap.get(signal.ticker);
        if (sm) { sm.decision = "SKIPPED"; sm.decisionReason = skipReason; }
        continue;
      }

      const cv = convictionScores.get(signal.ticker);
      const convictionScore = cv?.compositeScore ?? 50;

      if (cv && convictionScore < MIN_TRADE_CONVICTION) {
        const skipReason = `Conviction too low (${convictionScore}/100, need ≥${MIN_TRADE_CONVICTION})`;
        details.push({ ticker: signal.ticker, action: "SKIP", reason: skipReason, score: signal.score });
        const sm = signalMap.get(signal.ticker);
        if (sm) { sm.decision = "SKIPPED"; sm.decisionReason = skipReason; }
        continue;
      }

      const positionPctMultiplier = isAddOn ? riskProfile.addOnSizeMultiplier : 1;
      const position = calculatePosition(signal, {
        portfolioValue: currentEquity,
        maxPositionPct: config.maxPositionPct * riskProfile.positionMultiplier * positionPctMultiplier,
        maxDailyLossPct: config.maxDailyLossPct,
        maxOpenPositions: config.maxOpenPositions + (isAddOn ? riskProfile.maxPositionsPerTicker : 0),
        currentOpenPositions: currentOpen + tradesExecuted,
        dayTradesUsed: 0,
        dailyPnl,
        isPaper: true,
      }, convictionScore);

      if (position.rejected) {
        const skipReason = position.rejectReason;
        details.push({ ticker: signal.ticker, action: "SKIP", reason: skipReason, score: signal.score });
        const sm = signalMap.get(signal.ticker);
        if (sm) { sm.decision = "SKIPPED"; sm.decisionReason = skipReason || "Position sizing rejected"; }
        continue;
      }

      const createdTrade = await prisma.autoTrade.create({
        data: {
          userId,
          ticker: signal.ticker,
          side: "BUY",
          qty: position.qty,
          entryPrice: signal.price,
          stopLoss: position.stopLoss,
          takeProfit: position.takeProfit,
          strategy: signal.strategy,
          aiConfidence: convictionScore,
          signalScore: signal.score,
          status: "OPEN",
          mode: "PAPER",
          entryAt: new Date(),
        },
      });

      saveTradeSnapshot({
        autoTradeId: createdTrade.id,
        signal,
        scan: scanLookup.get(signal.ticker),
        conviction: cv ?? undefined,
        signalSource: signalSource(signal.ticker, discoveryMap, recommendedSet, wlCtx),
        discoveryReason: discoveryMap.get(signal.ticker.toUpperCase()) || null,
        fearGreed: sentiment?.score,
        sector: cv?.scores ? undefined : undefined,
      }).catch(() => {});

      if (held) {
        held.count++;
        held.totalQty += position.qty;
        held.totalCost += position.qty * signal.price;
        held.avgEntry = held.totalCost / held.totalQty;
      } else {
        heldPositions.set(signal.ticker, { count: 1, totalQty: position.qty, totalCost: position.qty * signal.price, avgEntry: signal.price });
      }
      openTickers.add(signal.ticker);
      tradesExecuted++;

      const actionLabel = isAddOn ? "ADD_ON" : "BUY";
      details.push({
        ticker: signal.ticker,
        action: actionLabel,
        qty: position.qty,
        price: signal.price,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
        strategy: signal.strategy,
        confidence: convictionScore,
        score: signal.score,
      });

      const smTraded = signalMap.get(signal.ticker);
      if (smTraded) {
        smTraded.decision = isAddOn ? "ADD_ON" : "TRADED";
        smTraded.decisionReason = isAddOn
          ? `Added ${position.qty} shares (now ${held ? held.totalQty : position.qty} total)`
          : `Bought ${position.qty} shares @ conviction ${convictionScore}/100`;
      }

      if (email) {
        sendTradeNotification(email, {
          ticker: signal.ticker,
          action: actionLabel,
          qty: position.qty,
          price: signal.price,
          reason: `${isAddOn ? "Add-on: " : ""}${signal.strategy} (conviction: ${convictionScore}/100, score: ${signal.score.toFixed(1)})`,
        }).catch(() => {});
      }
    }

    return {
      status: "OK",
      reason: `Paper cycle: scanned ${scanResults.length} stocks (${discoveredTickers.length} discovered), ${rankedSignals.length} signals, ${tradesExecuted} trades, ${exits.length} exits`,
      scanned: scanResults.length,
      signalsFound: rankedSignals.length,
      tradesExecuted,
      exitsExecuted: exits.length,
      details,
      discovered: discovered.length > 0 ? discovered : undefined,
      allSignals: [...signalMap.values()],
    };
  } catch (e: any) {
    console.error("[Engine] Paper trading cycle failed:", e);
    return {
      status: "ERROR",
      reason: e.message,
      scanned: 0,
      signalsFound: 0,
      tradesExecuted: 0,
      exitsExecuted: 0,
      details: [],
    };
  }
}

export async function runTradingCycle(userId: string): Promise<EngineResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tradingConfig: true },
  });

  if (!user) {
    return { status: "ERROR", reason: "User not found", scanned: 0, signalsFound: 0, tradesExecuted: 0, exitsExecuted: 0, details: [] };
  }

  const config = user.tradingConfig;
  if (!config || !config.enabled) {
    return { status: "SKIPPED", reason: "Auto-trading not enabled", scanned: 0, signalsFound: 0, tradesExecuted: 0, exitsExecuted: 0, details: [] };
  }

  if (config.mode === "PAPER") {
    return runPaperTradingCycle(userId, config, user.email);
  }

  if (!user.alpacaApiKey && !process.env.ALPACA_API_KEY) {
    return { status: "ERROR", reason: "Alpaca API keys not configured", scanned: 0, signalsFound: 0, tradesExecuted: 0, exitsExecuted: 0, details: [] };
  }

  const alpacaConfig = getAlpacaConfig(user);
  const riskProfile = getRiskProfile(config.riskProfile || "MODERATE");

  let learnedWeightsLive: ConvictionWeights | undefined;
  try {
    learnedWeightsLive = await getLearnedWeights(userId);
  } catch { /* fall back to defaults */ }

  try {
    const exits = await checkExits(alpacaConfig, userId);
    for (const exit of exits) {
      sendTradeNotification(user.email, exit).catch(() => {});
    }

    if (exits.length > 0) {
      updateLedger(userId).catch((e) => console.warn("[Engine] updateLedger failed (non-fatal):", e));
    }

    const marketOpen = isMarketHours();
    if (!marketOpen && !alpacaConfig.paper) {
      return {
        status: "OK",
        reason: "Market closed — checked exits only",
        scanned: 0,
        signalsFound: 0,
        tradesExecuted: 0,
        exitsExecuted: exits.length,
        details: exits,
      };
    }

    const wlCtxLive = await getWatchlistContext(userId, config.watchlist);
    const recRawLive: string[] = Array.isArray(config.recommendedTickers) ? config.recommendedTickers : [];
    const recommendedLive = recRawLive.map((t) => String(t).toUpperCase());
    const recommendedSetLive = new Set<string>(recommendedLive);
    const alreadyInPoolLive = new Set<string>([...wlCtxLive.all, ...recommendedLive]);

    let discovered: DiscoveredTicker[] = [];
    try {
      discovered = await discoverOpportunities();
    } catch (e) {
      console.error("[Engine] Discovery failed (non-fatal):", e);
    }
    const discoveredTickers = discovered
      .map((d) => d.ticker)
      .filter((t) => !alreadyInPoolLive.has(t.toUpperCase()));
    const allTickers = unionScanTickers([wlCtxLive.all, recommendedLive, discoveredTickers.slice(0, 15)]);

    const scanResults = await scanMarket(allTickers);
    const rankedSignals = rankSignals(scanResults);

    const openTradesLive = await prisma.autoTrade.findMany({
      where: { userId, status: "OPEN" },
      select: { ticker: true, entryPrice: true, qty: true },
    });
    const openTickers = new Set(openTradesLive.map((t) => t.ticker));

    const heldPositionsLive = new Map<string, { count: number; totalQty: number; totalCost: number; avgEntry: number }>();
    for (const t of openTradesLive) {
      const cost = (t.entryPrice || 0) * t.qty;
      const existing = heldPositionsLive.get(t.ticker);
      if (existing) {
        existing.count++;
        existing.totalQty += t.qty;
        existing.totalCost += cost;
        existing.avgEntry = existing.totalCost / existing.totalQty;
      } else {
        heldPositionsLive.set(t.ticker, { count: 1, totalQty: t.qty, totalCost: cost, avgEntry: t.entryPrice || 0 });
      }
    }

    const discoveryMap = new Map<string, string>();
    for (const d of discovered) {
      discoveryMap.set(d.ticker.toUpperCase(), `${d.source}: ${d.reason}`);
    }

    // 7-dimension conviction scoring (replaces AI conviction LLM call)
    let bundleLive;
    try {
      bundleLive = await getRawSignals();
    } catch (e) {
      console.warn("[Engine] getRawSignals failed (non-fatal):", e);
    }

    const topCandidateTickersLive = rankedSignals.slice(0, 15).map((s) => s.ticker);
    const scanLookupLive = new Map<string, ScanResult>();
    for (const sr of scanResults) scanLookupLive.set(sr.ticker, sr);
    const signalLookupLive = new Map<string, TradeSignal>();
    for (const s of rankedSignals) signalLookupLive.set(s.ticker, s);

    let convictionScoresLive = new Map<string, { compositeScore: number; dataConfidence: number; scores: Record<string, number> }>();
    if (bundleLive && topCandidateTickersLive.length > 0) {
      try {
        convictionScoresLive = await scoreForTrading(topCandidateTickersLive, scanLookupLive, signalLookupLive, bundleLive, discovered, learnedWeightsLive);
        console.log(`[Engine] Live conviction scores: ${[...convictionScoresLive.entries()].map(([t, c]) => `${t}=${c.compositeScore}`).join(", ")}`);
      } catch (e) {
        console.warn("[Engine] scoreForTrading failed (non-fatal):", e);
      }
    }

    const portfolio = await getPortfolioSummary(alpacaConfig, userId);

    const signalMapLive = new Map<string, any>();
    for (const s of rankedSignals) {
      const cv = convictionScoresLive.get(s.ticker);
      const srcLive = signalSource(s.ticker, discoveryMap, recommendedSetLive, wlCtxLive);
      signalMapLive.set(s.ticker, {
        ticker: s.ticker,
        action: s.action,
        score: s.score,
        confidence: s.confidence,
        convictionScore: cv?.compositeScore ?? null,
        strategy: s.strategy,
        price: s.price,
        stopLoss: s.stopLoss,
        takeProfit: s.takeProfit,
        indicators: s.signals.map((ind) => ({
          name: ind.name,
          score: ind.score,
          reason: ind.reason,
        })),
        source: srcLive,
        discoveryReason: discoveryMap.get(s.ticker.toUpperCase()) || null,
        decision: "NOT_EVALUATED" as string,
        decisionReason: "Beyond max new trades limit" as string | null,
      });
    }

    const sentimentLive = await fetchMarketSentiment();
    const sentimentMultiplierLive = getSentimentMultiplier(sentimentLive.score);
    const effectiveMinScoreLive = riskProfile.minScore + (sentimentLive.score < 35 ? 5 : 0);

    const MIN_TRADE_CONVICTION_LIVE = 20;
    const details: any[] = [...exits];
    let tradesExecuted = 0;
    const rawMaxNewLive = Math.max(0, config.maxOpenPositions - portfolio.openPositions);
    const maxNewTrades = Math.max(1, Math.floor(rawMaxNewLive * sentimentMultiplierLive));

    details.unshift({
      ticker: "MARKET",
      action: "SENTIMENT",
      reason: `Market sentiment: ${sentimentLive.rating} (${sentimentLive.score}/100). Trade capacity adjusted to ${maxNewTrades}/${rawMaxNewLive} (${(sentimentMultiplierLive * 100).toFixed(0)}%).${sentimentLive.brief ? " " + sentimentLive.brief : ""}`,
      score: sentimentLive.score,
    });

    for (const signal of rankedSignals.slice(0, maxNewTrades + riskProfile.maxPositionsPerTicker)) {
      let isAddOn = false;
      const held = heldPositionsLive.get(signal.ticker);

      if (held) {
        if (riskProfile.maxPositionsPerTicker <= 1) {
          const skipR = `Already holding ${signal.ticker} (${config.riskProfile || "MODERATE"} doesn't allow adding)`;
          details.push({ ticker: signal.ticker, action: "SKIP", reason: skipR });
          const sm = signalMapLive.get(signal.ticker);
          if (sm) { sm.decision = "SKIPPED"; sm.decisionReason = skipR; }
          continue;
        }
        if (held.count >= riskProfile.maxPositionsPerTicker) {
          const skipR = `Max positions per ticker reached (${held.count}/${riskProfile.maxPositionsPerTicker})`;
          details.push({ ticker: signal.ticker, action: "SKIP", reason: skipR });
          const sm = signalMapLive.get(signal.ticker);
          if (sm) { sm.decision = "SKIPPED"; sm.decisionReason = skipR; }
          continue;
        }
        const currentExposurePct = (held.totalCost / portfolio.equity) * 100;
        if (currentExposurePct >= riskProfile.maxTickerExposurePct) {
          const skipR = `Ticker exposure ${currentExposurePct.toFixed(1)}% exceeds ${riskProfile.maxTickerExposurePct}% limit`;
          details.push({ ticker: signal.ticker, action: "SKIP", reason: skipR });
          const sm = signalMapLive.get(signal.ticker);
          if (sm) { sm.decision = "SKIPPED"; sm.decisionReason = skipR; }
          continue;
        }
        const gainPct = ((signal.price - held.avgEntry) / held.avgEntry) * 100;
        const isWinner = gainPct >= riskProfile.addToWinnerMinGainPct;
        const isLoserDip = gainPct <= -riskProfile.addToLoserMaxDropPct && (signal.action === "BUY" || signal.action === "STRONG_BUY");
        if (!isWinner && !isLoserDip) {
          const skipR = `Already holding (${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}% P&L) — need ≥+${riskProfile.addToWinnerMinGainPct}% to add or ≥-${riskProfile.addToLoserMaxDropPct}% dip with BUY signal`;
          details.push({ ticker: signal.ticker, action: "SKIP", reason: skipR });
          const sm = signalMapLive.get(signal.ticker);
          if (sm) { sm.decision = "SKIPPED"; sm.decisionReason = skipR; }
          continue;
        }
        const minScoreForAdd = riskProfile.minScore * riskProfile.addScoreMultiplier;
        if (signal.score < minScoreForAdd) {
          const skipR = `Signal too weak to add (score ${signal.score.toFixed(1)} < ${minScoreForAdd.toFixed(0)} required for add-on)`;
          details.push({ ticker: signal.ticker, action: "SKIP", reason: skipR });
          const sm = signalMapLive.get(signal.ticker);
          if (sm) { sm.decision = "SKIPPED"; sm.decisionReason = skipR; }
          continue;
        }
        isAddOn = true;
      }

      if (signal.score < effectiveMinScoreLive || signal.confidence < riskProfile.minConfidence) {
        const skipR = `Below ${config.riskProfile || "MODERATE"} threshold (score ${signal.score.toFixed(1)} < ${effectiveMinScoreLive}, conf ${signal.confidence}% < ${riskProfile.minConfidence}%)`;
        details.push({ ticker: signal.ticker, action: "SKIP", reason: skipR });
        const sm = signalMapLive.get(signal.ticker);
        if (sm) { sm.decision = "SKIPPED"; sm.decisionReason = skipR; }
        continue;
      }

      const cvLive = convictionScoresLive.get(signal.ticker);
      const convictionScore = cvLive?.compositeScore ?? 50;

      if (cvLive && convictionScore < MIN_TRADE_CONVICTION_LIVE) {
        const skipR = `Conviction too low (${convictionScore}/100, need ≥${MIN_TRADE_CONVICTION_LIVE})`;
        details.push({ ticker: signal.ticker, action: "SKIP", reason: skipR });
        const sm = signalMapLive.get(signal.ticker);
        if (sm) { sm.decision = "SKIPPED"; sm.decisionReason = skipR; }
        continue;
      }

      const positionPctMultiplier = isAddOn ? riskProfile.addOnSizeMultiplier : 1;
      const position = calculatePosition(signal, {
        portfolioValue: portfolio.equity,
        maxPositionPct: config.maxPositionPct * riskProfile.positionMultiplier * positionPctMultiplier,
        maxDailyLossPct: config.maxDailyLossPct,
        maxOpenPositions: config.maxOpenPositions + (isAddOn ? riskProfile.maxPositionsPerTicker : 0),
        currentOpenPositions: portfolio.openPositions + tradesExecuted,
        dayTradesUsed: portfolio.dayTradesUsed,
        dailyPnl: portfolio.dailyPnl,
        isPaper: alpacaConfig.paper,
      }, convictionScore);

      const result = await executeEntry(
        alpacaConfig,
        position,
        userId,
        signal.strategy,
        convictionScore,
        signal.score
      );

      const actionLabel = isAddOn ? "ADD_ON" : result.action;
      details.push({ ...result, action: actionLabel });
      if (result.action === "BUY") {
        if (held) {
          held.count++;
          held.totalQty += result.qty || position.qty;
          held.totalCost += (result.qty || position.qty) * signal.price;
          held.avgEntry = held.totalCost / held.totalQty;
        } else {
          heldPositionsLive.set(signal.ticker, { count: 1, totalQty: result.qty || position.qty, totalCost: (result.qty || position.qty) * signal.price, avgEntry: signal.price });
        }
        openTickers.add(signal.ticker);
        tradesExecuted++;
        sendTradeNotification(user.email, { ...result, action: actionLabel }).catch(() => {});

        const recentTrade = await prisma.autoTrade.findFirst({
          where: { userId, ticker: signal.ticker, status: { in: ["OPEN", "PENDING"] } },
          orderBy: { createdAt: "desc" },
        });
        if (recentTrade) {
          saveTradeSnapshot({
            autoTradeId: recentTrade.id,
            signal,
            scan: scanLookupLive.get(signal.ticker),
            conviction: cvLive ?? undefined,
            signalSource: signalSource(signal.ticker, discoveryMap, recommendedSetLive, wlCtxLive),
            discoveryReason: discoveryMap.get(signal.ticker.toUpperCase()) || null,
            fearGreed: sentimentLive?.score,
          }).catch(() => {});
        }

        const sm = signalMapLive.get(signal.ticker);
        if (sm) {
          sm.decision = isAddOn ? "ADD_ON" : "TRADED";
          sm.decisionReason = isAddOn
            ? `Added ${result.qty || position.qty} shares (now ${held ? held.totalQty : position.qty} total)`
            : `Bought ${result.qty || position.qty} shares @ conviction ${convictionScore}/100`;
        }
      }
    }

    return {
      status: "OK",
      reason: `Cycle complete: ${tradesExecuted} entries, ${exits.length} exits (${discoveredTickers.length} discovered)`,
      scanned: scanResults.length,
      signalsFound: rankedSignals.length,
      tradesExecuted,
      exitsExecuted: exits.length,
      details,
      discovered: discovered.length > 0 ? discovered : undefined,
      allSignals: [...signalMapLive.values()],
    };
  } catch (e: any) {
    console.error("[Engine] Trading cycle failed:", e);
    return {
      status: "ERROR",
      reason: e.message,
      scanned: 0,
      signalsFound: 0,
      tradesExecuted: 0,
      exitsExecuted: 0,
      details: [],
    };
  }
}

export async function runDailyBriefing(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tradingConfig: true },
  });

  if (!user || !user.tradingConfig?.enabled) return "Not enabled";

  const config = user.tradingConfig;
  const wlBrief = await getWatchlistContext(userId, config.watchlist);
  const recBrief = (config.recommendedTickers || []).map((t) => t.toUpperCase());
  const scanPoolBrief = unionScanTickers([wlBrief.all, recBrief]);
  const scanResults = await scanMarket(scanPoolBrief);
  const signals = rankSignals(scanResults);

  let equity = config.paperBalance || 10000;
  if (config.mode !== "PAPER") {
    const alpacaConfig = getAlpacaConfig(user);
    const portfolio = await getPortfolioSummary(alpacaConfig, userId);
    equity = portfolio.equity;
  } else {
    const totalPnl = (await prisma.autoTrade.findMany({
      where: { userId, status: "CLOSED" },
      select: { pnl: true },
    })).reduce((s, t) => s + (t.pnl || 0), 0);
    equity = (config.paperBalance || 10000) + totalPnl;
  }

  const openTrades = await prisma.autoTrade.findMany({
    where: { userId, status: "OPEN" },
    select: { ticker: true },
  });

  const sentiment = await fetchMarketSentiment();

  const briefing = await getDailyBriefing(
    signals,
    equity,
    openTrades.map((t) => t.ticker),
    { score: sentiment.score, rating: sentiment.rating, brief: sentiment.brief },
  );

  return briefing;
}

export async function runDailySummary(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tradingConfig: true },
  });

  if (!user || !user.tradingConfig?.enabled) return;

  const config = user.tradingConfig;
  let equity = config.paperBalance || 10000;

  if (config.mode !== "PAPER") {
    const alpacaConfig = getAlpacaConfig(user);
    const portfolio = await getPortfolioSummary(alpacaConfig, userId);
    equity = portfolio.equity;
  } else {
    const totalPnl = (await prisma.autoTrade.findMany({
      where: { userId, status: "CLOSED" },
      select: { pnl: true },
    })).reduce((s, t) => s + (t.pnl || 0), 0);
    equity = (config.paperBalance || 10000) + totalPnl;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayTrades = await prisma.autoTrade.findMany({
    where: { userId, createdAt: { gte: todayStart } },
    orderBy: { createdAt: "desc" },
  });

  const todayPnl = todayTrades
    .filter(t => t.status === "CLOSED")
    .reduce((s, t) => s + (t.pnl || 0), 0);

  const openTrades = await prisma.autoTrade.findMany({
    where: { userId, status: "OPEN" },
  });

  await sendDailySummary(user.email, {
    equity,
    dailyPnl: todayPnl,
    todayTrades,
    openPositions: openTrades,
  });
}
