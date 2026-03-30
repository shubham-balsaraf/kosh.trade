import { NextRequest, NextResponse } from "next/server";
import { requirePro } from "@/lib/auth/tierCheck";
import { getOptionsFlow, getDarkPoolFlow, getCongressionalTrades } from "@/lib/api/unusualwhales";

export async function GET(req: NextRequest) {
  const { authorized } = await requirePro();
  if (!authorized) {
    return NextResponse.json(
      { error: "Pro subscription required for this feature" },
      { status: 403 }
    );
  }

  const ticker = req.nextUrl.searchParams.get("ticker") || undefined;
  const type = req.nextUrl.searchParams.get("type") || "all";

  try {
    const results: Record<string, any> = {};

    if (type === "all" || type === "options") {
      results.optionsFlow = await getOptionsFlow(ticker).catch(() => null);
    }
    if (type === "all" || type === "darkpool") {
      results.darkPool = await getDarkPoolFlow(ticker).catch(() => null);
    }
    if (type === "all" || type === "congress") {
      results.congressTrades = await getCongressionalTrades().catch(() => null);
    }

    return NextResponse.json(results);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
