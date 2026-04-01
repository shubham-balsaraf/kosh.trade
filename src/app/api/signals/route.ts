import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getInsiderTrading } from "@/lib/api/fmp";
import { getRecommendations, getPriceTarget } from "@/lib/api/finnhub";
import { getMacroSnapshot } from "@/lib/signals/macroRegime";
import { scanStock, scanMarket, DEFAULT_WATCHLIST } from "@/lib/trading/scanner";
import { generateSignals, rankSignals } from "@/lib/trading/signals";
import { discoverOpportunities } from "@/lib/trading/discovery";
import type { ScanResult } from "@/lib/trading/scanner";
import type { TradeSignal } from "@/lib/trading/signals";

const BROAD_UNIVERSE = [
  // Tech
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD", "NFLX",
  "CRM", "AVGO", "ORCL", "ADBE", "INTC", "CSCO", "PLTR", "SHOP", "SQ", "SNOW",
  // Finance
  "JPM", "BAC", "GS", "V", "MA", "BRK-B", "AXP", "SCHW", "C",
  // Healthcare
  "UNH", "JNJ", "PFE", "ABBV", "MRK", "LLY", "TMO", "ABT",
  // Energy & Industrial
  "XOM", "CVX", "LMT", "CAT", "DE", "GE", "HON", "UPS",
  // Consumer
  "WMT", "COST", "HD", "MCD", "SBUX", "NKE", "DIS", "PG", "KO", "PEP",
  // Crypto
  "BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD",
  // ETFs
  "SPY", "QQQ",
];

type Horizon = "sprint" | "marathon" | "legacy";

interface HorizonRationale {
  horizon: Horizon;
  reason: string;
  score: number;
}

function classifyHorizon(signal: TradeSignal, scan: ScanResult): HorizonRationale[] {
  const horizons: HorizonRationale[] = [];

  const rsiInd = signal.signals.find((s) => s.name === "RSI");
  const trendInd = signal.signals.find((s) => s.name === "Trend");
  const volInd = signal.signals.find((s) => s.name === "Volume");
  const momInd = signal.signals.find((s) => s.name === "Momentum");
  const srInd = signal.signals.find((s) => s.name === "S/R");
  const vwapInd = signal.signals.find((s) => s.name === "VWAP");

  // Sprint: short-term momentum plays, mean reversion, volume catalysts
  let sprintScore = 0;
  const sprintReasons: string[] = [];

  if (signal.strategy === "MEAN_REVERSION" && scan.rsi < 35) {
    sprintScore += 30;
    sprintReasons.push("oversold bounce setup");
  }
  if (signal.strategy === "MOMENTUM" && (momInd?.score || 0) > 15) {
    sprintScore += 25;
    sprintReasons.push("strong near-term momentum");
  }
  if (scan.volumeRatio > 2) {
    sprintScore += 20;
    sprintReasons.push(`${scan.volumeRatio.toFixed(1)}x volume spike`);
  }
  if (scan.macd.histogram > 0 && scan.macd.macd > scan.macd.signal) {
    sprintScore += 15;
    sprintReasons.push("bullish MACD crossover");
  }
  if (signal.action === "STRONG_BUY") {
    sprintScore += 15;
    sprintReasons.push("very strong composite signal");
  }
  if ((srInd?.score || 0) > 30) {
    sprintScore += 15;
    sprintReasons.push("near key support level");
  }

  if (sprintScore >= 25 && signal.score > 5) {
    horizons.push({
      horizon: "sprint",
      score: sprintScore,
      reason: sprintReasons.slice(0, 3).join(", "),
    });
  }

  // Marathon: strong uptrend with room to run
  let marathonScore = 0;
  const marathonReasons: string[] = [];

  const goldenCross = scan.sma20 > scan.sma50;
  const aboveSma50 = scan.price > scan.sma50;
  const aboveSma20 = scan.price > scan.sma20;

  if (goldenCross && aboveSma50) {
    marathonScore += 30;
    marathonReasons.push("golden cross confirmed");
  }
  if ((trendInd?.score || 0) > 30) {
    marathonScore += 25;
    marathonReasons.push("strong sustained uptrend");
  }
  if (signal.confidence >= 50) {
    marathonScore += 15;
    marathonReasons.push(`high conviction (${signal.confidence}%)`);
  }
  if (aboveSma20 && aboveSma50 && scan.monthReturn > 0 && scan.monthReturn < 15) {
    marathonScore += 15;
    marathonReasons.push("steady growth, not overextended");
  }
  if (scan.rsi > 40 && scan.rsi < 65) {
    marathonScore += 10;
    marathonReasons.push("healthy RSI for continuation");
  }

  if (marathonScore >= 30 && signal.score > 0) {
    horizons.push({
      horizon: "marathon",
      score: marathonScore,
      reason: marathonReasons.slice(0, 3).join(", "),
    });
  }

  // Legacy: deep value / accumulation zone
  let legacyScore = 0;
  const legacyReasons: string[] = [];

  if (scan.rsi < 40 && scan.monthReturn < -5) {
    legacyScore += 25;
    legacyReasons.push("beaten down — accumulation zone");
  }
  if ((vwapInd?.score || 0) > 25) {
    legacyScore += 20;
    legacyReasons.push("trading below institutional VWAP");
  }
  if (scan.bollinger.percentB < 0.2) {
    legacyScore += 20;
    legacyReasons.push("near lower Bollinger band");
  }
  if (scan.price < scan.sma50 && scan.price < scan.sma20) {
    legacyScore += 15;
    legacyReasons.push("below major moving averages — discount");
  }
  if (!goldenCross && scan.rsi < 45) {
    legacyScore += 10;
    legacyReasons.push("waiting for trend reversal — early entry");
  }
  if (scan.monthReturn < -10) {
    legacyScore += 15;
    legacyReasons.push(`${scan.monthReturn.toFixed(1)}% monthly decline — deep value`);
  }

  if (legacyScore >= 25) {
    horizons.push({
      horizon: "legacy",
      score: legacyScore,
      reason: legacyReasons.slice(0, 3).join(", "),
    });
  }

  return horizons;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ticker = req.nextUrl.searchParams.get("ticker");
  const mode = req.nextUrl.searchParams.get("mode");

  try {
    if (mode === "best-picks") {
      const [scanResults, discovered] = await Promise.all([
        scanMarket(BROAD_UNIVERSE),
        discoverOpportunities().catch(() => []),
      ]);

      const discoveredTickers = discovered
        .map((d) => d.ticker)
        .filter((t) => !BROAD_UNIVERSE.includes(t))
        .slice(0, 10);
      let extraScans: ScanResult[] = [];
      if (discoveredTickers.length > 0) {
        extraScans = await scanMarket(discoveredTickers);
      }

      const allScans = [...scanResults, ...extraScans];
      const allSignals = allScans.map(generateSignals);
      const buySignals = allSignals.filter(
        (s) => s.action === "BUY" || s.action === "STRONG_BUY"
      );

      const scanMap = new Map<string, ScanResult>();
      for (const s of allScans) scanMap.set(s.ticker, s);

      const discoveryMap = new Map<string, { source: string; reason: string }>();
      for (const d of discovered) {
        discoveryMap.set(d.ticker, { source: d.source, reason: d.reason });
      }

      const picks: Array<{
        ticker: string;
        price: number;
        action: string;
        score: number;
        confidence: number;
        strategy: string;
        stopLoss: number;
        takeProfit: number;
        indicators: Array<{ name: string; score: number; reason: string }>;
        horizons: HorizonRationale[];
        discoveryInfo: { source: string; reason: string } | null;
        raw: {
          rsi: number;
          weekReturn: number;
          monthReturn: number;
          volumeRatio: number;
          changePercent: number;
        };
      }> = [];

      for (const signal of buySignals) {
        const scan = scanMap.get(signal.ticker);
        if (!scan) continue;

        const horizons = classifyHorizon(signal, scan);
        if (horizons.length === 0) continue;

        picks.push({
          ticker: signal.ticker,
          price: signal.price,
          action: signal.action,
          score: signal.score,
          confidence: signal.confidence,
          strategy: signal.strategy,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          indicators: signal.signals.map((ind) => ({
            name: ind.name,
            score: ind.score,
            reason: ind.reason,
          })),
          horizons,
          discoveryInfo: discoveryMap.get(signal.ticker) || null,
          raw: {
            rsi: scan.rsi,
            weekReturn: scan.weekReturn,
            monthReturn: scan.monthReturn,
            volumeRatio: scan.volumeRatio,
            changePercent: scan.changePercent,
          },
        });
      }

      const sprint = picks
        .filter((p) => p.horizons.some((h) => h.horizon === "sprint"))
        .sort((a, b) => {
          const aScore = a.horizons.find((h) => h.horizon === "sprint")!.score;
          const bScore = b.horizons.find((h) => h.horizon === "sprint")!.score;
          return bScore - aScore;
        })
        .slice(0, 10);

      const marathon = picks
        .filter((p) => p.horizons.some((h) => h.horizon === "marathon"))
        .sort((a, b) => {
          const aScore = a.horizons.find((h) => h.horizon === "marathon")!.score;
          const bScore = b.horizons.find((h) => h.horizon === "marathon")!.score;
          return bScore - aScore;
        })
        .slice(0, 10);

      const legacy = picks
        .filter((p) => p.horizons.some((h) => h.horizon === "legacy"))
        .sort((a, b) => {
          const aScore = a.horizons.find((h) => h.horizon === "legacy")!.score;
          const bScore = b.horizons.find((h) => h.horizon === "legacy")!.score;
          return bScore - aScore;
        })
        .slice(0, 10);

      return NextResponse.json({
        sprint,
        marathon,
        legacy,
        scanned: allScans.length,
        totalBuySignals: buySignals.length,
        totalPicks: picks.length,
      });
    }

    if (mode === "market-scan") {
      const topTickers = DEFAULT_WATCHLIST.slice(0, 20);

      const [scanResults, discovered] = await Promise.all([
        scanMarket(topTickers),
        discoverOpportunities().catch(() => []),
      ]);

      const ranked = rankSignals(scanResults);
      const discoveryMap = new Map<string, { source: string; reason: string; urgency: number }>();
      for (const d of discovered) {
        discoveryMap.set(d.ticker, { source: d.source, reason: d.reason, urgency: d.urgency });
      }

      const signals = ranked.map((s) => {
        const disc = discoveryMap.get(s.ticker);
        return {
          ticker: s.ticker,
          price: s.price,
          action: s.action,
          score: s.score,
          confidence: s.confidence,
          strategy: s.strategy,
          stopLoss: s.stopLoss,
          takeProfit: s.takeProfit,
          indicators: s.signals.map((ind) => ({
            name: ind.name,
            score: ind.score,
            reason: ind.reason,
          })),
          discoveryInfo: disc || null,
        };
      });

      const discoveredNotScanned = discovered
        .filter((d) => !ranked.some((r) => r.ticker === d.ticker))
        .slice(0, 15);

      return NextResponse.json({
        signals,
        discovered: discoveredNotScanned,
        scanned: scanResults.length,
        total: ranked.length,
      });
    }

    const [macro] = await Promise.all([
      getMacroSnapshot().catch(() => null),
    ]);

    let insider = null;
    let analyst = null;
    let priceTarget = null;
    let technicals = null;

    if (ticker) {
      const [insiderData, analystData, priceTargetData, scanResult] = await Promise.all([
        getInsiderTrading(ticker, 10).catch(() => null),
        getRecommendations(ticker).catch(() => null),
        getPriceTarget(ticker).catch(() => null),
        scanStock(ticker).catch(() => null),
      ]);
      insider = insiderData;
      analyst = analystData;
      priceTarget = priceTargetData;

      if (scanResult) {
        const signal = generateSignals(scanResult);
        technicals = {
          ticker: signal.ticker,
          price: signal.price,
          action: signal.action,
          score: signal.score,
          confidence: signal.confidence,
          strategy: signal.strategy,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          indicators: signal.signals.map((ind) => ({
            name: ind.name,
            score: ind.score,
            reason: ind.reason,
          })),
          raw: {
            rsi: scanResult.rsi,
            macd: scanResult.macd,
            bollinger: scanResult.bollinger,
            sma20: scanResult.sma20,
            sma50: scanResult.sma50,
            ema9: scanResult.ema9,
            volumeRatio: scanResult.volumeRatio,
            atr: scanResult.atr,
            vwap: scanResult.vwap,
            weekReturn: scanResult.weekReturn,
            monthReturn: scanResult.monthReturn,
            changePercent: scanResult.changePercent,
          },
        };
      }
    }

    return NextResponse.json({
      macro,
      insider: insider || [],
      analyst: analyst || [],
      priceTarget,
      technicals,
      ticker,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
