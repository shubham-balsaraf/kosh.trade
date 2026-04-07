import { NextRequest, NextResponse } from "next/server";
import { searchStocks } from "@/lib/api/fmp";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  try {
    const data = await searchStocks(q);
    return NextResponse.json({ results: data || [] });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
