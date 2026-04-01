import { prisma } from "@/lib/db";
import { scanMarket } from "./scanner";
import { rankSignals } from "./signals";
import { calculatePosition, isMarketHours } from "./risk";
import { executeEntry, checkExits, getPortfolioSummary } from "./executor";
import { getAIConvictions, getDailyBriefing } from "./ai-analyst";
import { sendTradeNotification, sendDailySummary } from "./notifications";
import { discoverOpportunities, type DiscoveredTicker } from "./discovery";

interface EngineResult {
  status: "OK" | "SKIPPED" | "ERROR";
  reason: string;
  scanned: number;
  signalsFound: number;
  tradesExecuted: number;
  exitsExecuted: number;
  details: any[];
  discovered?: DiscoveredTicker[];
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
}

export function getRiskProfile(profile: string): RiskProfileParams {
  switch (profile) {
    case "CONSERVATIVE":
      return {
        minScore: 25,
        minConfidence: 55,
        positionMultiplier: 0.6,
        riskRewardRatio: 3,
        atrMultiplier: 1.2,
        maxHoldDays: 15,
        maxPositionPct: 3,
        maxDailyLossPct: 1,
        maxOpenPositions: 3,
        weeklyTargetPct: 5,
      };
    case "AGGRESSIVE":
      return {
        minScore: 8,
        minConfidence: 25,
        positionMultiplier: 1.4,
        riskRewardRatio: 1.5,
        atrMultiplier: 2,
        maxHoldDays: 5,
        maxPositionPct: 10,
        maxDailyLossPct: 5,
        maxOpenPositions: 10,
        weeklyTargetPct: 20,
      };
    default: // MODERATE
      return {
        minScore: 15,
        minConfidence: 40,
        positionMultiplier: 1,
        riskRewardRatio: 2,
        atrMultiplier: 1.5,
        maxHoldDays: 10,
        maxPositionPct: 5,
        maxDailyLossPct: 3,
        maxOpenPositions: 5,
        weeklyTargetPct: 10,
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

async function getFullWatchlist(userId: string, configWatchlist: string[]): Promise<string[]> {
  const userWatchlist = await prisma.watchlistItem.findMany({
    where: { userId },
    select: { ticker: true },
  });
  const combined = new Set([...configWatchlist, ...userWatchlist.map((w) => w.ticker)]);
  return [...combined];
}

async function runPaperTradingCycle(userId: string, config: any, email: string | null, isPro: boolean): Promise<EngineResult> {
  try {
    console.log(`[Engine] Paper cycle for ${email || userId} | profile=${config.riskProfile || "MODERATE"} | isPro=${isPro} | watchlist=${config.watchlist?.length || 0} tickers`);
    const riskProfile = getRiskProfile(config.riskProfile || "MODERATE");

    const openTrades = await prisma.autoTrade.findMany({
      where: { userId, status: "OPEN" },
    });

    const openTickers = new Set(openTrades.map((t) => t.ticker));

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

    const fullWatchlist = await getFullWatchlist(userId, config.watchlist);

    let discovered: DiscoveredTicker[] = [];
    if (isPro) {
      try {
        discovered = await discoverOpportunities();
      } catch (e) {
        console.error("[Engine] Discovery failed (non-fatal):", e);
      }
    }
    const discoveredTickers = discovered
      .map((d) => d.ticker)
      .filter((t) => !fullWatchlist.includes(t));
    const allTickers = [...fullWatchlist, ...discoveredTickers.slice(0, 15)];
    console.log(`[Engine] Scanning ${allTickers.length} tickers (${fullWatchlist.length} watchlist + ${discoveredTickers.length} discovered)`);

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

    const details: any[] = [...exits];
    let tradesExecuted = 0;
    const maxNewTrades = Math.max(0, config.maxOpenPositions - currentOpen);

    for (const signal of rankedSignals.slice(0, maxNewTrades)) {
      if (openTickers.has(signal.ticker)) {
        details.push({
          ticker: signal.ticker,
          action: "SKIP",
          reason: `Already holding ${signal.ticker}`,
          score: signal.score,
        });
        continue;
      }

      if (signal.score < riskProfile.minScore || signal.confidence < riskProfile.minConfidence) {
        details.push({
          ticker: signal.ticker,
          action: "SKIP",
          reason: `Below ${config.riskProfile || "MODERATE"} threshold (score ${signal.score.toFixed(1)} < ${riskProfile.minScore}, conf ${signal.confidence}% < ${riskProfile.minConfidence}%)`,
          score: signal.score,
        });
        continue;
      }

      const position = calculatePosition(signal, {
        portfolioValue: currentEquity,
        maxPositionPct: config.maxPositionPct * riskProfile.positionMultiplier,
        maxDailyLossPct: config.maxDailyLossPct,
        maxOpenPositions: config.maxOpenPositions,
        currentOpenPositions: currentOpen + tradesExecuted,
        dayTradesUsed: 0,
        dailyPnl,
        isPaper: true,
      }, signal.confidence);

      if (position.rejected) {
        details.push({
          ticker: signal.ticker,
          action: "SKIP",
          reason: position.rejectReason,
          score: signal.score,
        });
        continue;
      }

      await prisma.autoTrade.create({
        data: {
          userId,
          ticker: signal.ticker,
          side: "BUY",
          qty: position.qty,
          entryPrice: signal.price,
          stopLoss: position.stopLoss,
          takeProfit: position.takeProfit,
          strategy: signal.strategy,
          aiConfidence: signal.confidence,
          signalScore: signal.score,
          status: "OPEN",
          mode: "PAPER",
          entryAt: new Date(),
        },
      });

      openTickers.add(signal.ticker);
      tradesExecuted++;
      details.push({
        ticker: signal.ticker,
        action: "BUY",
        qty: position.qty,
        price: signal.price,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
        strategy: signal.strategy,
        confidence: signal.confidence,
        score: signal.score,
      });

      if (email) {
        sendTradeNotification(email, {
          ticker: signal.ticker,
          action: "BUY",
          qty: position.qty,
          price: signal.price,
          reason: `${signal.strategy} signal (score: ${signal.score.toFixed(1)})`,
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

  const isPro = user.role === "ADMIN";

  if (config.mode === "PAPER") {
    return runPaperTradingCycle(userId, config, user.email, isPro);
  }

  if (!user.alpacaApiKey && !process.env.ALPACA_API_KEY) {
    return { status: "ERROR", reason: "Alpaca API keys not configured", scanned: 0, signalsFound: 0, tradesExecuted: 0, exitsExecuted: 0, details: [] };
  }

  const alpacaConfig = getAlpacaConfig(user);
  const riskProfile = getRiskProfile(config.riskProfile || "MODERATE");

  try {
    const exits = await checkExits(alpacaConfig, userId);
    for (const exit of exits) {
      sendTradeNotification(user.email, exit).catch(() => {});
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

    const fullWatchlist = await getFullWatchlist(userId, config.watchlist);

    let discovered: DiscoveredTicker[] = [];
    if (isPro) {
      try {
        discovered = await discoverOpportunities();
      } catch (e) {
        console.error("[Engine] Discovery failed (non-fatal):", e);
      }
    }
    const discoveredTickers = discovered
      .map((d) => d.ticker)
      .filter((t) => !fullWatchlist.includes(t));
    const allTickers = [...fullWatchlist, ...discoveredTickers.slice(0, 15)];

    const scanResults = await scanMarket(allTickers);
    const rankedSignals = rankSignals(scanResults);

    const openTrades = await prisma.autoTrade.findMany({
      where: { userId, status: "OPEN" },
      select: { ticker: true },
    });
    const openTickers = new Set(openTrades.map((t) => t.ticker));

    const discoveryContext = new Map<string, string>();
    for (const d of discovered) {
      discoveryContext.set(d.ticker, d.reason);
    }

    const aiConvictions = rankedSignals.length > 0
      ? await getAIConvictions(rankedSignals, discoveryContext)
      : new Map();

    const portfolio = await getPortfolioSummary(alpacaConfig, userId);

    const details: any[] = [...exits];
    let tradesExecuted = 0;
    const maxNewTrades = Math.max(0, config.maxOpenPositions - portfolio.openPositions);

    for (const signal of rankedSignals.slice(0, maxNewTrades)) {
      if (openTickers.has(signal.ticker)) {
        details.push({ ticker: signal.ticker, action: "SKIP", reason: `Already holding ${signal.ticker}` });
        continue;
      }

      if (signal.score < riskProfile.minScore || signal.confidence < riskProfile.minConfidence) {
        details.push({ ticker: signal.ticker, action: "SKIP", reason: `Below ${config.riskProfile || "MODERATE"} threshold` });
        continue;
      }

      const aiVerdict = aiConvictions.get(signal.ticker);
      const aiConfidence = aiVerdict?.conviction ? aiVerdict.conviction * 10 : 50;

      if (aiVerdict && aiVerdict.conviction < 4) {
        details.push({
          ticker: signal.ticker,
          action: "SKIP",
          reason: `AI conviction too low (${aiVerdict.conviction}/10): ${aiVerdict.reasoning}`,
        });
        continue;
      }

      const position = calculatePosition(signal, {
        portfolioValue: portfolio.equity,
        maxPositionPct: config.maxPositionPct * riskProfile.positionMultiplier,
        maxDailyLossPct: config.maxDailyLossPct,
        maxOpenPositions: config.maxOpenPositions,
        currentOpenPositions: portfolio.openPositions + tradesExecuted,
        dayTradesUsed: portfolio.dayTradesUsed,
        dailyPnl: portfolio.dailyPnl,
        isPaper: alpacaConfig.paper,
      }, aiConfidence);

      const result = await executeEntry(
        alpacaConfig,
        position,
        userId,
        signal.strategy,
        aiConfidence,
        signal.score
      );

      details.push(result);
      if (result.action === "BUY") {
        openTickers.add(signal.ticker);
        tradesExecuted++;
        sendTradeNotification(user.email, result).catch(() => {});
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
  const fullWatchlist = await getFullWatchlist(userId, config.watchlist);
  const scanResults = await scanMarket(fullWatchlist);
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

  const briefing = await getDailyBriefing(
    signals,
    equity,
    openTrades.map((t) => t.ticker)
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
