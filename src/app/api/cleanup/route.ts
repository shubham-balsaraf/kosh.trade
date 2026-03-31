import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const allEntries = await prisma.searchHistory.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true, ticker: true, createdAt: true },
  });

  const seen = new Map<string, string>();
  const toDelete: string[] = [];

  for (const entry of allEntries) {
    const key = `${entry.userId}:${entry.ticker}`;
    if (seen.has(key)) {
      toDelete.push(entry.id);
    } else {
      seen.set(key, entry.id);
    }
  }

  if (toDelete.length > 0) {
    await prisma.searchHistory.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  return NextResponse.json({
    total: allEntries.length,
    duplicatesRemoved: toDelete.length,
    remaining: allEntries.length - toDelete.length,
  });
}
