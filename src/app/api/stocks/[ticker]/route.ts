import { NextRequest, NextResponse } from "next/server";
import { getQuote, getProfile, getIncomeStatement, getBalanceSheet, getCashFlow, getKeyMetrics, getRatios } from "@/lib/api/fmp";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  try {
    const [quote, profile, income, balance, cashflow, metrics, ratios] = await Promise.all([
      getQuote(symbol).catch(() => null),
      getProfile(symbol).catch(() => null),
      getIncomeStatement(symbol, "annual", 5).catch(() => []),
      getBalanceSheet(symbol, "annual", 5).catch(() => []),
      getCashFlow(symbol, "annual", 5).catch(() => []),
      getKeyMetrics(symbol, "annual", 5).catch(() => []),
      getRatios(symbol, "annual", 5).catch(() => []),
    ]);

    if (!quote && !profile) {
      return NextResponse.json({ error: "Stock not found" }, { status: 404 });
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
