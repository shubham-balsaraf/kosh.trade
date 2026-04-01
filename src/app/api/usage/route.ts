import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

const FREE_LIMIT = 15;
const PRO_LIMIT = 999;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const isPro = user.role === "ADMIN" || user.tier === "PRO";

  const count = await prisma.searchHistory.count({
    where: { userId: user.id },
  });

  return NextResponse.json({
    used: count,
    limit: isPro ? PRO_LIMIT : FREE_LIMIT,
    isPro,
  });
}
