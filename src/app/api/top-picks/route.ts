import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { generateConvictionPicks, updatePickPerformance } from "@/lib/trading/conviction";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get("action");

  if (action === "history") {
    const picks = await prisma.convictionPick.findMany({
      orderBy: { pickedAt: "desc" },
      take: 100,
    });

    const batches = new Map<string, typeof picks>();
    for (const pick of picks) {
      const key = pick.pickedAt.toISOString().slice(0, 10);
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key)!.push(pick);
    }

    const history = [...batches.entries()].map(([date, batchPicks]) => {
      const avgReturn = batchPicks.reduce((s, p) => s + (p.returnPct || 0), 0) / batchPicks.length;
      const profitable = batchPicks.filter((p) => (p.returnPct || 0) > 0).length;

      return {
        date,
        picks: batchPicks.sort((a, b) => a.rank - b.rank).map((p) => ({
          ticker: p.ticker,
          companyName: p.companyName,
          rank: p.rank,
          conviction: p.conviction,
          currentPrice: p.currentPrice,
          targetPrice: p.targetPrice,
          latestPrice: p.latestPrice,
          returnPct: p.returnPct != null ? Math.round(p.returnPct * 100) / 100 : null,
          peakReturnPct: p.peakReturnPct != null ? Math.round(p.peakReturnPct * 100) / 100 : null,
          holdPeriod: p.holdPeriod,
          holdLabel: p.holdLabel,
          sector: p.sector,
          signals: p.signals,
        })),
        avgReturn: Math.round(avgReturn * 100) / 100,
        profitable,
        total: batchPicks.length,
        hitRate: Math.round((profitable / batchPicks.length) * 100),
      };
    });

    return NextResponse.json({ history });
  }

  if (action === "update-performance") {
    const result = await updatePickPerformance();
    return NextResponse.json(result);
  }

  const latestPick = await prisma.convictionPick.findFirst({
    orderBy: { pickedAt: "desc" },
    select: { pickedAt: true },
  });

  if (!latestPick) {
    return NextResponse.json({ picks: [], generatedAt: null });
  }

  const latestDate = latestPick.pickedAt;
  const picks = await prisma.convictionPick.findMany({
    where: {
      pickedAt: {
        gte: new Date(latestDate.getTime() - 60000),
        lte: new Date(latestDate.getTime() + 60000),
      },
    },
    orderBy: { rank: "asc" },
  });

  const enrichedPicks = picks.map((p) => ({
    ...p,
    upsidePct: p.currentPrice > 0 ? Math.round(((p.targetPrice - p.currentPrice) / p.currentPrice) * 100 * 10) / 10 : 0,
    returnPct: p.returnPct != null ? Math.round(p.returnPct * 100) / 100 : null,
    peakReturnPct: p.peakReturnPct != null ? Math.round(p.peakReturnPct * 100) / 100 : null,
  }));

  return NextResponse.json({
    picks: enrichedPicks,
    generatedAt: latestDate.toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const picks = await generateConvictionPicks();

  return NextResponse.json({
    picks,
    generatedAt: new Date().toISOString(),
  });
}
