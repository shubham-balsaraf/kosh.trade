import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/api/yahoo";

const TICKER_SYMBOLS = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA",
  "JPM", "V", "UNH", "BRK-B", "LLY", "AVGO", "WMT",
];

export async function GET() {
  try {
    const quotes = await getQuotes(TICKER_SYMBOLS);

    const tickers = TICKER_SYMBOLS.map((sym) => {
      const q = quotes[sym] || quotes[sym.replace("-", ".")] || null;
      if (!q) return null;
      return {
        symbol: sym === "BRK-B" ? "BRK.B" : sym,
        price: q.price.toFixed(2),
        change: `${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%`,
        up: q.changePercent >= 0,
      };
    }).filter(Boolean);

    return NextResponse.json({ tickers });
  } catch (e: any) {
    console.error("[Tickers]", e.message);
    return NextResponse.json({ tickers: [] });
  }
}
