import { prisma } from "@/lib/db";
import { scanMarket } from "./scanner";
import { rankSignals, generateSignals } from "./signals";
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

  if (!user.alpacaApiKey || !user.alpacaSecretKey) {
    return { status: "ERROR", reason: "Alpaca API keys not configured", scanned: 0, signalsFound: 0, tradesExecuted: 0, exitsExecuted: 0, details: [] };
  }

  const alpacaConfig = getAlpacaConfig(user);

  try {
    // 1. Check exits first
    const exits = await checkExits(alpacaConfig, userId);
    for (const exit of exits) {
      sendTradeNotification(user.email, exit).catch(() => {});
    }

    // 2. Skip new entries if market is closed (but still check exits above)
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

    // 3. Scan market
    const scanResults = await scanMarket(config.watchlist);

    // 4. Generate and rank signals
    const rankedSignals = rankSignals(scanResults);

    // 5. Get AI convictions for top signals
    const aiConvictions = rankedSignals.length > 0
      ? await getAIConvictions(rankedSignals)
      : new Map();

    // 6. Get portfolio summary for risk management
    const portfolio = await getPortfolioSummary(alpacaConfig, userId);

    // 7. Execute trades
    const details: any[] = [...exits];
    let tradesExecuted = 0;

    const maxNewTrades = Math.max(0, config.maxOpenPositions - portfolio.openPositions);

    for (const signal of rankedSignals.slice(0, maxNewTrades)) {
      const aiVerdict = aiConvictions.get(signal.ticker);
      const aiConfidence = aiVerdict?.conviction ? aiVerdict.conviction * 10 : 50;

      // Skip if AI says avoid (conviction < 4)
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

  const alpacaConfig = getAlpacaConfig(user);
  const config = user.tradingConfig;

  const scanResults = await scanMarket(config.watchlist);
  const signals = rankSignals(scanResults);
  const portfolio = await getPortfolioSummary(alpacaConfig, userId);

  const openTrades = await prisma.autoTrade.findMany({
    where: { userId, status: "OPEN" },
    select: { ticker: true },
  });

  const briefing = await getDailyBriefing(
    signals,
    portfolio.equity,
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

  const alpacaConfig = getAlpacaConfig(user);
  const portfolio = await getPortfolioSummary(alpacaConfig, userId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayTrades = await prisma.autoTrade.findMany({
    where: {
      userId,
      createdAt: { gte: todayStart },
    },
    orderBy: { createdAt: "desc" },
  });

  const openTrades = await prisma.autoTrade.findMany({
    where: { userId, status: "OPEN" },
  });

  await sendDailySummary(user.email, {
    equity: portfolio.equity,
    dailyPnl: portfolio.dailyPnl,
    todayTrades,
    openPositions: openTrades,
  });
}
