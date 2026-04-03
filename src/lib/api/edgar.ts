const EDGAR_BASE = "https://data.sec.gov";
const TICKER_CIK_URL = "https://www.sec.gov/files/company_tickers.json";
const USER_AGENT = "kosh.trade support@kosh.trade";

const cikCache = new Map<string, string>();
let tickerMapLoaded = false;

async function edgarFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`EDGAR ${res.status}`);
  return res.json();
}

async function loadTickerMap(): Promise<void> {
  if (tickerMapLoaded && cikCache.size > 0) return;
  try {
    const data = await edgarFetch<Record<string, { cik_str: number; ticker: string }>>(TICKER_CIK_URL);
    for (const entry of Object.values(data)) {
      cikCache.set(entry.ticker.toUpperCase(), String(entry.cik_str).padStart(10, "0"));
    }
    tickerMapLoaded = true;
  } catch (e) {
    console.warn("[EDGAR] Ticker map load failed:", (e as Error).message);
  }
}

async function getCIK(ticker: string): Promise<string | null> {
  await loadTickerMap();
  return cikCache.get(ticker.toUpperCase()) || null;
}

export interface EdgarFiling {
  ticker: string;
  form: string;
  filingDate: string;
  description: string;
}

export async function getRecentFilings(ticker: string, limit = 15): Promise<EdgarFiling[]> {
  const cik = await getCIK(ticker);
  if (!cik) return [];

  try {
    const data = await edgarFetch<any>(`${EDGAR_BASE}/submissions/CIK${cik}.json`);
    const filings: EdgarFiling[] = [];
    const recent = data.filings?.recent;
    if (!recent) return [];

    const relevantForms = new Set(["8-K", "10-K", "10-Q", "4", "SC 13G", "SC 13D", "13F-HR"]);
    const count = Math.min(50, recent.form?.length || 0);
    for (let i = 0; i < count && filings.length < limit; i++) {
      if (!relevantForms.has(recent.form[i])) continue;
      filings.push({
        ticker: ticker.toUpperCase(),
        form: recent.form[i],
        filingDate: recent.filingDate[i] || "",
        description: (recent.primaryDocDescription?.[i] || "").slice(0, 120),
      });
    }
    return filings;
  } catch (e) {
    console.warn(`[EDGAR] getRecentFilings(${ticker}):`, (e as Error).message);
    return [];
  }
}

export async function getInsiderFilingCount(ticker: string, daysBack = 90): Promise<number> {
  const cik = await getCIK(ticker);
  if (!cik) return 0;

  try {
    const data = await edgarFetch<any>(`${EDGAR_BASE}/submissions/CIK${cik}.json`);
    const recent = data.filings?.recent;
    if (!recent) return 0;

    const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
    let count = 0;
    const len = Math.min(100, recent.form?.length || 0);
    for (let i = 0; i < len; i++) {
      if (recent.form[i] === "4" && recent.filingDate[i] >= cutoff) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

export async function batchEdgarFilings(
  tickers: string[],
): Promise<Map<string, EdgarFiling[]>> {
  const results = new Map<string, EdgarFiling[]>();
  const batch = tickers.filter((t) => !t.includes("-")).slice(0, 15);

  const settled = await Promise.allSettled(
    batch.map((t) => getRecentFilings(t, 5).then((filings) => ({ ticker: t, filings }))),
  );

  for (const r of settled) {
    if (r.status === "fulfilled" && r.value.filings.length > 0) {
      results.set(r.value.ticker, r.value.filings);
    }
  }
  console.log(`[EDGAR] Batch filings: ${results.size}/${batch.length} tickers had data`);
  return results;
}
