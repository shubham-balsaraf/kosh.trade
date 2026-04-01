import {
  getMarketNews,
  getBulkInsiderTrading,
  getTopGainersLosers,
  getEarningsCalendar,
} from "@/lib/api/fmp";

export interface DiscoveredTicker {
  ticker: string;
  source: "screener" | "news" | "congress" | "insider" | "earnings";
  reason: string;
  urgency: number; // 1-10
}

const CATALYST_KEYWORDS = [
  { pattern: /contract|awarded|partnership|deal\b/i, label: "Major contract/deal", urgency: 9 },
  { pattern: /acqui(re|sition|red)|merger|buyout|takeover/i, label: "M&A activity", urgency: 9 },
  { pattern: /fda\s+approv|drug\s+approv|breakthrough/i, label: "FDA/drug approval", urgency: 10 },
  { pattern: /tariff|sanction|ban|embargo|trade\s+war/i, label: "Geopolitical/trade policy", urgency: 8 },
  { pattern: /upgrade|price\s+target\s+raise|outperform/i, label: "Analyst upgrade", urgency: 7 },
  { pattern: /beat(s|ing)?\s+(estimate|expectation|earnings|eps)/i, label: "Earnings beat", urgency: 8 },
  { pattern: /record\s+revenue|all[\s-]time\s+high/i, label: "Record performance", urgency: 7 },
  { pattern: /split|buyback|repurchase|dividend\s+(hike|raise|increase)/i, label: "Shareholder return", urgency: 7 },
  { pattern: /ai\s+|artificial\s+intelligence|gpu|data\s+center/i, label: "AI/tech catalyst", urgency: 7 },
  { pattern: /oil|natural\s+gas|crude|energy\s+crisis|opec/i, label: "Energy catalyst", urgency: 7 },
  { pattern: /war\b|military|defense\s+contract|invasion|attack/i, label: "Defense/geopolitical", urgency: 9 },
];

function extractTickersFromText(text: string): string[] {
  const matches = text.match(/\b[A-Z]{1,5}\b/g) || [];
  const common = new Set([
    "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HER",
    "WAS", "ONE", "OUR", "OUT", "HAS", "HIS", "HOW", "ITS", "MAY", "NEW",
    "NOW", "OLD", "SEE", "WAY", "WHO", "BOY", "DID", "GET", "HIM", "LET",
    "SAY", "SHE", "TOO", "USE", "CEO", "CFO", "SEC", "FDA", "IPO", "ETF",
    "GDP", "CPI", "PMI", "NYSE", "USA", "AI", "VS", "EST", "AM", "PM",
    "BY", "IN", "ON", "AT", "TO", "UP", "AN", "IS", "IT", "OR", "AS",
    "IF", "SO", "NO", "DO", "MY", "US", "WE", "OF",
  ]);
  return [...new Set(matches)].filter(
    (t) => t.length >= 2 && t.length <= 5 && !common.has(t)
  );
}

function detectCatalyst(text: string): { label: string; urgency: number } | null {
  for (const { pattern, label, urgency } of CATALYST_KEYWORDS) {
    if (pattern.test(text)) return { label, urgency };
  }
  return null;
}

async function discoverFromScreener(): Promise<DiscoveredTicker[]> {
  try {
    const { gainers, losers } = await getTopGainersLosers();
    const results: DiscoveredTicker[] = [];

    for (const s of gainers.slice(0, 10)) {
      if (!s.symbol) continue;
      results.push({
        ticker: s.symbol,
        source: "screener",
        reason: `Top gainer: +${(s.changesPercentage || 0).toFixed(1)}% on ${((s.volume || 0) / 1e6).toFixed(1)}M volume`,
        urgency: 7,
      });
    }

    for (const s of losers.slice(0, 8)) {
      if (!s.symbol) continue;
      const drop = Math.abs(s.changesPercentage || 0);
      if (drop < 4) continue;
      results.push({
        ticker: s.symbol,
        source: "screener",
        reason: `Heavy selloff: -${drop.toFixed(1)}% — potential bounce`,
        urgency: drop > 8 ? 8 : 6,
      });
    }

    return results;
  } catch (e) {
    console.error("[Discovery] Screener failed:", e);
    return [];
  }
}

async function discoverFromNews(): Promise<DiscoveredTicker[]> {
  try {
    const news = await getMarketNews(30);
    if (!Array.isArray(news)) return [];

    const results: DiscoveredTicker[] = [];
    const seen = new Set<string>();

    for (const item of news) {
      const title = item.title || "";
      const text = item.text || item.description || "";
      const combined = `${title} ${text}`;
      const catalyst = detectCatalyst(combined);
      if (!catalyst) continue;

      const ticker = item.symbol || item.ticker;
      const tickers = ticker
        ? [ticker.toUpperCase()]
        : extractTickersFromText(title);

      for (const t of tickers) {
        if (seen.has(t)) continue;
        seen.add(t);
        results.push({
          ticker: t,
          source: "news",
          reason: `${catalyst.label}: "${title.slice(0, 80)}"`,
          urgency: catalyst.urgency,
        });
      }
    }

    return results.slice(0, 15);
  } catch (e) {
    console.error("[Discovery] News failed:", e);
    return [];
  }
}

async function discoverFromCongress(): Promise<DiscoveredTicker[]> {
  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/congress/trades`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const trades = await res.json();
    if (!Array.isArray(trades)) return [];

    const results: DiscoveredTicker[] = [];
    const seen = new Set<string>();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const t of trades) {
      if (t.type !== "buy" || !t.ticker) continue;
      const tradeDate = new Date(t.tradeDate || t.publishedDate).getTime();
      if (tradeDate < sevenDaysAgo) continue;
      if (seen.has(t.ticker)) continue;
      seen.add(t.ticker);
      results.push({
        ticker: t.ticker,
        source: "congress",
        reason: `${t.politicianName} (${t.party}) bought ${t.size || "unknown amount"}`,
        urgency: 7,
      });
    }

    return results.slice(0, 10);
  } catch (e) {
    console.error("[Discovery] Congress failed:", e);
    return [];
  }
}

async function discoverFromInsiders(): Promise<DiscoveredTicker[]> {
  try {
    const filings = await getBulkInsiderTrading(50);
    if (!Array.isArray(filings)) return [];

    const results: DiscoveredTicker[] = [];
    const seen = new Set<string>();

    for (const f of filings) {
      const isPurchase =
        (f.transactionType || "").toLowerCase().includes("purchase") ||
        (f.acquistionOrDisposition || "").toUpperCase() === "A";
      if (!isPurchase || !f.symbol) continue;

      const value = (f.securitiesTransacted || 0) * (f.price || 0);
      if (value < 100000) continue;

      if (seen.has(f.symbol)) continue;
      seen.add(f.symbol);

      const name = f.reportingName || f.reportingCik || "Executive";
      results.push({
        ticker: f.symbol.toUpperCase(),
        source: "insider",
        reason: `${name} purchased $${(value / 1000).toFixed(0)}K worth`,
        urgency: value > 1000000 ? 9 : value > 500000 ? 8 : 7,
      });
    }

    return results.slice(0, 10);
  } catch (e) {
    console.error("[Discovery] Insider failed:", e);
    return [];
  }
}

async function discoverFromEarnings(): Promise<DiscoveredTicker[]> {
  try {
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const futureDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    const to = futureDate.toISOString().slice(0, 10);

    const calendar = await getEarningsCalendar(from, to);
    if (!Array.isArray(calendar)) return [];

    const results: DiscoveredTicker[] = [];
    const seen = new Set<string>();

    for (const e of calendar) {
      if (!e.symbol || seen.has(e.symbol)) continue;
      seen.add(e.symbol);

      const est = e.epsEstimated;
      const dateStr = e.date || "upcoming";
      results.push({
        ticker: e.symbol.toUpperCase(),
        source: "earnings",
        reason: `Earnings ${dateStr}${est ? ` (est EPS $${est})` : ""} — pre-earnings play`,
        urgency: 6,
      });
    }

    return results.slice(0, 10);
  } catch (e) {
    console.error("[Discovery] Earnings failed:", e);
    return [];
  }
}

export interface RawSignalBundle {
  news: Array<{ title: string; ticker: string | null; catalyst: string | null; urgency: number }>;
  insiderBuys: Array<{ ticker: string; name: string; value: number }>;
  congressBuys: Array<{ ticker: string; politician: string; party: string; size: string }>;
  screenerMoves: Array<{ ticker: string; changePct: number; volume: number; direction: "gainer" | "loser" }>;
  earnings: Array<{ ticker: string; date: string; epsEstimate: number | null }>;
}

export async function getRawSignals(): Promise<RawSignalBundle> {
  const bundle: RawSignalBundle = { news: [], insiderBuys: [], congressBuys: [], screenerMoves: [], earnings: [] };

  const results = await Promise.allSettled([
    getMarketNews(40),
    getBulkInsiderTrading(50),
    (async () => {
      const res = await fetch(
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/congress/trades`,
        { cache: "no-store" }
      );
      return res.ok ? res.json() : [];
    })(),
    getTopGainersLosers(),
    (async () => {
      const today = new Date();
      const from = today.toISOString().slice(0, 10);
      const futureDate = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);
      const to = futureDate.toISOString().slice(0, 10);
      return getEarningsCalendar(from, to);
    })(),
  ]);

  // News
  if (results[0].status === "fulfilled" && Array.isArray(results[0].value)) {
    for (const item of results[0].value.slice(0, 40)) {
      const title = item.title || "";
      const text = `${title} ${item.text || item.description || ""}`;
      const catalyst = detectCatalyst(text);
      const ticker = item.symbol || item.ticker || null;
      bundle.news.push({
        title: title.slice(0, 120),
        ticker: ticker ? ticker.toUpperCase() : null,
        catalyst: catalyst?.label || null,
        urgency: catalyst?.urgency || 3,
      });
    }
  }

  // Insider buys
  if (results[1].status === "fulfilled" && Array.isArray(results[1].value)) {
    for (const f of results[1].value) {
      const isPurchase =
        (f.transactionType || "").toLowerCase().includes("purchase") ||
        (f.acquistionOrDisposition || "").toUpperCase() === "A";
      if (!isPurchase || !f.symbol) continue;
      const value = (f.securitiesTransacted || 0) * (f.price || 0);
      if (value < 50000) continue;
      bundle.insiderBuys.push({
        ticker: f.symbol.toUpperCase(),
        name: f.reportingName || "Executive",
        value,
      });
    }
  }

  // Congress
  if (results[2].status === "fulfilled" && Array.isArray(results[2].value)) {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const t of results[2].value) {
      if (t.type !== "buy" || !t.ticker) continue;
      const tradeDate = new Date(t.tradeDate || t.publishedDate).getTime();
      if (tradeDate < sevenDaysAgo) continue;
      bundle.congressBuys.push({
        ticker: t.ticker,
        politician: t.politicianName || "Unknown",
        party: t.party || "?",
        size: t.size || "unknown",
      });
    }
  }

  // Screener
  if (results[3].status === "fulfilled") {
    const { gainers, losers } = results[3].value as { gainers: any[]; losers: any[] };
    for (const s of (gainers || []).slice(0, 10)) {
      if (!s.symbol) continue;
      bundle.screenerMoves.push({
        ticker: s.symbol,
        changePct: s.changesPercentage || 0,
        volume: s.volume || 0,
        direction: "gainer",
      });
    }
    for (const s of (losers || []).slice(0, 10)) {
      if (!s.symbol) continue;
      bundle.screenerMoves.push({
        ticker: s.symbol,
        changePct: s.changesPercentage || 0,
        volume: s.volume || 0,
        direction: "loser",
      });
    }
  }

  // Earnings
  if (results[4].status === "fulfilled" && Array.isArray(results[4].value)) {
    for (const e of results[4].value.slice(0, 15)) {
      if (!e.symbol) continue;
      bundle.earnings.push({
        ticker: e.symbol.toUpperCase(),
        date: e.date || "upcoming",
        epsEstimate: e.epsEstimated || null,
      });
    }
  }

  return bundle;
}

export async function discoverOpportunities(): Promise<DiscoveredTicker[]> {
  console.log("[Discovery] Starting market-wide scan across 5 sources...");
  const startTime = Date.now();

  const results = await Promise.allSettled([
    discoverFromScreener(),
    discoverFromNews(),
    discoverFromCongress(),
    discoverFromInsiders(),
    discoverFromEarnings(),
  ]);

  const sourceNames = ["Screener", "News", "Congress", "Insider", "Earnings"] as const;
  const all: DiscoveredTicker[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      console.log(`[Discovery] ${sourceNames[i]}: ${r.value.length} tickers found${r.value.length > 0 ? ` → ${r.value.map((d) => d.ticker).join(", ")}` : ""}`);
      all.push(...r.value);
    } else {
      console.error(`[Discovery] ${sourceNames[i]}: FAILED →`, r.reason);
    }
  }

  const merged = new Map<string, DiscoveredTicker>();
  for (const d of all) {
    const existing = merged.get(d.ticker);
    if (existing) {
      if (d.urgency > existing.urgency) existing.urgency = d.urgency;
      existing.reason += ` | ${d.source}: ${d.reason}`;
    } else {
      merged.set(d.ticker, { ...d });
    }
  }

  const final = [...merged.values()]
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 25);

  const elapsed = Date.now() - startTime;
  console.log(`[Discovery] Complete in ${elapsed}ms — ${all.length} raw → ${final.length} unique tickers after dedup`);
  if (final.length > 0) {
    console.log(`[Discovery] Top 5: ${final.slice(0, 5).map((d) => `${d.ticker}(${d.source},urg=${d.urgency})`).join(" | ")}`);
  }

  return final;
}
