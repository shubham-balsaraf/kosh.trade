import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { ticker } = await params;
  const body = await req.json();

  try {
    const entry = await prisma.searchHistory.create({
      data: {
        userId,
        ticker: ticker.toUpperCase(),
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
