import { NextRequest, NextResponse } from "next/server";
import { getCashFlow } from "@/lib/api/fmp";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();
  const period = req.nextUrl.searchParams.get("period") || "annual";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");

  try {
    const data = await getCashFlow(symbol, period as "annual" | "quarter", limit);
    
    const formatted = (data || []).reverse().map((item: any) => ({
      date: item.date,
      period: item.period,
      freeCashFlow: item.freeCashFlow || 0,
      fcfPerShare: item.freeCashFlow && item.weightedAverageShsOutDil
        ? item.freeCashFlow / item.weightedAverageShsOutDil
        : 0,
      stockBasedCompensation: item.stockBasedCompensation || 0,
      sharesOutstanding: item.weightedAverageShsOutDil || 0,
      operatingCashFlow: item.operatingCashFlow || 0,
      capitalExpenditure: item.capitalExpenditure || 0,
    }));

    return NextResponse.json({ data: formatted });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
