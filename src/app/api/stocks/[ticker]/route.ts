import { NextRequest, NextResponse } from "next/server";
import { getQuote, getProfile, getIncomeStatement, getBalanceSheet, getCashFlow, getKeyMetrics, getRatios } from "@/lib/api/fmp";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  try {
    if (!process.env.FMP_API_KEY) {
      return NextResponse.json({ error: "FMP_API_KEY is not configured. Add it to .env and restart." }, { status: 500 });
    }

    const [quote, profile, income, balance, cashflow, metrics, ratios] = await Promise.all([
      getQuote(symbol).catch((e: any) => { console.error(`[Stock API] quote ${symbol}:`, e.message); return null; }),
      getProfile(symbol).catch((e: any) => { console.error(`[Stock API] profile ${symbol}:`, e.message); return null; }),
      getIncomeStatement(symbol, "annual", 5).catch(() => []),
      getBalanceSheet(symbol, "annual", 5).catch(() => []),
      getCashFlow(symbol, "annual", 5).catch(() => []),
      getKeyMetrics(symbol, "annual", 5).catch(() => []),
      getRatios(symbol, "annual", 5).catch(() => []),
    ]);

    if (!quote && !profile) {
      return NextResponse.json({ error: "Stock not found" }, { status: 404 });
    }

    // FMP stable API quote doesn't include PE — compute from available data
    if (quote && !quote.pe) {
      const peFromRatios = ratios?.[0]?.priceEarningsRatio;
      if (peFromRatios && peFromRatios > 0) {
        quote.pe = peFromRatios;
      } else {
        const latestEps = income?.[0]?.epsdiluted;
        if (quote.price && latestEps && latestEps > 0) {
          quote.pe = quote.price / latestEps;
        }
      }
    }

    return NextResponse.json({
      quote,
      profile,
      income,
      balance,
      cashflow,
      metrics,
      ratios,
    });
  } catch (e: any) {
    console.error(`[Stock API] Error fetching ${symbol}:`, e.message);
    return NextResponse.json({ error: e.message || "Failed to fetch stock data" }, { status: 500 });
  }
}
