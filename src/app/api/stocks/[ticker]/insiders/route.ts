import { NextRequest, NextResponse } from "next/server";

const SEC_UA = "KoshApp/1.0 shubhambalsaraf73@gmail.com";

interface InsiderTrade {
  name: string;
  title: string;
  type: "buy" | "sell";
  shares: number;
  price: number;
  value: number;
  date: string;
}

let cachedCIKMap: Record<string, number> | null = null;
let cikMapTimestamp = 0;
const CIK_CACHE_MS = 24 * 60 * 60 * 1000;

async function getTickerCIK(ticker: string): Promise<number | null> {
  const now = Date.now();
  if (!cachedCIKMap || now - cikMapTimestamp > CIK_CACHE_MS) {
    try {
      const res = await fetch(
        "https://www.sec.gov/files/company_tickers.json",
        { headers: { "User-Agent": SEC_UA } }
      );
      if (res.ok) {
        const data = await res.json();
        cachedCIKMap = {};
        for (const key of Object.keys(data)) {
          const entry = data[key];
          if (entry.ticker && entry.cik_str) {
            cachedCIKMap[entry.ticker.toUpperCase()] = entry.cik_str;
          }
        }
        cikMapTimestamp = now;
      }
    } catch {
      return null;
    }
  }
  return cachedCIKMap?.[ticker.toUpperCase()] ?? null;
}

function extractXML(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}>\\s*<value>([^<]*)</value>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

function parseForm4XML(xml: string): InsiderTrade[] {
  const nameMatch = xml.match(/<rptOwnerName>([^<]+)<\/rptOwnerName>/i);
  const ownerName = nameMatch ? nameMatch[1].trim() : "Unknown";

  const isOfficer = /<isOfficer>1<\/isOfficer>/i.test(xml);
  const isDirector = /<isDirector>1<\/isDirector>/i.test(xml);
  const isTenPct = /<isTenPercentOwner>1<\/isTenPercentOwner>/i.test(xml);
  const titleMatch = xml.match(/<officerTitle>([^<]+)<\/officerTitle>/i);

  let role = "";
  if (isOfficer && titleMatch) role = titleMatch[1].trim();
  else if (isOfficer) role = "Officer";
  else if (isDirector) role = "Director";
  else if (isTenPct) role = "10%+ Owner";

  const trades: InsiderTrade[] = [];

  const txBlocks = xml.match(
    /<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/gi
  );
  if (!txBlocks) return trades;

  for (const block of txBlocks) {
    const dateVal = extractXML(block, "transactionDate");
    const codeMatch = block.match(
      /<transactionCode>([A-Z])<\/transactionCode>/i
    );
    const code = codeMatch ? codeMatch[1] : "";
    const sharesVal = extractXML(block, "transactionShares");
    const priceVal = extractXML(block, "transactionPricePerShare");
    const adCode = extractXML(block, "transactionAcquiredDisposedCode");

    if (!code || code === "G" || code === "J" || code === "W") continue;

    const shares = parseFloat(sharesVal) || 0;
    const price = parseFloat(priceVal) || 0;

    if (shares <= 0) continue;

    const isSell = adCode === "D" || code === "S";

    trades.push({
      name: ownerName,
      title: role,
      type: isSell ? "sell" : "buy",
      shares: Math.round(shares),
      price,
      value: Math.round(shares * price),
      date: dateVal,
    });
  }

  return trades;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  try {
    const cik = await getTickerCIK(symbol);
    if (!cik) {
      return NextResponse.json({ trades: [] });
    }

    const paddedCik = String(cik).padStart(10, "0");
    const subRes = await fetch(
      `https://data.sec.gov/submissions/CIK${paddedCik}.json`,
      {
        headers: { "User-Agent": SEC_UA },
        next: { revalidate: 600 },
      }
    );

    if (!subRes.ok) {
      return NextResponse.json({ trades: [] });
    }

    const subData = await subRes.json();
    const recent = subData.filings?.recent;
    if (!recent) {
      return NextResponse.json({ trades: [] });
    }

    const forms: string[] = recent.form || [];
    const accessions: string[] = recent.accessionNumber || [];
    const docs: string[] = recent.primaryDocument || [];

    const form4Indices: number[] = [];
    for (let i = 0; i < forms.length && form4Indices.length < 6; i++) {
      if (forms[i] === "4") form4Indices.push(i);
    }

    if (form4Indices.length === 0) {
      return NextResponse.json({ trades: [] });
    }

    const xmlPromises = form4Indices.map(async (idx) => {
      try {
        const accNoDash = accessions[idx].replace(/-/g, "");
        const docName = docs[idx].replace(/^xslF345X05\//, "");
        const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${accNoDash}/${docName}`;
        const res = await fetch(url, {
          headers: { "User-Agent": SEC_UA },
          next: { revalidate: 600 },
        });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseForm4XML(xml);
      } catch {
        return [];
      }
    });

    const results = await Promise.all(xmlPromises);
    const allTrades = results
      .flat()
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

    return NextResponse.json({ trades: allTrades.slice(0, 12) });
  } catch (e: any) {
    console.error("[Insiders]", e.message);
    return NextResponse.json({ trades: [] });
  }
}
