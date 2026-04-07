import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getInsiderTrading } from "@/lib/api/fmp";
import { getRecommendations, getPriceTarget } from "@/lib/api/finnhub";
import { getMacroSnapshot } from "@/lib/signals/macroRegime";
import { scanStock, scanMarket, DEFAULT_WATCHLIST } from "@/lib/trading/scanner";
import { generateSignals, rankSignals } from "@/lib/trading/signals";
import { discoverOpportunities, getRawSignals } from "@/lib/trading/discovery";
import { generateMarketNarratives } from "@/lib/trading/ai-analyst";
import { generateOraclePicks } from "@/lib/trading/buffett";
import type { ScanResult } from "@/lib/trading/scanner";
import type { TradeSignal } from "@/lib/trading/signals";

export const maxDuration = 300;

const CORE_BASELINE = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA",
  "JPM", "BRK-B", "UNH", "XOM", "SPY", "QQQ",
  "BTC-USD", "ETH-USD",
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
    // Signal Intelligence — LLM-generated narratives from raw market signals
    if (mode === "signal-intelligence") {
      console.log("[Signals] Running signal intelligence pipeline...");

      // Step 1: Always scan core stocks via Yahoo (never fails)
      const INTEL_UNIVERSE = [
        "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD",
        "JPM", "GS", "UNH", "LLY", "XOM", "CVX", "LMT",
        "WMT", "COST", "NFLX", "AVGO", "CRM", "PLTR",
        "BTC-USD", "ETH-USD", "SOL-USD",
        "SPY", "QQQ",
      ];

      let rawSignals: Awaited<ReturnType<typeof getRawSignals>>;
      try {
        rawSignals = await getRawSignals();
        console.log(`[Signals] Raw signals: ${rawSignals.news.length} news, ${rawSignals.insiderBuys.length} insider, ${rawSignals.congressBuys.length} congress, ${rawSignals.screenerMoves.length} movers, ${rawSignals.earnings.length} earnings, ${rawSignals.grades.length} grades, ${rawSignals.pressReleases.length} press, ${rawSignals.mergers.length} M&A, ${rawSignals.institutional.length} institutional, ${rawSignals.filings8k.length} 8K`);
      } catch (e) {
        console.error("[Signals] getRawSignals failed:", e);
        rawSignals = {
          news: [], insiderBuys: [], congressBuys: [], screenerMoves: [], earnings: [],
          grades: [], pressReleases: [], sectorPerformance: [], mergers: [],
          institutional: [], filings8k: [], cryptoNews: [], edgarFilings: [],
          socialSentiment: new Map(), finvizSnapshots: new Map(), fearGreed: null, trendingStocktwits: [],
          warnLayoffs: [],
        };
      }

      // Step 2: If FMP data is thin, enrich with Yahoo Finance scans
      const hasSignalData = rawSignals.news.length + rawSignals.insiderBuys.length +
        rawSignals.congressBuys.length + rawSignals.screenerMoves.length + rawSignals.earnings.length +
        rawSignals.grades.length + rawSignals.pressReleases.length + rawSignals.mergers.length +
        rawSignals.institutional.length + rawSignals.filings8k.length;

      let baselineScans: ScanResult[] = [];
      try {
        baselineScans = await scanMarket(INTEL_UNIVERSE);
        console.log(`[Signals] Yahoo baseline: ${baselineScans.length} stocks scanned`);
      } catch (e) {
        console.error("[Signals] Yahoo baseline scan failed:", e);
      }

      // Enrich screenerMoves from Yahoo data if FMP gave us very few
      if (rawSignals.screenerMoves.length < 5 && baselineScans.length > 0) {
        const sorted = [...baselineScans].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
        const existingTickers = new Set(rawSignals.screenerMoves.map((s) => s.ticker));
        for (const s of sorted.slice(0, 16)) {
          if (existingTickers.has(s.ticker)) continue;
          rawSignals.screenerMoves.push({
            ticker: s.ticker,
            changePct: s.changePercent,
            volume: 0,
            direction: s.changePercent >= 0 ? "gainer" : "loser",
          });
        }
        console.log(`[Signals] Enriched screener with Yahoo movers → total ${rawSignals.screenerMoves.length}`);
      }

      // Step 3: Generate narratives
      let narratives: Awaited<ReturnType<typeof generateMarketNarratives>>;
      try {
        narratives = await generateMarketNarratives(rawSignals);
        console.log(`[Signals] Narratives generated: ${narratives.length}`);
      } catch (e) {
        console.error("[Signals] generateMarketNarratives failed:", e);
        narratives = [];
      }

      // Step 4: Build technicals map from baseline scans + any narrative tickers
      let tickerTechnicals: Record<string, any> = {};
      for (const scan of baselineScans) {
        const sig = generateSignals(scan);
        tickerTechnicals[scan.ticker] = {
          price: sig.price,
          action: sig.action,
          score: sig.score,
          confidence: sig.confidence,
          strategy: sig.strategy,
          rsi: scan.rsi,
          changePercent: scan.changePercent,
          volumeRatio: scan.volumeRatio,
        };
      }

      // Scan any narrative tickers not already covered
      const extraTickers = new Set<string>();
      for (const n of narratives) {
        for (const t of [...n.affectedTickers, ...n.triggerTickers]) {
          if (!tickerTechnicals[t]) extraTickers.add(t);
        }
      }
      if (extraTickers.size > 0) {
        try {
          const extraScans = await scanMarket([...extraTickers].slice(0, 15));
          for (const scan of extraScans) {
            const sig = generateSignals(scan);
            tickerTechnicals[scan.ticker] = {
              price: sig.price,
              action: sig.action,
              score: sig.score,
              confidence: sig.confidence,
              strategy: sig.strategy,
              rsi: scan.rsi,
              changePercent: scan.changePercent,
              volumeRatio: scan.volumeRatio,
            };
          }
        } catch (e) {
          console.error("[Signals] Extra ticker scan failed:", e);
        }
      }

      const signalCounts = {
        news: rawSignals.news.filter((n) => n.urgency >= 5).length,
        insider: rawSignals.insiderBuys.length,
        congress: rawSignals.congressBuys.length,
        screener: rawSignals.screenerMoves.length,
        earnings: rawSignals.earnings.length,
        grades: rawSignals.grades.length,
        press: rawSignals.pressReleases.length,
        sectors: rawSignals.sectorPerformance.length,
        mergers: rawSignals.mergers.length,
        institutional: rawSignals.institutional.length,
        filings: rawSignals.filings8k.length,
        crypto: rawSignals.cryptoNews?.length || 0,
        warnLayoffs: rawSignals.warnLayoffs?.length || 0,
      };

      const totalTickers = new Set([
        ...Object.keys(tickerTechnicals),
        ...narratives.flatMap((n) => [...n.affectedTickers, ...n.triggerTickers]),
      ]).size;

      console.log(`[Signals] Intelligence complete: ${narratives.length} narratives, ${totalTickers} tickers, ${Object.keys(tickerTechnicals).length} with technicals`);

      return NextResponse.json({
        narratives,
        tickerTechnicals,
        signalCounts,
        totalSignals: Object.values(signalCounts).reduce((a, b) => a + b, 0),
        totalTickers: totalTickers,
      });
    }

    // Best Picks — SIGNAL-FIRST: discover stocks from signals, then analyze
    if (mode === "best-picks") {
      console.log("[Signals] Running signal-first best picks pipeline...");

      const [discovered, rawSignals] = await Promise.all([
        discoverOpportunities().catch((e) => { console.error("[BestPicks] discoverOpportunities failed:", e); return []; }),
        getRawSignals().catch((e) => {
          console.error("[BestPicks] getRawSignals failed:", e);
          return {
            news: [] as any[], insiderBuys: [] as any[], congressBuys: [] as any[],
            screenerMoves: [] as any[], earnings: [] as any[],
            grades: [] as any[], pressReleases: [] as any[], sectorPerformance: [] as any[],
            mergers: [] as any[], institutional: [] as any[], filings8k: [] as any[], cryptoNews: [] as any[],
          };
        }),
      ]);

      // Step 1: Derive tickers from ALL signal sources
      const signalDerived = new Set<string>();
      for (const d of discovered) signalDerived.add(d.ticker);
      for (const m of rawSignals.screenerMoves) signalDerived.add(m.ticker);
      for (const i of rawSignals.insiderBuys) signalDerived.add(i.ticker);
      for (const c of rawSignals.congressBuys) signalDerived.add(c.ticker);
      for (const e of rawSignals.earnings) signalDerived.add(e.ticker);
      for (const n of rawSignals.news) { if (n.ticker) signalDerived.add(n.ticker); }
      for (const g of (rawSignals.grades || [])) signalDerived.add(g.ticker);
      for (const pr of (rawSignals.pressReleases || [])) signalDerived.add(pr.ticker);
      for (const m of (rawSignals.mergers || [])) signalDerived.add(m.ticker);
      for (const f of (rawSignals.institutional || [])) signalDerived.add(f.ticker);
      for (const f of (rawSignals.filings8k || [])) signalDerived.add(f.ticker);

      // Step 2: Add core baseline for coverage
      for (const t of CORE_BASELINE) signalDerived.add(t);

      const tickersToScan = [...signalDerived].slice(0, 60);
      console.log(`[Signals] Signal-derived: ${signalDerived.size} tickers (${tickersToScan.length} will be scanned)`);

      // Step 3: Run technicals on signal-derived stocks
      const scanResults = await scanMarket(tickersToScan);
      const allSignals = scanResults.map(generateSignals);
      const buySignals = allSignals.filter(
        (s) => s.action === "BUY" || s.action === "STRONG_BUY"
      );

      const scanMap = new Map<string, ScanResult>();
      for (const s of scanResults) scanMap.set(s.ticker, s);

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
        scanned: scanResults.length,
        totalBuySignals: buySignals.length,
        totalPicks: picks.length,
        signalDerived: signalDerived.size,
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

    if (mode === "oracle-picks") {
      let rawSignals = null;
      try {
        rawSignals = await getRawSignals();
      } catch (e) {
        console.warn("[Signals/Oracle] getRawSignals failed:", (e as Error).message);
      }

      let picks: Awaited<ReturnType<typeof generateOraclePicks>> = [];
      let oracleErr: string | undefined;

      try {
        picks = await generateOraclePicks(rawSignals);
      } catch (e: any) {
        console.error("[Signals/Oracle] generateOraclePicks FAILED:", e.message, e.stack);
        oracleErr = "Oracle analysis failed — FMP data may be temporarily unavailable. Try again in a minute.";
      }

      if (picks.length === 0 && !oracleErr) {
        oracleErr = "No picks could be generated — FMP may be rate-limiting or returning incomplete data. Try again shortly.";
      }

      return NextResponse.json({
        picks,
        total: picks.length,
        ...(oracleErr ? { error: oracleErr } : {}),
        generatedAt: new Date().toISOString(),
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
    console.error("[Signals] Outer catch:", e.message, e.stack);
    return NextResponse.json(
      { error: "Something went wrong — please try again. If this persists, check the server logs." },
      { status: 500 },
    );
  }
}
