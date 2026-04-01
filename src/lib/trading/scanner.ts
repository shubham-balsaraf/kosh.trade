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
}

export async function scanStock(ticker: string): Promise<ScanResult | null> {
  try {
    const data = await getChart(ticker, "6mo", "1d");
    if (!data || data.closes.length < 50) return null;

    const closes = data.closes;
    const rsiResult = rsi(closes);
    const macdResult = macd(closes);
    const bbResult = bollingerBands(closes);
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const ema9 = ema(closes, 9);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=6mo&interval=1d&includePrePost=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KoshApp/1.0)" },
      next: { revalidate: 900 },
    });
    let volumes: number[] = [];
    if (res.ok) {
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      volumes = result?.indicators?.quote?.[0]?.volume?.filter((v: any) => v != null) || [];
    }

    const volRatio = volumes.length > 20 ? volumeSpike(volumes) : 1;

    const highs = closes.map((c) => c * 1.005);
    const lows = closes.map((c) => c * 0.995);
    const atrVal = atr(highs, lows, closes);

    const vwapVols = volumes.length >= closes.length ? volumes : closes.map(() => 1);
    const vwapResult = vwap(closes, highs, lows, vwapVols);

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
