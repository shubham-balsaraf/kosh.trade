import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

const FREE_STOCK_LIMIT = 15;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const tier = (session.user as any).tier;
  const role = (session.user as any).role;
  const isPro = role === "ADMIN" || tier === "PRO";

  if (isPro) {
    return NextResponse.json({ isPro: true, limit: null, used: 0, remaining: null });
  }

  const uniqueStocks = await prisma.searchHistory.findMany({
    where: { userId },
    select: { ticker: true },
    distinct: ["ticker"],
  });

  const used = uniqueStocks.length;

  return NextResponse.json({
    isPro: false,
    limit: FREE_STOCK_LIMIT,
    used,
    remaining: Math.max(0, FREE_STOCK_LIMIT - used),
    tickers: uniqueStocks.map((s) => s.ticker),
  });
}
