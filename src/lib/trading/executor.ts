import {
  submitOrder,
  getAccount,
  getPositions,
  getOrders,
  cancelOrder,
} from "@/lib/api/alpaca";
import { prisma } from "@/lib/db";
import type { PositionSize } from "./risk";
import { shouldExitPosition } from "./risk";
import { getChart } from "@/lib/api/yahoo";

interface AlpacaConfig {
  apiKey: string;
  secretKey: string;
  paper: boolean;
}

export interface ExecutionResult {
  ticker: string;
  action: "BUY" | "SELL" | "SKIP";
  qty: number;
  orderId: string | null;
  status: string;
  reason: string;
  price: number | null;
}

export async function executeEntry(
  config: AlpacaConfig,
  position: PositionSize,
  userId: string,
  strategy: string,
  aiConfidence: number,
  signalScore: number
): Promise<ExecutionResult> {
  if (position.rejected) {
    return {
      ticker: position.ticker,
      action: "SKIP",
      qty: 0,
      orderId: null,
      status: "REJECTED",
      reason: position.rejectReason || "Unknown",
      price: null,
    };
  }

  try {
    const order = await submitOrder(config, {
      symbol: position.ticker,
      qty: position.qty,
      side: "buy",
      type: "market",
      time_in_force: "day",
    });

    await prisma.autoTrade.create({
      data: {
        userId,
        ticker: position.ticker,
        side: "BUY",
        qty: position.qty,
        entryPrice: order.filled_avg_price ? parseFloat(order.filled_avg_price) : null,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
        strategy,
        aiConfidence,
        signalScore,
        alpacaOrderId: order.id,
        status: order.status === "filled" ? "OPEN" : "PENDING",
        mode: "LIVE",
        entryAt: order.filled_at ? new Date(order.filled_at) : new Date(),
      },
    });

    return {
      ticker: position.ticker,
      action: "BUY",
      qty: position.qty,
      orderId: order.id,
      status: order.status,
      reason: `Bought ${position.qty} shares`,
      price: order.filled_avg_price ? parseFloat(order.filled_avg_price) : null,
    };
  } catch (e: any) {
    return {
      ticker: position.ticker,
      action: "SKIP",
      qty: 0,
      orderId: null,
      status: "ERROR",
      reason: e.message,
      price: null,
    };
  }
}

export async function checkExits(
  config: AlpacaConfig,
  userId: string
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  const openTrades = await prisma.autoTrade.findMany({
    where: { userId, status: "OPEN" },
  });

  if (openTrades.length === 0) return results;

  for (const trade of openTrades) {
    try {
      const data = await getChart(trade.ticker, "1d", "1d");
      if (!data) continue;

      const currentPrice = data.price;
      const holdingDays = Math.ceil(
        (Date.now() - new Date(trade.entryAt || trade.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const exitCheck = shouldExitPosition(
        currentPrice,
        trade.entryPrice || currentPrice,
        trade.stopLoss || 0,
        trade.takeProfit || Infinity,
        holdingDays
      );

      if (exitCheck.exit) {
        const order = await submitOrder(config, {
          symbol: trade.ticker,
          qty: trade.qty,
          side: "sell",
          type: "market",
          time_in_force: "day",
        });

        const exitPrice = order.filled_avg_price
          ? parseFloat(order.filled_avg_price)
          : currentPrice;
        const pnl = (exitPrice - (trade.entryPrice || 0)) * trade.qty;

        await prisma.autoTrade.update({
          where: { id: trade.id },
          data: {
            exitPrice,
            pnl,
            status: "CLOSED",
            exitAt: new Date(),
            exitReason: exitCheck.reason,
          },
        });

        results.push({
          ticker: trade.ticker,
          action: "SELL",
          qty: trade.qty,
          orderId: order.id,
          status: "CLOSED",
          reason: exitCheck.reason,
          price: exitPrice,
        });
      }
    } catch (e: any) {
      console.error(`[Executor] Exit check failed for ${trade.ticker}:`, e.message);
    }
  }

  return results;
}

export async function getPortfolioSummary(
  config: AlpacaConfig,
  userId: string
): Promise<{
  equity: number;
  cash: number;
  openPositions: number;
  dayTradesUsed: number;
  dailyPnl: number;
}> {
  try {
    const account = await getAccount(config);
    const positions = await getPositions(config);

    // Count day trades from recent closed trades
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const recentClosed = await prisma.autoTrade.count({
      where: {
        userId,
        status: "CLOSED",
        entryAt: { gte: fiveDaysAgo },
        exitAt: { not: null },
      },
    });

    // Today's P&L from closed trades
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTrades = await prisma.autoTrade.findMany({
      where: {
        userId,
        status: "CLOSED",
        exitAt: { gte: todayStart },
      },
      select: { pnl: true },
    });
    const dailyPnl = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    return {
      equity: parseFloat(account.equity || "0"),
      cash: parseFloat(account.cash || "0"),
      openPositions: positions.length,
      dayTradesUsed: recentClosed,
      dailyPnl,
    };
  } catch (e: any) {
    console.error("[Executor] Portfolio summary failed:", e.message);
    return { equity: 0, cash: 0, openPositions: 0, dayTradesUsed: 0, dailyPnl: 0 };
  }
}
