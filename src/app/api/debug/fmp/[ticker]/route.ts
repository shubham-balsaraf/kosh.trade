import { NextRequest, NextResponse } from "next/server";
import { getQuote, getProfile, getIncomeStatement, getBalanceSheet, getCashFlow, getKeyMetrics, getRatios, getEarnings } from "@/lib/api/fmp";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  const results: Record<string, any> = {};

  const endpoints = [
    { name: "quote", fn: () => getQuote(symbol) },
    { name: "profile", fn: () => getProfile(symbol) },
    { name: "income", fn: () => getIncomeStatement(symbol, "annual", 2) },
    { name: "balance", fn: () => getBalanceSheet(symbol, "annual", 2) },
    { name: "cashflow", fn: () => getCashFlow(symbol, "annual", 2) },
    { name: "metrics", fn: () => getKeyMetrics(symbol, "annual", 2) },
    { name: "ratios", fn: () => getRatios(symbol, "annual", 2) },
    { name: "earnings", fn: () => getEarnings(symbol) },
  ];

  for (const ep of endpoints) {
    try {
      const data = await ep.fn();
      const sample = Array.isArray(data) ? data[0] : data;
      results[ep.name] = {
        status: "ok",
        count: Array.isArray(data) ? data.length : 1,
        fields: sample ? Object.keys(sample) : [],
        sample: sample || null,
      };
    } catch (e: any) {
      results[ep.name] = { status: "error", message: e.message };
    }
  }

  return NextResponse.json(results, { status: 200 });
}
