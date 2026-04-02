import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

const ADMIN_EMAIL = "balsarafshubham@gmail.com";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as any;
  if (user.role !== "ADMIN") return null;
  return user;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const action = req.nextUrl.searchParams.get("action");

  if (action === "settings") {
    let settings = await prisma.appSettings.findUnique({ where: { id: "global" } });
    if (!settings) {
      settings = await prisma.appSettings.create({ data: { id: "global" } });
    }
    return NextResponse.json(settings);
  }

  if (action === "user-activity") {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    const logs = await prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, action: true, detail: true, ip: true, userAgent: true, createdAt: true },
    });
    const loginCount = await prisma.activityLog.count({ where: { userId, action: "login" } });
    const lastLogin = await prisma.activityLog.findFirst({
      where: { userId, action: "login" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const featureViews = await prisma.activityLog.groupBy({
      by: ["detail"],
      where: { userId, action: "page_view" },
      _count: true,
    });
    return NextResponse.json({
      logs,
      loginCount,
      lastLogin: lastLogin?.createdAt || null,
      featureViews: featureViews.map((f) => ({ feature: f.detail, count: f._count })),
    });
  }

  if (action === "analytics") {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    const totalPageViews = await prisma.activityLog.count({
      where: { action: "page_view" },
    });
    const weekPageViews = await prisma.activityLog.count({
      where: { action: "page_view", createdAt: { gte: weekAgo } },
    });
    const totalLogins = await prisma.activityLog.count({
      where: { action: "login" },
    });
    const weekLogins = await prisma.activityLog.count({
      where: { action: "login", createdAt: { gte: weekAgo } },
    });

    const featureBreakdown = await prisma.activityLog.groupBy({
      by: ["detail"],
      where: { action: "page_view", detail: { not: null } },
      _count: true,
      orderBy: { _count: { detail: "desc" } },
    });

    const weekFeatureBreakdown = await prisma.activityLog.groupBy({
      by: ["detail"],
      where: { action: "page_view", detail: { not: null }, createdAt: { gte: weekAgo } },
      _count: true,
      orderBy: { _count: { detail: "desc" } },
    });

    const dailyActivity: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const count = await prisma.activityLog.count({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
      });
      dailyActivity.push({
        date: dayStart.toLocaleDateString("en-US", { weekday: "short" }),
        count,
      });
    }

    const activeUsersWeek = await prisma.activityLog.findMany({
      where: { createdAt: { gte: weekAgo } },
      distinct: ["userId"],
      select: { userId: true },
    });

    const topUsers = await prisma.activityLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: weekAgo } },
      _count: true,
      orderBy: { _count: { userId: "desc" } },
      take: 5,
    });
    const topUserIds = topUsers.map((t) => t.userId);
    const topUserDetails = await prisma.user.findMany({
      where: { id: { in: topUserIds } },
      select: { id: true, name: true, email: true },
    });
    const topUsersEnriched = topUsers.map((t) => {
      const u = topUserDetails.find((d) => d.id === t.userId);
      return { name: u?.name || u?.email || "Unknown", events: t._count };
    });

    return NextResponse.json({
      totalPageViews,
      weekPageViews,
      totalLogins,
      weekLogins,
      activeUsersWeek: activeUsersWeek.length,
      featureBreakdown: featureBreakdown.map((f) => ({ feature: f.detail, count: f._count })),
      weekFeatureBreakdown: weekFeatureBreakdown.map((f) => ({ feature: f.detail, count: f._count })),
      dailyActivity,
      topUsers: topUsersEnriched,
    });
  }

  if (action === "activity-feed") {
    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, action: true, detail: true, createdAt: true,
        user: { select: { name: true, email: true } },
      },
    });
    return NextResponse.json({ logs });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      tier: true,
      role: true,
      image: true,
      createdAt: true,
      _count: { select: { autoTrades: true, searchHistory: true, activityLogs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const lastLogins = await prisma.activityLog.findMany({
    where: { action: "login" },
    orderBy: { createdAt: "desc" },
    distinct: ["userId"],
    select: { userId: true, createdAt: true },
  });
  const lastLoginMap = new Map(lastLogins.map((l) => [l.userId, l.createdAt]));

  const totalUsers = users.length;
  const proUsers = users.filter((u) => u.tier === "PRO" || u.role === "ADMIN").length;

  const enriched = users.map((u) => ({
    ...u,
    lastLoginAt: lastLoginMap.get(u.id)?.toISOString() || null,
  }));

  return NextResponse.json({ users: enriched, totalUsers, proUsers });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { action } = body;

  if (action === "update-tier") {
    const { userId, tier } = body;
    if (!userId || !["FREE", "PRO"].includes(tier)) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (target?.email === ADMIN_EMAIL) {
      return NextResponse.json({ error: "Cannot modify admin tier" }, { status: 400 });
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { tier },
      select: { id: true, email: true, tier: true, role: true },
    });
    return NextResponse.json(updated);
  }

  if (action === "restrict-user") {
    const { userId } = body;
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (target?.email === ADMIN_EMAIL) {
      return NextResponse.json({ error: "Cannot restrict admin" }, { status: 400 });
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { tier: "FREE" },
      select: { id: true, email: true, tier: true },
    });
    return NextResponse.json(updated);
  }

  if (action === "unrestrict-user") {
    const { userId } = body;
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { tier: "PRO" },
      select: { id: true, email: true, tier: true },
    });
    return NextResponse.json(updated);
  }

  if (action === "toggle-gate") {
    const { enabled } = body;
    const settings = await prisma.appSettings.upsert({
      where: { id: "global" },
      update: { proGateEnabled: !!enabled },
      create: { id: "global", proGateEnabled: !!enabled },
    });
    return NextResponse.json(settings);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
