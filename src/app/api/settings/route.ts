import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { requirePro } from "@/lib/auth/tierCheck";
import argon2 from "argon2";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      alpacaPaper: true,
      alpacaApiKey: true,
      tier: true,
      role: true,
      createdAt: true,
      passwordHash: true,
      accounts: { select: { provider: true }, take: 1 },
    },
  });

  const isGoogleUser = user?.accounts?.some(
    (a: { provider: string }) => a.provider === "google"
  );

  return NextResponse.json({
    tradingMode: user?.alpacaPaper !== false ? "PAPER" : "LIVE",
    hasAlpacaKeys: !!user?.alpacaApiKey,
    tier: user?.tier,
    role: user?.role,
    createdAt: user?.createdAt,
    provider: isGoogleUser ? "google" : "credentials",
    hasPassword: !!user?.passwordHash,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const body = await req.json();
  const updates: Record<string, any> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 100);
    if (name) updates.name = name;
  }

  if (body.currentPassword && body.newPassword) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: "Password change is not available for this account" },
        { status: 400 }
      );
    }

    const valid = await argon2.verify(user.passwordHash, body.currentPassword);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    if (body.newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    updates.passwordHash = await argon2.hash(body.newPassword);
  }

  if (body.alpacaApiKey !== undefined) updates.alpacaApiKey = body.alpacaApiKey;
  if (body.alpacaSecretKey !== undefined) updates.alpacaSecretKey = body.alpacaSecretKey;

  if (body.tradingMode !== undefined) {
    if (body.tradingMode === "LIVE") {
      const { authorized } = await requirePro();
      if (!authorized) {
        return NextResponse.json(
          { error: "Live trading requires a Pro subscription" },
          { status: 403 }
        );
      }
    }
    updates.alpacaPaper = body.tradingMode !== "LIVE";
  }

  await prisma.user.update({ where: { id: userId }, data: updates });
  return NextResponse.json({ success: true });
}
