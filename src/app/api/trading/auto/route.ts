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
      const configs = await prisma.tradingConfig.findMany({
        where: { enabled: true },
        select: { userId: true },
      });

      const results = [];
      for (const c of configs) {
        const startTime = Date.now();
        try {
          const result = await runTradingCycle(c.userId);
          const tradesExecuted = (result as any).tradesExecuted || 0;
          const signalsFound = (result as any).signalsFound || 0;
          await prisma.tradingConfig.update({
            where: { userId: c.userId },
            data: {
              lastCronAt: new Date(),
              lastCronResult: `OK in ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
              lastCronTrades: tradesExecuted,
              lastCronSignals: signalsFound,
              cronRunCount: { increment: 1 },
            },
          });
          results.push({ userId: c.userId, ...result });
        } catch (err: any) {
          await prisma.tradingConfig.update({
            where: { userId: c.userId },
            data: {
              lastCronAt: new Date(),
              lastCronResult: `ERROR: ${err.message?.slice(0, 200)}`,
              cronRunCount: { increment: 1 },
            },
          });
          results.push({ userId: c.userId, error: err.message });
        }
      }

      return NextResponse.json({ results, ranAt: new Date().toISOString() });
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
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    return NextResponse.json({ ...config, isPro: user?.role === "ADMIN" });
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

  if (action === "cron-status") {
    const config = await prisma.tradingConfig.findUnique({
      where: { userId },
      select: {
        lastCronAt: true,
        lastCronResult: true,
        lastCronTrades: true,
        lastCronSignals: true,
        cronRunCount: true,
        enabled: true,
      },
    });
    if (!config) {
      return NextResponse.json({ configured: false });
    }

    const lastCronAt = config.lastCronAt ? new Date(config.lastCronAt) : null;
    const minutesAgo = lastCronAt ? Math.round((Date.now() - lastCronAt.getTime()) / 60000) : null;

    const nowUtc = new Date();
    const utcHour = nowUtc.getUTCHours();
    const utcDay = nowUtc.getUTCDay();
    const isMarketHoursUtc = utcDay >= 1 && utcDay <= 5 && utcHour >= 13 && utcHour <= 20;
    const isWeekday = utcDay >= 1 && utcDay <= 5;

    let status: "active" | "stale" | "inactive" | "sleeping" = "inactive";
    if (lastCronAt != null && minutesAgo != null) {
      if (minutesAgo < 75) {
        status = "active";
      } else if (!isMarketHoursUtc && isWeekday && minutesAgo < 24 * 60) {
        status = "sleeping";
      } else if (!isWeekday && minutesAgo < 3 * 24 * 60) {
        status = "sleeping";
      } else {
        status = "inactive";
      }
    }

    return NextResponse.json({
      configured: true,
      enabled: config.enabled,
      status,
      lastRunAt: config.lastCronAt?.toISOString() || null,
      lastResult: config.lastCronResult || null,
      lastTrades: config.lastCronTrades,
      lastSignals: config.lastCronSignals,
      totalRuns: config.cronRunCount,
      minutesAgo,
    });
  }

  if (action === "accuracy") {
    const window = req.nextUrl.searchParams.get("window") || "month";
    const config = await prisma.tradingConfig.findUnique({ where: { userId }, select: { mode: true } });
    const mode = config?.mode || "PAPER";

    const now = new Date();
    let since: Date;
    if (window === "week") {
      since = new Date(now.getTime() - 7 * 86400000);
    } else if (window === "year") {
      since = new Date(now.getTime() - 365 * 86400000);
    } else {
      since = new Date(now.getTime() - 30 * 86400000);
    }

    const trades = await prisma.autoTrade.findMany({
      where: { userId, status: "CLOSED", mode, exitAt: { gte: since } },
      select: { ticker: true, pnl: true, entryPrice: true, exitPrice: true, qty: true, strategy: true, exitAt: true, entryAt: true },
      orderBy: { exitAt: "desc" },
    });

    const totalTrades = trades.length;
    const winners = trades.filter((t) => (t.pnl || 0) > 0);
    const losers = trades.filter((t) => (t.pnl || 0) <= 0);
    const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
    const winRate = totalTrades > 0 ? (winners.length / totalTrades) * 100 : 0;
    const avgReturn = totalTrades > 0 ? totalPnl / totalTrades : 0;

    let bestPick = null;
    let worstPick = null;
    if (trades.length > 0) {
      const sorted = [...trades].sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      bestPick = { ticker: best.ticker, pnl: Math.round((best.pnl || 0) * 100) / 100 };
      worstPick = { ticker: worst.ticker, pnl: Math.round((worst.pnl || 0) * 100) / 100 };
    }

    const strategyBreakdown: Record<string, { wins: number; losses: number; pnl: number }> = {};
    for (const t of trades) {
      const strat = t.strategy || "Unknown";
      if (!strategyBreakdown[strat]) strategyBreakdown[strat] = { wins: 0, losses: 0, pnl: 0 };
      if ((t.pnl || 0) > 0) strategyBreakdown[strat].wins++;
      else strategyBreakdown[strat].losses++;
      strategyBreakdown[strat].pnl += t.pnl || 0;
    }

    return NextResponse.json({
      window,
      totalTrades,
      winners: winners.length,
      losers: losers.length,
      winRate: Math.round(winRate * 10) / 10,
      totalPnl: Math.round(totalPnl * 100) / 100,
      avgReturn: Math.round(avgReturn * 100) / 100,
      bestPick,
      worstPick,
      strategyBreakdown: Object.entries(strategyBreakdown).map(([strategy, data]) => ({
        strategy,
        ...data,
        pnl: Math.round(data.pnl * 100) / 100,
        winRate: Math.round(((data.wins / (data.wins + data.losses)) * 100) * 10) / 10,
      })),
      recentTrades: trades.slice(0, 10).map((t) => ({
        ticker: t.ticker,
        pnl: Math.round((t.pnl || 0) * 100) / 100,
        strategy: t.strategy,
        exitAt: t.exitAt?.toISOString(),
      })),
    });
  }

  if (action === "equity-history") {
    const config = await prisma.tradingConfig.findUnique({ where: { userId }, select: { mode: true, paperBalance: true, createdAt: true } });
    const mode = config?.mode || "PAPER";
    const paperBalance = config?.paperBalance || 10000;

    const closedTrades = await prisma.autoTrade.findMany({
      where: { userId, status: "CLOSED", mode },
      select: { pnl: true, exitAt: true, entryAt: true },
      orderBy: { exitAt: "asc" },
    });

    const openTrades = await prisma.autoTrade.findMany({
      where: { userId, status: "OPEN", mode },
      select: { entryPrice: true, qty: true, ticker: true, entryAt: true },
    });

    const startDate = config?.createdAt || new Date();
    const points: { date: string; equity: number }[] = [];
    points.push({ date: new Date(startDate).toISOString().slice(0, 10), equity: paperBalance });

    let cumulativePnl = 0;
    const dayMap = new Map<string, number>();
    for (const t of closedTrades) {
      if (!t.exitAt) continue;
      const day = new Date(t.exitAt).toISOString().slice(0, 10);
      cumulativePnl += t.pnl || 0;
      dayMap.set(day, paperBalance + cumulativePnl);
    }

    for (const [day, eq] of dayMap.entries()) {
      points.push({ date: day, equity: Math.round(eq * 100) / 100 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const lastEquity = points[points.length - 1]?.equity || paperBalance;
    if (!dayMap.has(today)) {
      points.push({ date: today, equity: Math.round(lastEquity * 100) / 100 });
    }

    return NextResponse.json({ points, openPositions: openTrades.length });
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
  if (body.recommendedTickers !== undefined) updates.recommendedTickers = body.recommendedTickers;
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
