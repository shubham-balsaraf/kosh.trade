const FINVIZ_BASE = "https://finviz.com";

export interface FinvizSnapshot {
  ticker: string;
  analystTarget: number | null;
  shortFloat: number | null;
  insiderOwn: number | null;
  instOwn: number | null;
  rsi14: number | null;
  relVolume: number | null;
  peForward: number | null;
  peg: number | null;
  shortRatio: number | null;
  earningsDate: string | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
}

function parsePercent(val: string): number | null {
  if (!val || val === "-") return null;
  const n = parseFloat(val.replace("%", ""));
  return isNaN(n) ? null : n;
}

function parseNum(val: string): number | null {
  if (!val || val === "-") return null;
  const n = parseFloat(val.replace(",", ""));
  return isNaN(n) ? null : n;
}

export async function getFinvizSnapshot(ticker: string): Promise<FinvizSnapshot | null> {
  try {
    const res = await fetch(`${FINVIZ_BASE}/quote.ashx?t=${ticker.toUpperCase()}&ty=c&ta=0&p=d`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;

    const html = await res.text();

    const extract = (label: string): string => {
      const patterns = [
        new RegExp(`<td[^>]*class="snapshot-td2-cp"[^>]*>\\s*${label}\\s*</td>\\s*<td[^>]*class="snapshot-td2"[^>]*>\\s*<b>([^<]*)</b>`, "i"),
        new RegExp(`>${label}</td>[^<]*<td[^>]*><b>([^<]*)</b>`, "i"),
        new RegExp(`"${label}"[^>]*>[^<]*<[^>]*>([^<]+)`, "i"),
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m?.[1]) return m[1].trim();
      }
      return "";
    };

    return {
      ticker: ticker.toUpperCase(),
      analystTarget: parseNum(extract("Target Price")),
      shortFloat: parsePercent(extract("Short Float")),
      insiderOwn: parsePercent(extract("Insider Own")),
      instOwn: parsePercent(extract("Inst Own")),
      rsi14: parseNum(extract("RSI \\(14\\)")),
      relVolume: parseNum(extract("Rel Volume")),
      peForward: parseNum(extract("Forward P/E")),
      peg: parseNum(extract("PEG")),
      shortRatio: parseNum(extract("Short Ratio")),
      earningsDate: extract("Earnings") || null,
      sma20: parsePercent(extract("SMA20")),
      sma50: parsePercent(extract("SMA50")),
      sma200: parsePercent(extract("SMA200")),
    };
  } catch (e) {
    console.warn(`[Finviz] getFinvizSnapshot(${ticker}):`, (e as Error).message);
    return null;
  }
}

export async function batchFinvizSnapshot(
  tickers: string[],
): Promise<Map<string, FinvizSnapshot>> {
  const results = new Map<string, FinvizSnapshot>();
  const batch = tickers.filter((t) => !t.includes("-")).slice(0, 15);

  for (let i = 0; i < batch.length; i += 3) {
    const chunk = batch.slice(i, i + 3);
    const settled = await Promise.allSettled(
      chunk.map((t) => getFinvizSnapshot(t).then((s) => ({ ticker: t, snapshot: s }))),
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value.snapshot) {
        results.set(r.value.ticker, r.value.snapshot);
      }
    }
    if (i + 3 < batch.length) await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`[Finviz] Batch snapshots: ${results.size}/${batch.length} tickers`);
  return results;
}
