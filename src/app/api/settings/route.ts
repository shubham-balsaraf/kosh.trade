import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { requirePro } from "@/lib/auth/tierCheck";

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
    },
  });

  return NextResponse.json({
    tradingMode: user?.alpacaPaper !== false ? "PAPER" : "LIVE",
    hasAlpacaKeys: !!(user?.alpacaApiKey),
    tier: user?.tier,
    role: user?.role,
    createdAt: user?.createdAt,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const body = await req.json();
  const updates: Record<string, any> = {};

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
