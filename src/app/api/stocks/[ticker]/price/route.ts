import { NextRequest, NextResponse } from "next/server";
import { getHistoricalPrice } from "@/lib/api/fmp";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();
  const from = req.nextUrl.searchParams.get("from") || undefined;
  const to = req.nextUrl.searchParams.get("to") || undefined;

  try {
    const data = await getHistoricalPrice(symbol, from, to);
    return NextResponse.json({ data: data || [] });
  } catch (e: any) {
    console.error(`[Price API] ${symbol}:`, e.message);
    return NextResponse.json({ data: [], error: e.message }, { status: 200 });
  }
}
