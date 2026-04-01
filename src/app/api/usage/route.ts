import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

const FREE_LIMIT = 15;
const PRO_LIMIT = 999;

function getWeekWindow(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - diff);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const isPro = user.role === "ADMIN" || user.tier === "PRO";

  const { start, end } = getWeekWindow();

  const thisWeekEntries = await prisma.searchHistory.findMany({
    where: {
      userId: user.id,
      createdAt: { gte: start },
    },
    select: { ticker: true },
    distinct: ["ticker"],
  });

  const tickers = thisWeekEntries.map((e) => e.ticker);
  const used = tickers.length;
  const limit = isPro ? PRO_LIMIT : FREE_LIMIT;
  const remaining = Math.max(0, limit - used);

  return NextResponse.json({
    used,
    limit,
    remaining,
    tickers,
    isPro,
    resetsAt: end.toISOString(),
  });
}
