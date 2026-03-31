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
  if (crossover > 0 && m.macd > 0) return { name: "MACD", score: 50, weight: 2.5, reason: "Bullish crossover, above zero" };
  if (crossover > 0) return { name: "MACD", score: 30, weight: 2, reason: "Bullish crossover" };
  if (crossover < 0 && m.macd < 0) return { name: "MACD", score: -50, weight: 2.5, reason: "Bearish crossover, below zero" };
  if (crossover < 0) return { name: "MACD", score: -25, weight: 2, reason: "Bearish crossover" };
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
    return { name: "Trend", score: 60, weight: 2.5, reason: "Strong uptrend — above all MAs, golden cross" };
  }
  if (aboveSma20 && aboveSma50) {
    return { name: "Trend", score: 35, weight: 2, reason: "Uptrend — above SMA20 and SMA50" };
  }
  if (!aboveSma20 && !aboveSma50 && !goldenCross) {
    return { name: "Trend", score: -55, weight: 2.5, reason: "Strong downtrend — below all MAs, death cross" };
  }
  if (!aboveSma20 && !aboveSma50) {
    return { name: "Trend", score: -30, weight: 2, reason: "Downtrend — below SMA20 and SMA50" };
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

function vwapSignal(price: number, vwapVal: number): Signal {
  if (isNaN(vwapVal) || vwapVal === 0) return { name: "VWAP", score: 0, weight: 0.5, reason: "No VWAP data" };

  const deviation = ((price - vwapVal) / vwapVal) * 100;

  if (deviation < -3) return { name: "VWAP", score: 55, weight: 1.8, reason: `${deviation.toFixed(1)}% below VWAP — institutional discount zone` };
  if (deviation < -1) return { name: "VWAP", score: 30, weight: 1.5, reason: `${deviation.toFixed(1)}% below VWAP — undervalued vs volume` };
  if (deviation > 3) return { name: "VWAP", score: -45, weight: 1.8, reason: `+${deviation.toFixed(1)}% above VWAP — overextended` };
  if (deviation > 1) return { name: "VWAP", score: -20, weight: 1.2, reason: `+${deviation.toFixed(1)}% above VWAP — premium price` };
  return { name: "VWAP", score: 5, weight: 1, reason: `Near VWAP (${deviation > 0 ? "+" : ""}${deviation.toFixed(1)}%) — fair value` };
}

function supportResistanceSignal(price: number, high20: number, low20: number): Signal {
  if (high20 === low20) return { name: "S/R", score: 0, weight: 0.5, reason: "No range data" };

  const range = high20 - low20;
  const positionInRange = (price - low20) / range;
  const distToSupport = ((price - low20) / price) * 100;
  const distToResistance = ((high20 - price) / price) * 100;

  if (positionInRange < 0.1) return { name: "S/R", score: 60, weight: 2, reason: `At 20-day support ($${low20.toFixed(2)}) — ${distToSupport.toFixed(1)}% away` };
  if (positionInRange < 0.25) return { name: "S/R", score: 35, weight: 1.5, reason: `Near support zone — lower quarter of 20-day range` };
  if (positionInRange > 0.9) return { name: "S/R", score: -50, weight: 2, reason: `At 20-day resistance ($${high20.toFixed(2)}) — ${distToResistance.toFixed(1)}% away` };
  if (positionInRange > 0.75) return { name: "S/R", score: -25, weight: 1.5, reason: `Near resistance — upper quarter of 20-day range` };
  return { name: "S/R", score: 0, weight: 0.8, reason: `Mid-range (${(positionInRange * 100).toFixed(0)}% of 20-day range)` };
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
    vwapSignal(scan.price, scan.vwap),
    supportResistanceSignal(scan.price, scan.high20, scan.low20),
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
  const allSignals = scanResults.map(generateSignals);

  const bearishCount = allSignals.filter((s) => s.score < -10).length;
  const bearishRatio = scanResults.length > 0 ? bearishCount / scanResults.length : 0;
  const marketRegimePenalty = bearishRatio > 0.6 ? 0.7 : bearishRatio > 0.4 ? 0.85 : 1;

  return allSignals
    .map((s) => ({
      ...s,
      score: s.score * marketRegimePenalty,
      confidence: Math.round(s.confidence * marketRegimePenalty),
    }))
    .filter((s) => s.action === "BUY" || s.action === "STRONG_BUY")
    .sort((a, b) => b.score - a.score);
}
