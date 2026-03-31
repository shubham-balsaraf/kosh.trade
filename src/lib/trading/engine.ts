import { prisma } from "@/lib/db";
import { scanMarket } from "./scanner";
import { rankSignals } from "./signals";
import { calculatePosition, isMarketHours } from "./risk";
import { executeEntry, checkExits, getPortfolioSummary } from "./executor";
import { getAIConvictions, getDailyBriefing } from "./ai-analyst";
import { sendTradeNotification, sendDailySummary } from "./notifications";

interface EngineResult {
  status: "OK" | "SKIPPED" | "ERROR";
  reason: string;
  scanned: number;
  signalsFound: number;
  tradesExecuted: number;
  exitsExecuted: number;
  details: any[];
}

function getAlpacaConfig(user: any) {
  return {
    apiKey: user.alpacaApiKey || process.env.ALPACA_API_KEY || "",
    secretKey: user.alpacaSecretKey || process.env.ALPACA_SECRET_KEY || "",
    paper: user.alpacaPaper !== false,
  };
}

async function runPaperTradingCycle(userId: string, config: any, email: string | null): Promise<EngineResult> {
  try {
    const openTrades = await prisma.autoTrade.findMany({
      where: { userId, status: "OPEN" },
    });

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
          holdingDays
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

    const scanResults = await scanMarket(config.watchlist);
    const rankedSignals = rankSignals(scanResults);

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
      const position = calculatePosition(signal, {
        portfolioValue: currentEquity,
        maxPositionPct: config.maxPositionPct,
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
          entryAt: new Date(),
        },
      });

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
      reason: `Paper cycle: scanned ${scanResults.length} stocks, ${rankedSignals.length} signals, ${tradesExecuted} trades, ${exits.length} exits`,
      scanned: scanResults.length,
      signalsFound: rankedSignals.length,
      tradesExecuted,
      exitsExecuted: exits.length,
      details,
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

  try {
    const exits = await checkExits(alpacaConfig, userId);
    for (const exit of exits) {
      sendTradeNotification(user.email, exit).catch(() => {});
    }

    if (!isMarketHours() && !alpacaConfig.paper) {
      return {
        status: "SKIPPED",
        reason: "Market closed",
        scanned: 0,
        signalsFound: 0,
        tradesExecuted: 0,
        exitsExecuted: exits.length,
        details: exits,
      };
    }

    const scanResults = await scanMarket(config.watchlist);
    const rankedSignals = rankSignals(scanResults);

    const aiConvictions = rankedSignals.length > 0
      ? await getAIConvictions(rankedSignals)
      : new Map();

    const portfolio = await getPortfolioSummary(alpacaConfig, userId);

    const details: any[] = [...exits];
    let tradesExecuted = 0;
    const maxNewTrades = Math.max(0, config.maxOpenPositions - portfolio.openPositions);

    for (const signal of rankedSignals.slice(0, maxNewTrades)) {
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
        maxPositionPct: config.maxPositionPct,
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
        tradesExecuted++;
        sendTradeNotification(user.email, result).catch(() => {});
      }
    }

    return {
      status: "OK",
      reason: `Cycle complete: ${tradesExecuted} entries, ${exits.length} exits`,
      scanned: scanResults.length,
      signalsFound: rankedSignals.length,
      tradesExecuted,
      exitsExecuted: exits.length,
      details,
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
  const scanResults = await scanMarket(config.watchlist);
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
