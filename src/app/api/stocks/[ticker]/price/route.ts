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
    const result = await getHistoricalPrice(symbol, from, to);
    return NextResponse.json({ data: result?.historical || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
