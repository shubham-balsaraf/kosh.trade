import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

const FREE_STOCK_LIMIT = 15;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const tier = (session.user as any).tier;
  const role = (session.user as any).role;
  const isPro = role === "ADMIN" || tier === "PRO";
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();
  const body = await req.json();

  try {
    const allExisting = await prisma.searchHistory.findMany({
      where: { userId, ticker: symbol },
      orderBy: { createdAt: "desc" },
    });

    if (allExisting.length > 0) {
      const keep = allExisting[0];
      if (allExisting.length > 1) {
        await prisma.searchHistory.deleteMany({
          where: {
            id: { in: allExisting.slice(1).map((e) => e.id) },
          },
        });
      }

      const updated = await prisma.searchHistory.update({
        where: { id: keep.id },
        data: {
          companyName: body.companyName || keep.companyName,
          sector: body.sector || keep.sector,
          verdict: body.verdict || keep.verdict,
          analysisJson: body.analysisJson ? JSON.stringify(body.analysisJson) : keep.analysisJson,
          createdAt: new Date(),
        },
      });
      return NextResponse.json(updated, { status: 200 });
    }

    if (!isPro) {
      const uniqueCount = await prisma.searchHistory.groupBy({
        by: ["ticker"],
        where: { userId },
      });
      if (uniqueCount.length >= FREE_STOCK_LIMIT) {
        return NextResponse.json(
          { error: "limit_reached", message: `Free plan allows ${FREE_STOCK_LIMIT} stock analyses. Upgrade to Pro for unlimited.` },
          { status: 403 }
        );
      }
    }

    const entry = await prisma.searchHistory.create({
      data: {
        userId,
        ticker: symbol,
        companyName: body.companyName || null,
        sector: body.sector || null,
        verdict: body.verdict || null,
        analysisJson: body.analysisJson ? JSON.stringify(body.analysisJson) : null,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
