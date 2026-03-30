import { NextRequest, NextResponse } from "next/server";
import { getCashFlow, getIncomeStatement } from "@/lib/api/fmp";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();
  const period = req.nextUrl.searchParams.get("period") || "annual";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");

  try {
    const [cashData, incomeData] = await Promise.all([
      getCashFlow(symbol, period as "annual" | "quarter", limit).catch(() => []),
      getIncomeStatement(symbol, period as "annual" | "quarter", limit).catch(() => []),
    ]);

    const sharesMap: Record<string, number> = {};
    for (const inc of incomeData || []) {
      if (inc.date) {
        sharesMap[inc.date] = inc.weightedAverageShsOutDil || inc.weightedAverageShsOut || 0;
      }
    }

    const formatted = (cashData || []).reverse().map((item: any) => {
      const shares = sharesMap[item.date] || item.weightedAverageShsOutDil || item.weightedAverageShsOut || 0;
      return {
        date: item.date,
        period: item.period,
        freeCashFlow: item.freeCashFlow || 0,
        fcfPerShare: item.freeCashFlow && shares ? item.freeCashFlow / shares : 0,
        stockBasedCompensation: item.stockBasedCompensation || 0,
        sharesOutstanding: shares,
        operatingCashFlow: item.operatingCashFlow || 0,
        capitalExpenditure: item.capitalExpenditure || 0,
      };
    });

    return NextResponse.json({ data: formatted });
  } catch (e: any) {
    console.error(`[FCF API] ${symbol}:`, e.message);
    return NextResponse.json({ data: [], error: e.message }, { status: 200 });
  }
}
