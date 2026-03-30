import { NextRequest, NextResponse } from "next/server";
import { getEarningsCalendar as fmpEarnings } from "@/lib/api/fmp";
import { getEarningsCalendar as finnhubEarnings } from "@/lib/api/finnhub";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  try {
    const today = new Date();
    const from = today.toISOString().split("T")[0];
    const futureDate = new Date(today);
    futureDate.setMonth(futureDate.getMonth() + 6);
    const to = futureDate.toISOString().split("T")[0];

    const pastDate = new Date(today);
    pastDate.setFullYear(pastDate.getFullYear() - 2);
    const pastFrom = pastDate.toISOString().split("T")[0];

    const [upcomingAll, pastAll] = await Promise.all([
      finnhubEarnings(from, to).catch(() => ({ earningsCalendar: [] })),
      fmpEarnings(pastFrom, from).catch(() => []),
    ]);

    const upcoming = (upcomingAll?.earningsCalendar || [])
      .filter((e: any) => e.symbol === symbol)
      .slice(0, 4);

    const past = (pastAll || [])
      .filter((e: any) => e.symbol === symbol)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);

    const nextEarnings = upcoming.length > 0 ? upcoming[0] : null;

    return NextResponse.json({ nextEarnings, upcoming, past });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
