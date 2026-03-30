import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    include: { holdings: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ portfolios });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { name, cash } = await req.json();

  const portfolio = await prisma.portfolio.create({
    data: { userId, name: name || "My Portfolio", cash: cash || 0 },
  });

  return NextResponse.json(portfolio, { status: 201 });
}
