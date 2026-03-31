import type { ScanResult } from "./scanner";

export type SignalAction = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
export type StrategyType = "MOMENTUM" | "MEAN_REVERSION" | "SWING";

export interface Signal {
  name: string;
  score: number; // -100 to +100
  weight: number;
  reason: string;
}

export interface TradeSignal {
  ticker: string;
  price: number;
  action: SignalAction;
  score: number; // -100 to +100 (weighted composite)
  confidence: number; // 0-100
  strategy: StrategyType;
  signals: Signal[];
  stopLoss: number;
  takeProfit: number;
}

function rsiSignal(rsiVal: number): Signal {
  if (isNaN(rsiVal)) return { name: "RSI", score: 0, weight: 2, reason: "No data" };

  if (rsiVal < 25) return { name: "RSI", score: 80, weight: 2.5, reason: `RSI ${rsiVal.toFixed(0)} — deeply oversold` };
  if (rsiVal < 30) return { name: "RSI", score: 60, weight: 2, reason: `RSI ${rsiVal.toFixed(0)} — oversold` };
  if (rsiVal < 40) return { name: "RSI", score: 25, weight: 1.5, reason: `RSI ${rsiVal.toFixed(0)} — approaching oversold` };
  if (rsiVal > 80) return { name: "RSI", score: -70, weight: 2.5, reason: `RSI ${rsiVal.toFixed(0)} — extremely overbought` };
  if (rsiVal > 70) return { name: "RSI", score: -50, weight: 2, reason: `RSI ${rsiVal.toFixed(0)} — overbought` };
  if (rsiVal > 60) return { name: "RSI", score: -15, weight: 1.5, reason: `RSI ${rsiVal.toFixed(0)} — elevated` };
  return { name: "RSI", score: 0, weight: 1, reason: `RSI ${rsiVal.toFixed(0)} — neutral` };
}

function macdSignal(m: ScanResult["macd"]): Signal {
  if (isNaN(m.macd) || isNaN(m.signal)) return { name: "MACD", score: 0, weight: 1, reason: "No data" };

  const crossover = m.histogram;
  if (crossover > 0 && m.macd > 0) return { name: "MACD", score: 50, weight: 2, reason: "Bullish crossover, above zero" };
  if (crossover > 0) return { name: "MACD", score: 30, weight: 1.5, reason: "Bullish crossover" };
  if (crossover < 0 && m.macd < 0) return { name: "MACD", score: -50, weight: 2, reason: "Bearish crossover, below zero" };
  if (crossover < 0) return { name: "MACD", score: -25, weight: 1.5, reason: "Bearish crossover" };
  return { name: "MACD", score: 0, weight: 1, reason: "Neutral" };
}

function bollingerSignal(bb: ScanResult["bollinger"], price: number): Signal {
  const { percentB } = bb;
  if (isNaN(percentB)) return { name: "Bollinger", score: 0, weight: 1, reason: "No data" };

  if (percentB < 0) return { name: "Bollinger", score: 70, weight: 2, reason: `Price below lower band (%B ${(percentB * 100).toFixed(0)}%)` };
  if (percentB < 0.2) return { name: "Bollinger", score: 40, weight: 1.5, reason: `Near lower band (%B ${(percentB * 100).toFixed(0)}%)` };
  if (percentB > 1) return { name: "Bollinger", score: -60, weight: 2, reason: `Price above upper band (%B ${(percentB * 100).toFixed(0)}%)` };
  if (percentB > 0.8) return { name: "Bollinger", score: -30, weight: 1.5, reason: `Near upper band (%B ${(percentB * 100).toFixed(0)}%)` };
  return { name: "Bollinger", score: 0, weight: 1, reason: `Mid-band (%B ${(percentB * 100).toFixed(0)}%)` };
}

function trendSignal(price: number, sma20: number, sma50: number, ema9: number): Signal {
  if (isNaN(sma20) || isNaN(sma50)) return { name: "Trend", score: 0, weight: 1, reason: "No data" };

  const aboveSma20 = price > sma20;
  const aboveSma50 = price > sma50;
  const goldenCross = sma20 > sma50;
  const aboveEma9 = price > ema9;

  if (aboveSma20 && aboveSma50 && goldenCross && aboveEma9) {
    return { name: "Trend", score: 60, weight: 2, reason: "Strong uptrend — above all MAs, golden cross" };
  }
  if (aboveSma20 && aboveSma50) {
    return { name: "Trend", score: 35, weight: 1.5, reason: "Uptrend — above SMA20 and SMA50" };
  }
  if (!aboveSma20 && !aboveSma50 && !goldenCross) {
    return { name: "Trend", score: -55, weight: 2, reason: "Strong downtrend — below all MAs, death cross" };
  }
  if (!aboveSma20 && !aboveSma50) {
    return { name: "Trend", score: -30, weight: 1.5, reason: "Downtrend — below SMA20 and SMA50" };
  }
  return { name: "Trend", score: 0, weight: 1, reason: "Mixed trend" };
}

function volumeSignal(volRatio: number): Signal {
  if (volRatio > 3) return { name: "Volume", score: 40, weight: 1.5, reason: `Volume spike ${volRatio.toFixed(1)}x avg — major interest` };
  if (volRatio > 2) return { name: "Volume", score: 25, weight: 1.2, reason: `Volume ${volRatio.toFixed(1)}x avg — elevated interest` };
  if (volRatio > 1.5) return { name: "Volume", score: 10, weight: 1, reason: `Volume ${volRatio.toFixed(1)}x avg — above average` };
  if (volRatio < 0.5) return { name: "Volume", score: -10, weight: 0.8, reason: `Low volume ${volRatio.toFixed(1)}x avg` };
  return { name: "Volume", score: 0, weight: 0.5, reason: `Normal volume ${volRatio.toFixed(1)}x` };
}

function momentumSignal(weekReturn: number, monthReturn: number): Signal {
  if (weekReturn > 5 && monthReturn > 10) {
    return { name: "Momentum", score: -30, weight: 1.5, reason: `Extended rally (+${weekReturn.toFixed(1)}% week, +${monthReturn.toFixed(1)}% month)` };
  }
  if (weekReturn > 3 && monthReturn > 0) {
    return { name: "Momentum", score: 20, weight: 1.2, reason: `Positive momentum (+${weekReturn.toFixed(1)}% week)` };
  }
  if (weekReturn < -5 && monthReturn < -10) {
    return { name: "Momentum", score: 40, weight: 1.5, reason: `Heavy selloff (${weekReturn.toFixed(1)}% week) — potential bounce` };
  }
  if (weekReturn < -3) {
    return { name: "Momentum", score: 20, weight: 1, reason: `Pullback (${weekReturn.toFixed(1)}% week) — watch for support` };
  }
  return { name: "Momentum", score: 0, weight: 0.8, reason: `Flat momentum (${weekReturn.toFixed(1)}% week)` };
}

function detectStrategy(signals: Signal[], rsiVal: number): StrategyType {
  const rsiOversold = rsiVal < 35;
  const trendSig = signals.find((s) => s.name === "Trend");
  const trendBullish = trendSig && trendSig.score > 20;

  if (rsiOversold) return "MEAN_REVERSION";
  if (trendBullish) return "MOMENTUM";
  return "SWING";
}

export function generateSignals(scan: ScanResult): TradeSignal {
  const signals: Signal[] = [
    rsiSignal(scan.rsi),
    macdSignal(scan.macd),
    bollingerSignal(scan.bollinger, scan.price),
    trendSignal(scan.price, scan.sma20, scan.sma50, scan.ema9),
    volumeSignal(scan.volumeRatio),
    momentumSignal(scan.weekReturn, scan.monthReturn),
  ];

  let totalWeightedScore = 0;
  let totalWeight = 0;
  for (const sig of signals) {
    totalWeightedScore += sig.score * sig.weight;
    totalWeight += sig.weight;
  }
  const compositeScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

  const agreeing = signals.filter((s) => Math.sign(s.score) === Math.sign(compositeScore) && s.score !== 0).length;
  const confidence = Math.min(100, Math.round((agreeing / signals.length) * 100 + Math.abs(compositeScore) * 0.3));

  let action: SignalAction;
  if (compositeScore > 40) action = "STRONG_BUY";
  else if (compositeScore > 15) action = "BUY";
  else if (compositeScore < -40) action = "STRONG_SELL";
  else if (compositeScore < -15) action = "SELL";
  else action = "HOLD";

  const strategy = detectStrategy(signals, scan.rsi);

  const atrStop = isNaN(scan.atr) ? scan.price * 0.03 : scan.atr * 1.5;
  const stopLoss = Math.round((scan.price - atrStop) * 100) / 100;
  const riskReward = 2;
  const takeProfit = Math.round((scan.price + atrStop * riskReward) * 100) / 100;

  return {
    ticker: scan.ticker,
    price: scan.price,
    action,
    score: Math.round(compositeScore * 100) / 100,
    confidence,
    strategy,
    signals,
    stopLoss,
    takeProfit,
  };
}

export function rankSignals(scanResults: ScanResult[]): TradeSignal[] {
  return scanResults
    .map(generateSignals)
    .filter((s) => s.action === "BUY" || s.action === "STRONG_BUY")
    .sort((a, b) => b.score - a.score);
}
