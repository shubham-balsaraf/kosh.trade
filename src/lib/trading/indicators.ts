/**
 * Technical indicators for trading signals.
 * All functions operate on arrays of closing prices (oldest first).
 */

export function sma(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    result.push(sum / period);
  }
  return result;
}

export function ema(data: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  let prev = NaN;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += data[j];
      prev = sum / period;
      result.push(prev);
      continue;
    }
    prev = data[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

export interface RSIResult {
  values: number[];
  current: number;
}

export function rsi(closes: number[], period = 14): RSIResult {
  const values: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return { values, current: NaN };

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  values[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs0);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    values[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
  }

  return { values, current: values[values.length - 1] };
}

export interface MACDResult {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
  current: { macd: number; signal: number; histogram: number };
}

export function macd(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDResult {
  const fastEma = ema(closes, fastPeriod);
  const slowEma = ema(closes, slowPeriod);

  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(fastEma[i]) || isNaN(slowEma[i])) {
      macdLine.push(NaN);
    } else {
      macdLine.push(fastEma[i] - slowEma[i]);
    }
  }

  const validMacd = macdLine.filter((v) => !isNaN(v));
  const signalEmaValues = ema(validMacd, signalPeriod);

  const signalLine: number[] = new Array(closes.length).fill(NaN);
  let idx = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(macdLine[i])) {
      signalLine[i] = signalEmaValues[idx] ?? NaN;
      idx++;
    }
  }

  const histogram: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(macdLine[i]) || isNaN(signalLine[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(macdLine[i] - signalLine[i]);
    }
  }

  const last = closes.length - 1;
  return {
    macdLine,
    signalLine,
    histogram,
    current: {
      macd: macdLine[last] ?? NaN,
      signal: signalLine[last] ?? NaN,
      histogram: histogram[last] ?? NaN,
    },
  };
}

export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
  current: { upper: number; middle: number; lower: number; percentB: number };
}

export function bollingerBands(closes: number[], period = 20, stdDev = 2): BollingerResult {
  const middle = sma(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (isNaN(middle[i])) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (closes[j] - middle[i]) ** 2;
    }
    const sd = Math.sqrt(sumSq / period);
    upper.push(middle[i] + stdDev * sd);
    lower.push(middle[i] - stdDev * sd);
  }

  const last = closes.length - 1;
  const price = closes[last];
  const bandWidth = upper[last] - lower[last];
  const percentB = bandWidth === 0 ? 0.5 : (price - lower[last]) / bandWidth;

  return {
    upper,
    middle,
    lower,
    current: {
      upper: upper[last],
      middle: middle[last],
      lower: lower[last],
      percentB,
    },
  };
}

export interface VWAPResult {
  values: number[];
  current: number;
}

export function vwap(
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[]
): VWAPResult {
  const values: number[] = [];
  let cumTPV = 0;
  let cumVol = 0;

  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumTPV += tp * volumes[i];
    cumVol += volumes[i];
    values.push(cumVol === 0 ? tp : cumTPV / cumVol);
  }

  return { values, current: values[values.length - 1] || NaN };
}

export function volumeSpike(volumes: number[], lookback = 20): number {
  if (volumes.length < lookback + 1) return 1;
  const recent = volumes.slice(-lookback - 1, -1);
  const avg = recent.reduce((s, v) => s + v, 0) / recent.length;
  if (avg === 0) return 1;
  return volumes[volumes.length - 1] / avg;
}

export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number {
  if (closes.length < period + 1) return NaN;

  const trueRanges: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }

  let sum = 0;
  for (let i = 0; i < period; i++) sum += trueRanges[i];
  let atrVal = sum / period;

  for (let i = period; i < trueRanges.length; i++) {
    atrVal = (atrVal * (period - 1) + trueRanges[i]) / period;
  }

  return atrVal;
}

export function priceChangePercent(closes: number[], period: number): number {
  if (closes.length < period + 1) return 0;
  const old = closes[closes.length - 1 - period];
  const current = closes[closes.length - 1];
  return old === 0 ? 0 : ((current - old) / old) * 100;
}

export interface StochasticResult {
  k: number;
  d: number;
}

export function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod = 14,
  dPeriod = 3
): StochasticResult {
  if (closes.length < kPeriod) return { k: NaN, d: NaN };

  const kValues: number[] = [];
  for (let i = kPeriod - 1; i < closes.length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (highs[j] > highestHigh) highestHigh = highs[j];
      if (lows[j] < lowestLow) lowestLow = lows[j];
    }
    const range = highestHigh - lowestLow;
    kValues.push(range === 0 ? 50 : ((closes[i] - lowestLow) / range) * 100);
  }

  if (kValues.length < dPeriod) return { k: kValues[kValues.length - 1] || NaN, d: NaN };

  let dSum = 0;
  for (let i = kValues.length - dPeriod; i < kValues.length; i++) dSum += kValues[i];

  return { k: kValues[kValues.length - 1], d: dSum / dPeriod };
}

export interface ADXResult {
  adx: number;
  plusDI: number;
  minusDI: number;
}

export function adx(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): ADXResult {
  if (closes.length < period * 2 + 1) return { adx: NaN, plusDI: NaN, minusDI: NaN };

  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }

  const smooth = (arr: number[]): number[] => {
    const result: number[] = [];
    let sum = 0;
    for (let i = 0; i < period; i++) sum += arr[i];
    result.push(sum);
    for (let i = period; i < arr.length; i++) {
      result.push(result[result.length - 1] - result[result.length - 1] / period + arr[i]);
    }
    return result;
  };

  const smoothTR = smooth(tr);
  const smoothPlusDM = smooth(plusDM);
  const smoothMinusDM = smooth(minusDM);

  const dx: number[] = [];
  for (let i = 0; i < smoothTR.length; i++) {
    if (smoothTR[i] === 0) { dx.push(0); continue; }
    const pdi = (smoothPlusDM[i] / smoothTR[i]) * 100;
    const mdi = (smoothMinusDM[i] / smoothTR[i]) * 100;
    const diSum = pdi + mdi;
    dx.push(diSum === 0 ? 0 : (Math.abs(pdi - mdi) / diSum) * 100);
  }

  if (dx.length < period) return { adx: NaN, plusDI: NaN, minusDI: NaN };

  let adxSum = 0;
  for (let i = 0; i < period; i++) adxSum += dx[i];
  let adxVal = adxSum / period;
  for (let i = period; i < dx.length; i++) {
    adxVal = (adxVal * (period - 1) + dx[i]) / period;
  }

  const lastIdx = smoothTR.length - 1;
  const plusDI = smoothTR[lastIdx] === 0 ? 0 : (smoothPlusDM[lastIdx] / smoothTR[lastIdx]) * 100;
  const minusDI = smoothTR[lastIdx] === 0 ? 0 : (smoothMinusDM[lastIdx] / smoothTR[lastIdx]) * 100;

  return { adx: adxVal, plusDI, minusDI };
}

export function maxDrawdown(closes: number[], period: number): number {
  const slice = closes.slice(-period);
  if (slice.length < 2) return 0;
  let peak = slice[0];
  let maxDd = 0;
  for (const price of slice) {
    if (price > peak) peak = price;
    const dd = ((peak - price) / peak) * 100;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

export function realizedVolatility(closes: number[], period = 20): number {
  if (closes.length < period + 1) return NaN;
  const returns: number[] = [];
  const start = closes.length - period;
  for (let i = start; i < closes.length; i++) {
    if (closes[i - 1] === 0) continue;
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (returns.length < 2) return NaN;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance * 252) * 100;
}
