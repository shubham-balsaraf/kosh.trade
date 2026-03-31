import { NextRequest, NextResponse } from "next/server";

const SEC_API = "https://sec-edgar-insider-alerts-production.up.railway.app";

interface InsiderTrade {
  name: string;
  title: string;
  type: "buy" | "sell";
  shares: number;
  price: number;
  value: number;
  date: string;
}

async function fetchSECInsiders(ticker: string): Promise<InsiderTrade[]> {
  const listRes = await fetch(
    `${SEC_API}/sec/insider-trades/company/${ticker}?days=90&limit=12`,
    { next: { revalidate: 600 } }
  );
  if (!listRes.ok) return [];
  const listData = await listRes.json();
  const filings = listData.filings || [];
  if (filings.length === 0) return [];

  const detailPromises = filings.slice(0, 8).map(async (f: any) => {
    try {
      const dRes = await fetch(`${SEC_API}${f.detailUrl}`, {
        next: { revalidate: 600 },
      });
      if (!dRes.ok) return [];
      const detail = await dRes.json();
      const ownerName = detail.owner?.name || f.insider?.name || "Unknown";
      const ownerTitle = detail.owner?.isOfficer
        ? detail.owner.officerTitle || "Officer"
        : detail.owner?.isDirector
          ? "Director"
          : detail.owner?.isTenPercentOwner
            ? "10%+ Owner"
            : "";

      return (detail.transactions || [])
        .filter(
          (tx: any) =>
            tx.code === "P" || tx.code === "S" || tx.code === "M"
        )
        .map((tx: any) => ({
          name: ownerName,
          title: ownerTitle,
          type: tx.code === "S" ? "sell" : "buy",
          shares: tx.shares || 0,
          price: tx.pricePerShare || 0,
          value: (tx.shares || 0) * (tx.pricePerShare || 0),
          date: tx.date || f.filedDate || "",
        }));
    } catch {
      return [];
    }
  });

  const results = await Promise.all(detailPromises);
  return results.flat().filter((t) => t.shares > 0);
}

async function fetchFMPInsiders(ticker: string): Promise<InsiderTrade[]> {
  const key = process.env.FMP_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://financialmodelingprep.com/stable/insider-trading?symbol=${ticker}&limit=20&apikey=${key}`,
      { next: { revalidate: 600 } }
    );
    if (!res.ok) return [];
    const raw = await res.json();
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((t: any) => t.securitiesTransacted > 0)
      .slice(0, 15)
      .map((t: any) => ({
        name: t.reportingName || "Unknown",
        title: t.typeOfOwner || "",
        type:
          t.acquistionOrDisposition === "D" ||
          (t.transactionType && t.transactionType.includes("Sale"))
            ? "sell"
            : "buy",
        shares: t.securitiesTransacted || 0,
        price: t.price || 0,
        value: (t.securitiesTransacted || 0) * (t.price || 0),
        date: t.transactionDate || t.filingDate || "",
      }));
  } catch {
    return [];
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  let trades = await fetchSECInsiders(symbol);

  if (trades.length === 0) {
    trades = await fetchFMPInsiders(symbol);
  }

  trades.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return NextResponse.json({ trades: trades.slice(0, 12) });
}
