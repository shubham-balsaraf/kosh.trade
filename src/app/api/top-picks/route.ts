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
          dataConfidence: p.dataConfidence,
          currentPrice: p.currentPrice,
          targetPrice: p.targetPrice,
          latestPrice: p.latestPrice,
          returnPct: p.returnPct != null ? Math.round(p.returnPct * 100) / 100 : null,
          peakReturnPct: p.peakReturnPct != null ? Math.round(p.peakReturnPct * 100) / 100 : null,
          holdPeriod: p.holdPeriod,
          holdLabel: p.holdLabel,
          holdDays: p.holdDays,
          sector: p.sector,
          signals: p.signals,
          outcome: p.outcome,
          hitTarget: p.hitTarget,
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

  if (action === "algo-stats") {
    const allPicks = await prisma.convictionPick.findMany({
      where: { pickedAt: { gte: new Date(Date.now() - 365 * 86400000) } },
      orderBy: { pickedAt: "desc" },
    });

    const tracked = allPicks.filter((p) => p.returnPct != null);
    const totalPicks = tracked.length;
    const winners = tracked.filter((p) => (p.returnPct || 0) > 0);
    const targetHits = tracked.filter((p) => p.hitTarget);
    const timelineHits = tracked.filter((p) => p.withinTimeline === true);
    const avgReturn = totalPicks > 0
      ? tracked.reduce((s, p) => s + (p.returnPct || 0), 0) / totalPicks : 0;
    const avgPeakReturn = totalPicks > 0
      ? tracked.reduce((s, p) => s + (p.peakReturnPct || 0), 0) / totalPicks : 0;
    const avgConfidence = totalPicks > 0
      ? tracked.reduce((s, p) => s + (p.dataConfidence || 0), 0) / totalPicks : 0;

    const outcomes: Record<string, number> = { BULLSEYE: 0, LATE_HIT: 0, WINNER: 0, MISS: 0, TRACKING: 0 };
    for (const p of tracked) {
      const o = p.outcome || "TRACKING";
      outcomes[o] = (outcomes[o] || 0) + 1;
    }

    const notableCalls = targetHits
      .filter((p) => p.hitTargetAt)
      .map((p) => {
        const hitDays = Math.floor(
          (new Date(p.hitTargetAt!).getTime() - new Date(p.pickedAt).getTime()) / 86400000
        );
        return {
          ticker: p.ticker,
          companyName: p.companyName,
          predictedTarget: p.targetPrice,
          entryPrice: p.currentPrice,
          peakReturn: Math.round((p.peakReturnPct || 0) * 100) / 100,
          hitDays,
          outcome: p.outcome,
          pickedAt: p.pickedAt.toISOString().slice(0, 10),
        };
      })
      .sort((a, b) => b.peakReturn - a.peakReturn)
      .slice(0, 10);

    const notableMisses = tracked
      .filter((p) => p.outcome === "MISS")
      .map((p) => ({
        ticker: p.ticker,
        companyName: p.companyName,
        predictedTarget: p.targetPrice,
        entryPrice: p.currentPrice,
        returnPct: Math.round((p.returnPct || 0) * 100) / 100,
        pickedAt: p.pickedAt.toISOString().slice(0, 10),
      }))
      .sort((a, b) => a.returnPct - b.returnPct)
      .slice(0, 10);

    return NextResponse.json({
      totalPicks,
      winRate: totalPicks > 0 ? Math.round((winners.length / totalPicks) * 100) : 0,
      targetHitRate: totalPicks > 0 ? Math.round((targetHits.length / totalPicks) * 100) : 0,
      timelineAccuracy: targetHits.length > 0
        ? Math.round((timelineHits.length / targetHits.length) * 100) : 0,
      avgReturn: Math.round(avgReturn * 100) / 100,
      avgPeakReturn: Math.round(avgPeakReturn * 100) / 100,
      avgConfidence: Math.round(avgConfidence),
      outcomes,
      notableCalls,
      notableMisses,
    });
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
