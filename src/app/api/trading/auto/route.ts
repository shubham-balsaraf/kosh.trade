import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { runTradingCycle, runDailyBriefing, runDailySummary } from "@/lib/trading/engine";

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  const isCron = cronSecret === process.env.CRON_SECRET;

  let userId: string | null = null;

  if (isCron) {
    const body = await req.json().catch(() => ({}));
    userId = body.userId || null;

    if (!userId) {
      // Run for all enabled users
      const configs = await prisma.tradingConfig.findMany({
        where: { enabled: true },
        select: { userId: true },
      });

      const results = [];
      for (const c of configs) {
        const result = await runTradingCycle(c.userId);
        results.push({ userId: c.userId, ...result });
      }

      return NextResponse.json({ results });
    }
  } else {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = (session.user as any).id;
  }

  if (!userId) {
    return NextResponse.json({ error: "No user specified" }, { status: 400 });
  }

  const action = req.nextUrl.searchParams.get("action");

  if (action === "briefing") {
    const briefing = await runDailyBriefing(userId);
    return NextResponse.json({ briefing });
  }

  if (action === "summary") {
    await runDailySummary(userId);
    return NextResponse.json({ sent: true });
  }

  const existingConfig = await prisma.tradingConfig.findUnique({ where: { userId } });
  if (!existingConfig) {
    return NextResponse.json({ status: "ERROR", reason: "Please complete KoshPilot setup first" });
  }
  if (!existingConfig.enabled) {
    await prisma.tradingConfig.update({ where: { userId }, data: { enabled: true } });
  }

  const result = await runTradingCycle(userId);
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const action = req.nextUrl.searchParams.get("action");

  if (action === "config") {
    const config = await prisma.tradingConfig.findUnique({ where: { userId } });
    if (!config) {
      return NextResponse.json({ setup: false });
    }
    return NextResponse.json(config);
  }

  if (action === "trades") {
    const status = req.nextUrl.searchParams.get("status") || undefined;
    const modeParam = req.nextUrl.searchParams.get("mode") as any;
    const config = await prisma.tradingConfig.findUnique({ where: { userId }, select: { mode: true } });
    const mode = modeParam || config?.mode || "PAPER";
    const trades = await prisma.autoTrade.findMany({
      where: { userId, mode, ...(status ? { status: status as any } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ trades });
  }

  if (action === "stats") {
    const config = await prisma.tradingConfig.findUnique({ where: { userId }, select: { mode: true, paperBalance: true, weeklyTargetPct: true } });
    const mode = config?.mode || "PAPER";
    const allTrades = await prisma.autoTrade.findMany({
      where: { userId, status: "CLOSED", mode },
      select: { pnl: true, entryPrice: true, exitPrice: true, strategy: true, exitAt: true },
    });

    const totalTrades = allTrades.length;
    const winners = allTrades.filter((t) => (t.pnl || 0) > 0).length;
    const totalPnl = allTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const winRate = totalTrades > 0 ? (winners / totalTrades) * 100 : 0;
    const avgPnl = totalTrades > 0 ? totalPnl / totalTrades : 0;

    const openTrades = await prisma.autoTrade.count({
      where: { userId, status: "OPEN", mode },
    });

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weeklyPnl = allTrades
      .filter((t) => t.exitAt && new Date(t.exitAt) >= weekStart)
      .reduce((s, t) => s + (t.pnl || 0), 0);

    const paperBalance = config?.paperBalance || 10000;
    const weeklyTargetPct = config?.weeklyTargetPct || 10;
    const weeklyTargetDollars = paperBalance * (weeklyTargetPct / 100);
    const weeklyProgressPct = weeklyTargetDollars > 0 ? (weeklyPnl / weeklyTargetDollars) * 100 : 0;

    return NextResponse.json({
      totalTrades,
      winners,
      losers: totalTrades - winners,
      winRate: Math.round(winRate * 10) / 10,
      totalPnl: Math.round(totalPnl * 100) / 100,
      avgPnl: Math.round(avgPnl * 100) / 100,
      openPositions: openTrades,
      weeklyPnl: Math.round(weeklyPnl * 100) / 100,
      weeklyTargetDollars: Math.round(weeklyTargetDollars * 100) / 100,
      weeklyProgressPct: Math.round(weeklyProgressPct * 10) / 10,
    });
  }

  return NextResponse.json({ error: "Missing action param" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const body = await req.json();
  const updates: any = {};

  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.mode !== undefined) updates.mode = body.mode;
  if (body.paperBalance !== undefined) updates.paperBalance = body.paperBalance;
  if (body.maxPositionPct !== undefined) updates.maxPositionPct = body.maxPositionPct;
  if (body.maxDailyLossPct !== undefined) updates.maxDailyLossPct = body.maxDailyLossPct;
  if (body.maxOpenPositions !== undefined) updates.maxOpenPositions = body.maxOpenPositions;
  if (body.riskProfile !== undefined) updates.riskProfile = body.riskProfile;
  if (body.weeklyTargetPct !== undefined) updates.weeklyTargetPct = body.weeklyTargetPct;
  if (body.watchlist !== undefined) updates.watchlist = body.watchlist;
  if (body.strategies !== undefined) updates.strategies = body.strategies;

  const config = await prisma.tradingConfig.upsert({
    where: { userId },
    create: { userId, ...updates },
    update: updates,
  });

  return NextResponse.json(config);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  await prisma.tradingConfig.deleteMany({ where: { userId } });
  return NextResponse.json({ deleted: true });
}
