import { NextRequest, NextResponse } from "next/server";
import { getQuotes } from "@/lib/api/yahoo";

export async function GET(req: NextRequest) {
  const tickers = req.nextUrl.searchParams.get("tickers");
  if (!tickers) return NextResponse.json({});

  const symbols = tickers
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20);

  if (symbols.length === 0) return NextResponse.json({});

  const quotes = await getQuotes(symbols);
  return NextResponse.json(quotes);
}
