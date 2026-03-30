import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getStockScreener } from "@/lib/api/fmp";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const stocks = await getStockScreener({
      marketCapMoreThan: "1000000000",
      priceMoreThan: "5",
      volumeMoreThan: "100000",
      country: "US",
      exchange: "NASDAQ,NYSE",
      limit: "50",
    });

    const withDipScore = (stocks || [])
      .filter((s: any) => {
        if (!s.price || !s.yearHigh || !s.yearLow) return false;
        const distFromHigh = ((s.yearHigh - s.price) / s.yearHigh) * 100;
        return distFromHigh >= 15;
      })
      .map((s: any) => {
        const distFromHigh = ((s.yearHigh - s.price) / s.yearHigh) * 100;
        const distFromLow = s.yearLow > 0 ? ((s.price - s.yearLow) / s.yearLow) * 100 : 0;
        return {
          ticker: s.symbol,
          name: s.companyName,
          price: s.price,
          yearHigh: s.yearHigh,
          yearLow: s.yearLow,
          marketCap: s.marketCap,
          sector: s.sector,
          industry: s.industry,
          pe: s.pe,
          volume: s.volume,
          distFromHigh: +distFromHigh.toFixed(1),
          distFromLow: +distFromLow.toFixed(1),
          exchange: s.exchange,
        };
      })
      .sort((a: any, b: any) => b.distFromHigh - a.distFromHigh)
      .slice(0, 30);

    return NextResponse.json({ stocks: withDipScore });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
