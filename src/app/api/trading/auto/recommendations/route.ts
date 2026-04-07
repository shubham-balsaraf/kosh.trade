import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { discoverOpportunities } from "@/lib/trading/discovery";
import {
  mergeRecommendedTickers,
  MAX_KOSHPILOT_RECOMMENDED_TICKERS,
} from "@/lib/trading/koshpilot-recommended";

/**
 * Merge tickers into KoshPilot's rolling recommended list (capped).
 * POST body: { source: "top10" } | { source: "discover", limit?: number }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const source = body.source as string;
  const limit = Math.min(Math.max(1, Number(body.limit) || 10), 20);

  const config = await prisma.tradingConfig.findUnique({ where: { userId } });
  if (!config) {
    return NextResponse.json({ error: "Complete KoshPilot setup first" }, { status: 400 });
  }

  let incoming: string[] = [];

  if (source === "top10") {
    const latestPick = await prisma.convictionPick.findFirst({
      orderBy: { pickedAt: "desc" },
      select: { pickedAt: true },
    });
    if (!latestPick) {
      return NextResponse.json(
        { error: "No Top 10 batch yet. Generate picks on Top Picks first." },
        { status: 404 },
      );
    }
    const t0 = latestPick.pickedAt.getTime();
    const picks = await prisma.convictionPick.findMany({
      where: {
        pickedAt: {
          gte: new Date(t0 - 60_000),
          lte: new Date(t0 + 60_000),
        },
      },
      orderBy: { rank: "asc" },
      select: { ticker: true },
    });
    incoming = picks.map((p) => p.ticker.toUpperCase());
    if (incoming.length === 0) {
      return NextResponse.json({ error: "Could not load latest Top 10 tickers" }, { status: 404 });
    }
  } else if (source === "discover") {
    const userWl = await prisma.watchlistItem.findMany({
      where: { userId },
      select: { ticker: true },
    });
    const skip = new Set<string>([
      ...config.watchlist.map((t) => t.toUpperCase()),
      ...userWl.map((w) => w.ticker.toUpperCase()),
      ...(config.recommendedTickers || []).map((t) => t.toUpperCase()),
    ]);
    try {
      const discovered = await discoverOpportunities();
      incoming = discovered
        .map((d) => d.ticker.toUpperCase())
        .filter((t) => t && !skip.has(t))
        .slice(0, limit);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "Discovery failed" }, { status: 500 });
    }
    if (incoming.length === 0) {
      return NextResponse.json({
        recommendedTickers: config.recommendedTickers || [],
        added: 0,
        message: "No new discovery tickers outside your watchlist and recommendations.",
      });
    }
  } else {
    return NextResponse.json({ error: 'Use source "top10" or "discover"' }, { status: 400 });
  }

  const merged = mergeRecommendedTickers(config.recommendedTickers, incoming);
  await prisma.tradingConfig.update({
    where: { userId },
    data: { recommendedTickers: merged },
  });

  return NextResponse.json({
    recommendedTickers: merged,
    added: incoming.length,
    max: MAX_KOSHPILOT_RECOMMENDED_TICKERS,
    source,
  });
}
