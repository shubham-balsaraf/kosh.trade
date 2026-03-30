import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const portfolio = await prisma.portfolio.findFirst({ where: { id, userId } });
  if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { ticker, shares, avgCostBasis } = await req.json();
  if (!ticker || !shares || !avgCostBasis) {
    return NextResponse.json({ error: "ticker, shares, and avgCostBasis are required" }, { status: 400 });
  }

  const holding = await prisma.portfolioHolding.upsert({
    where: { portfolioId_ticker: { portfolioId: id, ticker: ticker.toUpperCase() } },
    update: { shares, avgCostBasis },
    create: { portfolioId: id, ticker: ticker.toUpperCase(), shares, avgCostBasis },
  });

  return NextResponse.json(holding, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const portfolio = await prisma.portfolio.findFirst({ where: { id, userId } });
  if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { holdingId } = await req.json();
  if (!holdingId) return NextResponse.json({ error: "holdingId required" }, { status: 400 });

  await prisma.portfolioHolding.delete({ where: { id: holdingId } });
  return NextResponse.json({ success: true });
}
