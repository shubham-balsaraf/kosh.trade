import type { TradeSignal } from "./signals";

export interface RiskConfig {
  portfolioValue: number;
  maxPositionPct: number; // e.g. 5 = 5%
  maxDailyLossPct: number; // e.g. 3 = 3%
  maxOpenPositions: number;
  currentOpenPositions: number;
  dayTradesUsed: number; // rolling 5-day count
  dailyPnl: number; // today's realized + unrealized P&L
  isPaper: boolean;
}

export interface PositionSize {
  ticker: string;
  qty: number;
  dollarAmount: number;
  stopLoss: number;
  takeProfit: number;
  riskPerShare: number;
  riskDollars: number;
  rejected: boolean;
  rejectReason: string | null;
}

const PDT_DAY_TRADE_LIMIT = 3;
const MIN_POSITION_DOLLARS = 5;

function isMarketHours(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  if (day === 0 || day === 6) return false;

  const hours = et.getHours();
  const mins = et.getMinutes();
  const totalMins = hours * 60 + mins;

  // 9:45 AM to 3:45 PM ET (skip first/last 15 min)
  return totalMins >= 585 && totalMins <= 945;
}

function isDayTradeAllowed(config: RiskConfig): boolean {
  if (config.isPaper) return true;
  if (config.portfolioValue >= 25000) return true;
  return config.dayTradesUsed < PDT_DAY_TRADE_LIMIT;
}

function isDailyLossExceeded(config: RiskConfig): boolean {
  const maxLoss = config.portfolioValue * (config.maxDailyLossPct / 100);
  return config.dailyPnl <= -maxLoss;
}

export function calculatePosition(
  signal: TradeSignal,
  config: RiskConfig,
  aiConfidence: number = 50
): PositionSize {
  const reject = (reason: string): PositionSize => ({
    ticker: signal.ticker,
    qty: 0,
    dollarAmount: 0,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    riskPerShare: 0,
    riskDollars: 0,
    rejected: true,
    rejectReason: reason,
  });

  if (!isMarketHours() && !config.isPaper) {
    return reject("Market closed or in first/last 15 min");
  }

  if (isDailyLossExceeded(config)) {
    return reject(`Daily loss limit hit ($${Math.abs(config.dailyPnl).toFixed(2)} lost)`);
  }

  if (config.currentOpenPositions >= config.maxOpenPositions) {
    return reject(`Max open positions reached (${config.maxOpenPositions})`);
  }

  if (signal.action !== "BUY" && signal.action !== "STRONG_BUY") {
    return reject(`Signal is ${signal.action}, not a buy`);
  }

  const riskPerShare = signal.price - signal.stopLoss;
  if (riskPerShare <= 0) {
    return reject("Invalid stop loss (above current price)");
  }

  // Confidence-adjusted position sizing:
  // base = maxPositionPct, scaled by signal confidence & AI confidence
  const signalMultiplier = signal.action === "STRONG_BUY" ? 1 : 0.7;
  const confidenceMultiplier = Math.max(0.3, Math.min(1, (signal.confidence + aiConfidence) / 200));
  const adjustedPct = config.maxPositionPct * signalMultiplier * confidenceMultiplier;

  const maxDollars = config.portfolioValue * (adjustedPct / 100);

  // Also limit by risk: don't risk more than 1% of portfolio on a single trade
  const maxRiskDollars = config.portfolioValue * 0.01;
  const qtyByRisk = Math.floor(maxRiskDollars / riskPerShare);
  const qtyByDollars = Math.floor(maxDollars / signal.price);
  const qty = Math.max(1, Math.min(qtyByRisk, qtyByDollars));

  const dollarAmount = qty * signal.price;
  if (dollarAmount < MIN_POSITION_DOLLARS) {
    return reject(`Position too small ($${dollarAmount.toFixed(2)})`);
  }

  if (dollarAmount > config.portfolioValue * 0.95) {
    return reject("Position exceeds available capital");
  }

  return {
    ticker: signal.ticker,
    qty,
    dollarAmount: Math.round(dollarAmount * 100) / 100,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    riskPerShare: Math.round(riskPerShare * 100) / 100,
    riskDollars: Math.round(qty * riskPerShare * 100) / 100,
    rejected: false,
    rejectReason: null,
  };
}

export function shouldExitPosition(
  currentPrice: number,
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  holdingDays: number,
  maxHoldDays: number = 10
): { exit: boolean; reason: string } {
  if (currentPrice <= stopLoss) {
    return { exit: true, reason: `Stop loss hit at $${stopLoss}` };
  }
  if (currentPrice >= takeProfit) {
    return { exit: true, reason: `Take profit hit at $${takeProfit}` };
  }

  const gainPct = ((currentPrice - entryPrice) / entryPrice) * 100;
  if (gainPct > 5) {
    const trailingStop = entryPrice * 1.01;
    if (currentPrice < trailingStop) {
      return { exit: true, reason: `Trailing stop triggered after ${gainPct.toFixed(1)}% gain` };
    }
  }

  if (holdingDays >= maxHoldDays) {
    return { exit: true, reason: `Max holding period (${holdingDays} days)` };
  }

  return { exit: false, reason: "" };
}

export { isMarketHours, isDayTradeAllowed };
