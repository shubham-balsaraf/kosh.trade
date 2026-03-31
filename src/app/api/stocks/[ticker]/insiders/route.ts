import { NextRequest, NextResponse } from "next/server";
import { getInsiderTrading } from "@/lib/api/fmp";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  try {
    const raw = await getInsiderTrading(symbol, 30);
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ trades: [] });
    }

    const trades = raw
      .filter((t: any) => t.transactionType && t.securitiesTransacted > 0)
      .slice(0, 15)
      .map((t: any) => ({
        name: t.reportingName || "Unknown",
        title: t.typeOfOwner || "",
        type:
          t.acquistionOrDisposition === "D" ||
          t.transactionType === "S-Sale"
            ? "sell"
            : "buy",
        shares: t.securitiesTransacted || 0,
        price: t.price || 0,
        value: (t.securitiesTransacted || 0) * (t.price || 0),
        date: t.transactionDate || t.filingDate || "",
      }));

    return NextResponse.json({ trades });
  } catch (e: any) {
    console.error("[Insiders]", e.message);
    return NextResponse.json({ trades: [] });
  }
}
