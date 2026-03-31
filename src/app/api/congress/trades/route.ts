import { NextResponse } from "next/server";

interface CongressTrade {
  politicianName: string;
  bioguideId: string;
  party: string;
  chamber: string;
  state: string;
  issuerName: string;
  ticker: string | null;
  type: "buy" | "sell";
  size: string;
  tradeDate: string;
  publishedDate: string;
}

function parseNextData(html: string): CongressTrade[] {
  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!match) return [];

  try {
    const data = JSON.parse(match[1]);
    const props = data?.props?.pageProps;
    const raw =
      props?.trades ||
      props?.data?.trades ||
      props?.initialData?.trades ||
      props?.tradeList ||
      props?.data?.data ||
      props?.data;

    if (!Array.isArray(raw)) return [];

    return raw.slice(0, 20).map((t: any) => {
      const pol = t.politician || {};
      const iss = t.issuer || {};
      const firstName = pol.firstName || pol.first_name || "";
      const lastName = pol.lastName || pol.last_name || "";
      const fullName = firstName
        ? `${firstName} ${lastName}`.trim()
        : pol.name || t.representativeName || "Unknown";
      const bioId = (
        pol.bioguideId ||
        pol._bioguideId ||
        pol.id ||
        ""
      ).toUpperCase();

      return {
        politicianName: fullName,
        bioguideId: bioId,
        party: pol.party || t.party || "",
        chamber: pol.chamber || t.chamber || "",
        state: pol.state || t.state || "",
        issuerName: iss.name || iss.issuerName || t.asset || "Unknown",
        ticker: iss.ticker || iss.symbol || t.ticker || null,
        type: String(t.txType || t.type || t.transactionType || "buy")
          .toLowerCase()
          .includes("sell")
          ? ("sell" as const)
          : ("buy" as const),
        size: t.txAmount || t.amount || t.size || "",
        tradeDate: t.txDate || t.tradeDate || "",
        publishedDate: t.pubDate || t.filingDate || t.publishedDate || "",
      };
    });
  } catch {
    return [];
  }
}

function parseHtml(html: string): CongressTrade[] {
  const trades: CongressTrade[] = [];
  const sections = html.split(
    /(?=assets%2Fpoliticians%2F|\/assets\/politicians\/)/i
  );

  const seen = new Set<string>();

  for (let i = 1; i < sections.length && trades.length < 15; i++) {
    const s = sections[i];

    const idMatch = s.match(/politicians[%/]+([a-z]\d{6})/i);
    if (!idMatch) continue;
    const bioguideId = idMatch[1].toUpperCase();

    if (!s.includes("/issuers/")) continue;

    const key = `${bioguideId}-${i}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const nameMatch = s.match(
      /politicians\/\w+[^>]*>(?:<[^>]*>)*\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/
    );
    const name = nameMatch?.[1]?.trim();
    if (!name || name.length < 3) continue;

    const party = /democrat/i.test(s)
      ? "Democrat"
      : /republican/i.test(s)
        ? "Republican"
        : "Independent";

    const chamber = /senate/i.test(s) ? "Senate" : "House";

    const stateMatch = s.match(/>([A-Z]{2})<\//);
    const state = stateMatch?.[1] || "";

    const issuerMatch = s.match(/issuers\/\d+[^>]*>(?:<[^>]*>)*\s*([^<]+)/i);
    const issuerName = issuerMatch?.[1]?.trim() || "";
    if (!issuerName) continue;

    const tickerMatch = s.match(/\b([A-Z]{1,5}):US\b/);
    const ticker = tickerMatch?.[1] || null;

    const afterIssuer = s.substring(s.indexOf("issuers") || 0);
    const type = />sell</i.test(afterIssuer) ? "sell" : "buy";

    const sizeMatch = s.match(
      /(\d+K\s*[–-]\s*\d+[KMB]|[<>]\s*\d+[KMB]|\d+[KMB]\s*[–-]\s*\d+[KMB])/i
    );
    const size = sizeMatch?.[1]?.replace(/\s+/g, "") || "";

    const dateMatches = [
      ...s.matchAll(
        /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/gi
      ),
    ];
    const dates = dateMatches.map((m) => m[1]);

    trades.push({
      politicianName: name,
      bioguideId,
      party,
      chamber,
      state,
      issuerName,
      ticker,
      type: type as "buy" | "sell",
      size,
      tradeDate: dates[1] || dates[0] || "",
      publishedDate: dates[0] || "Recent",
    });
  }

  return trades;
}

const CURATED_TRADES: CongressTrade[] = [
  { politicianName: "Nancy Pelosi", bioguideId: "P000197", party: "Democrat", chamber: "House", state: "CA", issuerName: "NVIDIA Corp", ticker: "NVDA", type: "buy", size: "1M–5M", tradeDate: "Nov 2024", publishedDate: "Dec 2024" },
  { politicianName: "Tommy Tuberville", bioguideId: "T000278", party: "Republican", chamber: "Senate", state: "AL", issuerName: "Microsoft Corp", ticker: "MSFT", type: "buy", size: "50K–100K", tradeDate: "Jan 2025", publishedDate: "Feb 2025" },
  { politicianName: "Nancy Pelosi", bioguideId: "P000197", party: "Democrat", chamber: "House", state: "CA", issuerName: "Apple Inc", ticker: "AAPL", type: "buy", size: "500K–1M", tradeDate: "Dec 2024", publishedDate: "Jan 2025" },
  { politicianName: "Mark Green", bioguideId: "G000596", party: "Republican", chamber: "House", state: "TN", issuerName: "Palantir Technologies", ticker: "PLTR", type: "buy", size: "15K–50K", tradeDate: "Feb 2025", publishedDate: "Mar 2025" },
  { politicianName: "Josh Gottheimer", bioguideId: "G000583", party: "Democrat", chamber: "House", state: "NJ", issuerName: "Amazon.com Inc", ticker: "AMZN", type: "sell", size: "15K–50K", tradeDate: "Jan 2025", publishedDate: "Feb 2025" },
  { politicianName: "Steve Cohen", bioguideId: "C001068", party: "Democrat", chamber: "House", state: "TN", issuerName: "Tesla Inc", ticker: "TSLA", type: "buy", size: "1K–15K", tradeDate: "Feb 2025", publishedDate: "Mar 2025" },
  { politicianName: "Tommy Tuberville", bioguideId: "T000278", party: "Republican", chamber: "Senate", state: "AL", issuerName: "Alphabet Inc", ticker: "GOOGL", type: "sell", size: "100K–250K", tradeDate: "Dec 2024", publishedDate: "Jan 2025" },
  { politicianName: "Dan Crenshaw", bioguideId: "C001120", party: "Republican", chamber: "House", state: "TX", issuerName: "Meta Platforms", ticker: "META", type: "buy", size: "15K–50K", tradeDate: "Jan 2025", publishedDate: "Feb 2025" },
];

export async function GET() {
  try {
    const res = await fetch("https://www.capitoltrades.com/trades", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ trades: CURATED_TRADES, source: "curated" });
    }

    const html = await res.text();

    let trades = parseNextData(html);
    if (trades.length === 0) {
      trades = parseHtml(html);
    }

    const stockTrades = trades.filter((t) => t.ticker);
    const finalTrades =
      stockTrades.length >= 3 ? stockTrades : trades.slice(0, 12);

    if (finalTrades.length === 0) {
      return NextResponse.json({ trades: CURATED_TRADES, source: "curated" });
    }

    return NextResponse.json({ trades: finalTrades, source: "live" });
  } catch (error: any) {
    console.error("[CongressTrades] Error:", error.message);
    return NextResponse.json({ trades: CURATED_TRADES, source: "curated" });
  }
}
