import { NextRequest, NextResponse } from "next/server";
import { getEarnings, getEarningsCalendar } from "@/lib/api/fmp";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  try {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setMonth(futureDate.getMonth() + 6);
    const from = today.toISOString().split("T")[0];
    const to = futureDate.toISOString().split("T")[0];

    const [earningsHistory, upcomingAll] = await Promise.all([
      getEarnings(symbol).catch((e: any) => {
        console.error(`[Earnings API] history ${symbol}:`, e.message);
        return [];
      }),
      getEarningsCalendar(from, to).catch((e: any) => {
        console.error(`[Earnings API] calendar ${symbol}:`, e.message);
        return [];
      }),
    ]);

    const past = (earningsHistory || [])
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)
      .map((e: any) => ({
        date: e.date,
        eps: e.epsActual ?? e.eps ?? e.actualEarningResult ?? null,
        epsEstimated: e.epsEstimated ?? e.estimatedEarning ?? null,
        revenue: e.revenueActual ?? e.revenue ?? null,
        revenueEstimated: e.revenueEstimated ?? null,
        fiscalDateEnding: e.fiscalDateEnding ?? null,
        time: e.time ?? null,
      }));

    const upcoming = (upcomingAll || [])
      .filter((e: any) => e.symbol === symbol)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 4)
      .map((e: any) => ({
        date: e.date,
        epsEstimated: e.epsEstimated ?? e.estimate ?? null,
        revenueEstimated: e.revenueEstimated ?? null,
        time: e.time ?? null,
        fiscalDateEnding: e.fiscalDateEnding ?? null,
      }));

    const nextEarnings = upcoming.length > 0 ? upcoming[0] : null;

    return NextResponse.json({ nextEarnings, upcoming, past });
  } catch (e: any) {
    console.error(`[Earnings API] ${symbol}:`, e.message);
    return NextResponse.json({ nextEarnings: null, upcoming: [], past: [], error: e.message }, { status: 200 });
  }
}
