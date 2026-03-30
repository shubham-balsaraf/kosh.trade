import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getInsiderTrading } from "@/lib/api/fmp";
import { getRecommendations, getPriceTarget } from "@/lib/api/finnhub";
import { getMacroSnapshot } from "@/lib/signals/macroRegime";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ticker = req.nextUrl.searchParams.get("ticker");

  try {
    const [macro] = await Promise.all([
      getMacroSnapshot().catch(() => null),
    ]);

    let insider = null;
    let analyst = null;
    let priceTarget = null;

    if (ticker) {
      [insider, analyst, priceTarget] = await Promise.all([
        getInsiderTrading(ticker, 10).catch(() => null),
        getRecommendations(ticker).catch(() => null),
        getPriceTarget(ticker).catch(() => null),
      ]);
    }

    return NextResponse.json({
      macro,
      insider: insider || [],
      analyst: analyst || [],
      priceTarget,
      ticker,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
