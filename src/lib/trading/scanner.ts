import { getChart } from "@/lib/api/yahoo";
import {
  rsi,
  macd,
  bollingerBands,
  sma,
  ema,
  volumeSpike,
  atr,
  priceChangePercent,
  vwap,
  stochastic,
  adx,
  maxDrawdown,
  realizedVolatility,
} from "./indicators";

export const DEFAULT_WATCHLIST = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD",
  "NFLX", "CRM", "AVGO", "ORCL", "ADBE", "INTC", "CSCO",
  "JPM", "BAC", "GS", "V", "MA",
  "UNH", "JNJ", "PFE", "ABBV", "MRK",
  "XOM", "CVX", "LMT", "CAT", "DE",
  "SPY", "QQQ",
  "BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "DOGE-USD", "ADA-USD",
];

export interface ScanResult {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  rsi: number;
  macd: { macd: number; signal: number; histogram: number };
  bollinger: { upper: number; middle: number; lower: number; percentB: number };
  sma20: number;
  sma50: number;
  ema9: number;
  volumeRatio: number;
  atr: number;
  vwap: number;
  high20: number;
  low20: number;
  weekReturn: number;
  monthReturn: number;
  stoch: { k: number; d: number };
  adx: { adx: number; plusDI: number; minusDI: number };
  volatility: number;
  drawdown3m: number;
}

export async function scanStock(ticker: string): Promise<ScanResult | null> {
  try {
    const data = await getChart(ticker, "6mo", "1d");
    if (!data || data.closes.length < 50) return null;

    const closes = data.closes;
    const highs = data.highs.length === closes.length ? data.highs : closes.map((c) => c * 1.005);
    const lows = data.lows.length === closes.length ? data.lows : closes.map((c) => c * 0.995);
    const volumes = data.volumes.length >= closes.length ? data.volumes : [];

    const rsiResult = rsi(closes);
    const macdResult = macd(closes);
    const bbResult = bollingerBands(closes);
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const ema9 = ema(closes, 9);
    const volRatio = volumes.length > 20 ? volumeSpike(volumes) : 1;
    const atrVal = atr(highs, lows, closes);
    const vwapVols = volumes.length >= closes.length ? volumes : closes.map(() => 1);
    const vwapResult = vwap(closes, highs, lows, vwapVols);
    const stochResult = stochastic(highs, lows, closes);
    const adxResult = adx(highs, lows, closes);
    const vol = realizedVolatility(closes);
    const dd3m = maxDrawdown(closes, 63);

    const recent20 = closes.slice(-20);
    const high20 = Math.max(...recent20);
    const low20 = Math.min(...recent20);

    return {
      ticker,
      price: data.price,
      change: data.change,
      changePercent: data.changePercent,
      rsi: rsiResult.current,
      macd: macdResult.current,
      bollinger: bbResult.current,
      sma20: sma20[sma20.length - 1],
      sma50: sma50[sma50.length - 1],
      ema9: ema9[ema9.length - 1],
      volumeRatio: volRatio,
      atr: atrVal,
      vwap: vwapResult.current,
      high20,
      low20,
      weekReturn: priceChangePercent(closes, 5),
      monthReturn: priceChangePercent(closes, 21),
      stoch: stochResult,
      adx: adxResult,
      volatility: vol,
      drawdown3m: dd3m,
    };
  } catch (e) {
    console.error(`[Scanner] Failed to scan ${ticker}:`, e);
    return null;
  }
}

export async function scanMarket(
  watchlist: string[] = DEFAULT_WATCHLIST
): Promise<ScanResult[]> {
  const batchSize = 5;
  const results: ScanResult[] = [];

  for (let i = 0; i < watchlist.length; i += batchSize) {
    const batch = watchlist.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(scanStock));
    for (const r of batchResults) {
      if (r) results.push(r);
    }
    if (i + batchSize < watchlist.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}
