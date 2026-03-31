import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  const history = await prisma.searchHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      ticker: true,
      companyName: true,
      sector: true,
      verdict: true,
      createdAt: true,
    },
    distinct: ["ticker"],
    take: 50,
  });

  return NextResponse.json({ history });
}
