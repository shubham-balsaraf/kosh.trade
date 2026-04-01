import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getInsiderTrading } from "@/lib/api/fmp";
import { getRecommendations, getPriceTarget } from "@/lib/api/finnhub";
import { getMacroSnapshot } from "@/lib/signals/macroRegime";
import { scanStock, scanMarket, DEFAULT_WATCHLIST } from "@/lib/trading/scanner";
import { generateSignals, rankSignals } from "@/lib/trading/signals";
import { discoverOpportunities } from "@/lib/trading/discovery";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ticker = req.nextUrl.searchParams.get("ticker");
  const mode = req.nextUrl.searchParams.get("mode");

  try {
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
