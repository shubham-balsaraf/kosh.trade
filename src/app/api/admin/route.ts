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

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      tier: true,
      role: true,
      image: true,
      bannedUntil: true,
      createdAt: true,
      _count: { select: { autoTrades: true, searchHistory: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalUsers = users.length;
  const proUsers = users.filter((u) => u.tier === "PRO" || u.role === "ADMIN").length;

  return NextResponse.json({ users, totalUsers, proUsers });
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
      data: { tier: "FREE", bannedUntil: new Date("2099-12-31") },
      select: { id: true, email: true, tier: true, bannedUntil: true },
    });
    return NextResponse.json(updated);
  }

  if (action === "unrestrict-user") {
    const { userId } = body;
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { bannedUntil: null },
      select: { id: true, email: true, tier: true, bannedUntil: true },
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
