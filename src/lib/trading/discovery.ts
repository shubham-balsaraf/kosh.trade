import {
  getMarketNews,
  getStockNewsLatest,
  getCryptoNews,
  getBulkInsiderTrading,
  getInsiderTradingLatest,
  getTopGainersLosers,
  getBiggestGainers,
  getBiggestLosers,
  getMostActive,
  getEarningsCalendar,
  getSenateTrades,
  getHouseTrades,
  getBulkGradesConsensus,
  getPressReleases,
  getSectorPerformance,
  getLatestMergers,
  getInstitutionalOwnershipLatest,
  getLatest8KFilings,
} from "@/lib/api/fmp";

export interface DiscoveredTicker {
  ticker: string;
  source: "screener" | "news" | "congress" | "insider" | "earnings" | "grades" | "press" | "merger" | "institutional" | "filings";
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

/* ── Individual discovery sources ────────────────────── */

async function discoverFromScreener(): Promise<DiscoveredTicker[]> {
  try {
    const [directGainers, directLosers, active, screenerResult] = await Promise.allSettled([
      getBiggestGainers(),
      getBiggestLosers(),
      getMostActive(),
      getTopGainersLosers(),
    ]);

    const results: DiscoveredTicker[] = [];
    const seen = new Set<string>();

    const addMover = (s: any, label: string, urgencyBase: number) => {
      if (!s?.symbol || seen.has(s.symbol)) return;
      seen.add(s.symbol);
      const pct = s.changesPercentage ?? s.change ?? 0;
      results.push({
        ticker: s.symbol,
        source: "screener",
        reason: `${label}: ${pct > 0 ? "+" : ""}${Number(pct).toFixed(1)}% on ${((s.volume || 0) / 1e6).toFixed(1)}M vol`,
        urgency: Math.abs(pct) > 8 ? urgencyBase + 1 : urgencyBase,
      });
    };

    if (directGainers.status === "fulfilled" && Array.isArray(directGainers.value)) {
      for (const s of directGainers.value.slice(0, 12)) addMover(s, "Top gainer", 7);
    }
    if (directLosers.status === "fulfilled" && Array.isArray(directLosers.value)) {
      for (const s of directLosers.value.slice(0, 10)) addMover(s, "Heavy selloff — potential bounce", 6);
    }
    if (active.status === "fulfilled" && Array.isArray(active.value)) {
      for (const s of active.value.slice(0, 8)) addMover(s, "Most active", 6);
    }
    if (screenerResult.status === "fulfilled") {
      const { gainers, losers } = screenerResult.value as { gainers: any[]; losers: any[] };
      for (const s of (gainers || []).slice(0, 10)) addMover(s, "Screener gainer", 7);
      for (const s of (losers || []).slice(0, 8)) addMover(s, "Screener selloff", 6);
    }

    return results;
  } catch (e) {
    console.error("[Discovery] Screener failed:", e);
    return [];
  }
}

async function discoverFromNews(): Promise<DiscoveredTicker[]> {
  try {
    const [generalNews, stockNews, cryptoNews] = await Promise.allSettled([
      getMarketNews(40),
      getStockNewsLatest(40),
      getCryptoNews(20),
    ]);

    const allNews: any[] = [];
    if (generalNews.status === "fulfilled" && Array.isArray(generalNews.value))
      allNews.push(...generalNews.value);
    if (stockNews.status === "fulfilled" && Array.isArray(stockNews.value))
      allNews.push(...stockNews.value);
    if (cryptoNews.status === "fulfilled" && Array.isArray(cryptoNews.value))
      allNews.push(...cryptoNews.value);

    const results: DiscoveredTicker[] = [];
    const seen = new Set<string>();

    for (const item of allNews) {
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

    return results.slice(0, 20);
  } catch (e) {
    console.error("[Discovery] News failed:", e);
    return [];
  }
}

async function discoverFromCongress(): Promise<DiscoveredTicker[]> {
  try {
    const [senate, house] = await Promise.allSettled([
      getSenateTrades(50),
      getHouseTrades(50),
    ]);

    const allTrades: any[] = [];
    if (senate.status === "fulfilled" && Array.isArray(senate.value))
      allTrades.push(...senate.value.map((t: any) => ({ ...t, chamber: "Senate" })));
    if (house.status === "fulfilled" && Array.isArray(house.value))
      allTrades.push(...house.value.map((t: any) => ({ ...t, chamber: "House" })));

    const results: DiscoveredTicker[] = [];
    const seen = new Set<string>();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (const t of allTrades) {
      const ticker = t.ticker || t.asset?.ticker || t.symbol;
      if (!ticker) continue;

      const txType = (t.type || t.transaction || "").toLowerCase();
      if (!txType.includes("purchase") && !txType.includes("buy")) continue;

      const tradeDate = new Date(t.transactionDate || t.tradeDate || t.publishedDate || 0).getTime();
      if (tradeDate < thirtyDaysAgo) continue;

      if (seen.has(ticker)) continue;
      seen.add(ticker);

      const who = t.firstName && t.lastName
        ? `${t.firstName} ${t.lastName}`
        : t.representative || t.politicianName || "Member";
      const party = t.party || t.office || "";
      const chamber = t.chamber || "";

      results.push({
        ticker: ticker.toUpperCase(),
        source: "congress",
        reason: `${chamber} ${who} (${party}) purchased`,
        urgency: 7,
      });
    }

    return results.slice(0, 15);
  } catch (e) {
    console.error("[Discovery] Congress failed:", e);
    return [];
  }
}

async function discoverFromInsiders(): Promise<DiscoveredTicker[]> {
  try {
    const [bulkResult, latestResult] = await Promise.allSettled([
      getBulkInsiderTrading(50),
      getInsiderTradingLatest(50),
    ]);

    const allFilings: any[] = [];
    if (bulkResult.status === "fulfilled" && Array.isArray(bulkResult.value))
      allFilings.push(...bulkResult.value);
    if (latestResult.status === "fulfilled" && Array.isArray(latestResult.value))
      allFilings.push(...latestResult.value);

    const results: DiscoveredTicker[] = [];
    const seen = new Set<string>();

    for (const f of allFilings) {
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

    return results.slice(0, 15);
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

async function discoverFromGrades(): Promise<DiscoveredTicker[]> {
  try {
    const grades = await getBulkGradesConsensus();
    if (!Array.isArray(grades)) return [];

    const results: DiscoveredTicker[] = [];
    const seen = new Set<string>();

    for (const g of grades.slice(0, 30)) {
      const ticker = g.symbol || g.ticker;
      if (!ticker || seen.has(ticker)) continue;
      seen.add(ticker);

      const action = (g.newGrade || g.action || g.ratingCurrent || "").toLowerCase();
      const isUpgrade = action.includes("buy") || action.includes("outperform") || action.includes("overweight") || action.includes("upgrade");
      const isDowngrade = action.includes("sell") || action.includes("underperform") || action.includes("underweight") || action.includes("downgrade");

      if (!isUpgrade && !isDowngrade) continue;

      const firm = g.gradingCompany || g.analystCompany || "Analyst";
      results.push({
        ticker: ticker.toUpperCase(),
        source: "grades",
        reason: `${firm} ${isUpgrade ? "upgraded" : "downgraded"} → ${g.newGrade || action}`,
        urgency: isUpgrade ? 7 : 6,
      });
    }

    return results.slice(0, 12);
  } catch (e) {
    console.error("[Discovery] Grades failed:", e);
    return [];
  }
}

async function discoverFromPressReleases(): Promise<DiscoveredTicker[]> {
  try {
    const releases = await getPressReleases(30);
    if (!Array.isArray(releases)) return [];

    const results: DiscoveredTicker[] = [];
    const seen = new Set<string>();

    for (const pr of releases) {
      const title = pr.title || "";
      const ticker = pr.symbol || pr.ticker;
      if (!ticker || seen.has(ticker)) continue;

      const catalyst = detectCatalyst(title);
      if (!catalyst) continue;

      seen.add(ticker);
      results.push({
        ticker: ticker.toUpperCase(),
        source: "press",
        reason: `Press: ${catalyst.label} — "${title.slice(0, 70)}"`,
        urgency: catalyst.urgency,
      });
    }

    return results.slice(0, 10);
  } catch (e) {
    console.error("[Discovery] Press releases failed:", e);
    return [];
  }
}

async function discoverFromMergers(): Promise<DiscoveredTicker[]> {
  try {
    const mergers = await getLatestMergers(20);
    if (!Array.isArray(mergers)) return [];

    const results: DiscoveredTicker[] = [];
    const seen = new Set<string>();

    for (const m of mergers) {
      const tickers = [m.targetedStockTicker, m.acquirerStockTicker, m.symbol].filter(Boolean);
      for (const ticker of tickers) {
        if (seen.has(ticker)) continue;
        seen.add(ticker);
        results.push({
          ticker: ticker.toUpperCase(),
          source: "merger",
          reason: `M&A: ${m.companyName || m.targetedCompanyName || ticker} — ${m.transactionType || "deal"}`,
          urgency: 8,
        });
      }
    }

    return results.slice(0, 10);
  } catch (e) {
    console.error("[Discovery] Mergers failed:", e);
    return [];
  }
}

async function discoverFromInstitutional(): Promise<DiscoveredTicker[]> {
  try {
    const filings = await getInstitutionalOwnershipLatest(30);
    if (!Array.isArray(filings)) return [];

    const results: DiscoveredTicker[] = [];
    const seen = new Set<string>();

    for (const f of filings) {
      const ticker = f.symbol || f.ticker;
      if (!ticker || seen.has(ticker)) continue;

      const change = f.changeInShares || f.change || 0;
      if (change <= 0) continue;

      seen.add(ticker);
      const investor = f.investorName || f.cik || "Institution";
      results.push({
        ticker: ticker.toUpperCase(),
        source: "institutional",
        reason: `${investor} added ${((change) / 1000).toFixed(0)}K shares`,
        urgency: 7,
      });
    }

    return results.slice(0, 10);
  } catch (e) {
    console.error("[Discovery] Institutional failed:", e);
    return [];
  }
}

async function discoverFrom8K(): Promise<DiscoveredTicker[]> {
  try {
    const filings = await getLatest8KFilings(30);
    if (!Array.isArray(filings)) return [];

    const results: DiscoveredTicker[] = [];
    const seen = new Set<string>();

    for (const f of filings) {
      const ticker = f.symbol || f.ticker;
      if (!ticker || seen.has(ticker)) continue;

      const title = f.title || f.description || "";
      const catalyst = detectCatalyst(title);
      if (!catalyst) continue;

      seen.add(ticker);
      results.push({
        ticker: ticker.toUpperCase(),
        source: "filings",
        reason: `8-K: ${catalyst.label} — "${title.slice(0, 70)}"`,
        urgency: catalyst.urgency,
      });
    }

    return results.slice(0, 8);
  } catch (e) {
    console.error("[Discovery] 8-K filings failed:", e);
    return [];
  }
}

/* ── Enhanced RawSignalBundle with all sources ───────── */

export interface RawSignalBundle {
  news: Array<{ title: string; ticker: string | null; catalyst: string | null; urgency: number }>;
  insiderBuys: Array<{ ticker: string; name: string; value: number }>;
  congressBuys: Array<{ ticker: string; politician: string; party: string; chamber: string; size: string }>;
  screenerMoves: Array<{ ticker: string; changePct: number; volume: number; direction: "gainer" | "loser" | "active" }>;
  earnings: Array<{ ticker: string; date: string; epsEstimate: number | null }>;
  grades: Array<{ ticker: string; firm: string; action: string; newGrade: string; previousGrade: string }>;
  pressReleases: Array<{ ticker: string; title: string; catalyst: string | null }>;
  sectorPerformance: Array<{ sector: string; changePct: number }>;
  mergers: Array<{ ticker: string; companyName: string; type: string }>;
  institutional: Array<{ ticker: string; investor: string; changeShares: number }>;
  filings8k: Array<{ ticker: string; title: string; date: string }>;
  cryptoNews: Array<{ title: string; ticker: string | null; catalyst: string | null }>;
}

export async function getRawSignals(): Promise<RawSignalBundle> {
  const bundle: RawSignalBundle = {
    news: [], insiderBuys: [], congressBuys: [], screenerMoves: [], earnings: [],
    grades: [], pressReleases: [], sectorPerformance: [], mergers: [],
    institutional: [], filings8k: [], cryptoNews: [],
  };

  const results = await Promise.allSettled([
    getStockNewsLatest(40),            // 0
    getInsiderTradingLatest(50),        // 1
    getSenateTrades(30),                // 2
    getHouseTrades(30),                 // 3
    getBiggestGainers(),                // 4
    getBiggestLosers(),                 // 5
    getMostActive(),                    // 6
    (async () => {                      // 7 earnings
      const today = new Date();
      const from = today.toISOString().slice(0, 10);
      const to = new Date(today.getTime() + 5 * 86400000).toISOString().slice(0, 10);
      return getEarningsCalendar(from, to);
    })(),
    getBulkGradesConsensus(),           // 8
    getPressReleases(30),              // 9
    getSectorPerformance(),            // 10
    getLatestMergers(20),              // 11
    getInstitutionalOwnershipLatest(30), // 12
    getLatest8KFilings(30),            // 13
    getCryptoNews(20),                 // 14
    getMarketNews(40),                 // 15 (backup news source)
  ]);

  const sourceNames = [
    "StockNews", "Insider", "Senate", "House", "Gainers", "Losers", "Active",
    "Earnings", "Grades", "PressReleases", "SectorPerf", "Mergers",
    "Institutional", "8K-Filings", "CryptoNews", "MarketNews",
  ];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const count = r.status === "fulfilled" && Array.isArray(r.value) ? r.value.length : 0;
    console.log(`[RawSignals] ${sourceNames[i]}: ${r.status}${r.status === "fulfilled" ? ` (${count} items)` : ` — ${(r as PromiseRejectedResult).reason}`}`);
  }

  // News (merge stock-latest + market news, dedup)
  const seenTitles = new Set<string>();
  const processNews = (items: any[], target: typeof bundle.news) => {
    if (!Array.isArray(items)) return;
    for (const item of items.slice(0, 40)) {
      const title = item.title || "";
      if (seenTitles.has(title)) continue;
      seenTitles.add(title);
      const text = `${title} ${item.text || item.description || ""}`;
      const catalyst = detectCatalyst(text);
      const ticker = item.symbol || item.ticker || null;
      target.push({
        title: title.slice(0, 120),
        ticker: ticker ? ticker.toUpperCase() : null,
        catalyst: catalyst?.label || null,
        urgency: catalyst?.urgency || 3,
      });
    }
  };
  if (results[0].status === "fulfilled") processNews(results[0].value as any[], bundle.news);
  if (results[15].status === "fulfilled") processNews(results[15].value as any[], bundle.news);

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

  // Congress — Senate + House (direct from FMP, no self-fetch)
  const processCongressTrades = (trades: any[], chamber: string) => {
    if (!Array.isArray(trades)) return;
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    for (const t of trades) {
      const ticker = t.ticker || t.asset?.ticker || t.symbol;
      if (!ticker) continue;
      const txType = (t.type || t.transaction || "").toLowerCase();
      if (!txType.includes("purchase") && !txType.includes("buy")) continue;
      const tradeDate = new Date(t.transactionDate || t.tradeDate || t.publishedDate || 0).getTime();
      if (tradeDate < thirtyDaysAgo) continue;
      const who = t.firstName && t.lastName
        ? `${t.firstName} ${t.lastName}`
        : t.representative || t.politicianName || "Member";
      bundle.congressBuys.push({
        ticker: ticker.toUpperCase(),
        politician: who,
        party: t.party || "",
        chamber,
        size: t.amount || t.range || "unknown",
      });
    }
  };
  if (results[2].status === "fulfilled") processCongressTrades(results[2].value as any[], "Senate");
  if (results[3].status === "fulfilled") processCongressTrades(results[3].value as any[], "House");

  // Screener moves — merge gainers + losers + active
  const addScreenerMove = (items: any[], direction: "gainer" | "loser" | "active") => {
    if (!Array.isArray(items)) return;
    for (const s of items.slice(0, 12)) {
      if (!s.symbol) continue;
      bundle.screenerMoves.push({
        ticker: s.symbol,
        changePct: s.changesPercentage ?? s.change ?? 0,
        volume: s.volume || 0,
        direction,
      });
    }
  };
  if (results[4].status === "fulfilled") addScreenerMove(results[4].value as any[], "gainer");
  if (results[5].status === "fulfilled") addScreenerMove(results[5].value as any[], "loser");
  if (results[6].status === "fulfilled") addScreenerMove(results[6].value as any[], "active");

  // Earnings
  if (results[7].status === "fulfilled" && Array.isArray(results[7].value)) {
    for (const e of results[7].value.slice(0, 15)) {
      if (!e.symbol) continue;
      bundle.earnings.push({
        ticker: e.symbol.toUpperCase(),
        date: e.date || "upcoming",
        epsEstimate: e.epsEstimated || null,
      });
    }
  }

  // Analyst grades
  if (results[8].status === "fulfilled" && Array.isArray(results[8].value)) {
    for (const g of results[8].value.slice(0, 20)) {
      const ticker = g.symbol || g.ticker;
      if (!ticker) continue;
      bundle.grades.push({
        ticker: ticker.toUpperCase(),
        firm: g.gradingCompany || g.analystCompany || "Analyst",
        action: g.action || g.ratingAction || "",
        newGrade: g.newGrade || g.ratingCurrent || "",
        previousGrade: g.previousGrade || g.ratingPrior || "",
      });
    }
  }

  // Press releases
  if (results[9].status === "fulfilled" && Array.isArray(results[9].value)) {
    for (const pr of results[9].value.slice(0, 15)) {
      const ticker = pr.symbol || pr.ticker;
      if (!ticker) continue;
      const title = pr.title || "";
      bundle.pressReleases.push({
        ticker: ticker.toUpperCase(),
        title: title.slice(0, 120),
        catalyst: detectCatalyst(title)?.label || null,
      });
    }
  }

  // Sector performance
  if (results[10].status === "fulfilled" && Array.isArray(results[10].value)) {
    for (const s of results[10].value) {
      bundle.sectorPerformance.push({
        sector: s.sector || s.name || "Unknown",
        changePct: s.changesPercentage ?? s.change ?? 0,
      });
    }
  }

  // Mergers
  if (results[11].status === "fulfilled" && Array.isArray(results[11].value)) {
    for (const m of results[11].value.slice(0, 10)) {
      const ticker = m.targetedStockTicker || m.symbol || m.ticker;
      if (!ticker) continue;
      bundle.mergers.push({
        ticker: ticker.toUpperCase(),
        companyName: m.companyName || m.targetedCompanyName || ticker,
        type: m.transactionType || "M&A",
      });
    }
  }

  // Institutional
  if (results[12].status === "fulfilled" && Array.isArray(results[12].value)) {
    for (const f of results[12].value.slice(0, 15)) {
      const ticker = f.symbol || f.ticker;
      if (!ticker) continue;
      const change = f.changeInShares || f.change || 0;
      if (change <= 0) continue;
      bundle.institutional.push({
        ticker: ticker.toUpperCase(),
        investor: f.investorName || f.cik || "Institution",
        changeShares: change,
      });
    }
  }

  // 8-K filings
  if (results[13].status === "fulfilled" && Array.isArray(results[13].value)) {
    for (const f of results[13].value.slice(0, 10)) {
      const ticker = f.symbol || f.ticker;
      if (!ticker) continue;
      bundle.filings8k.push({
        ticker: ticker.toUpperCase(),
        title: (f.title || f.description || "").slice(0, 120),
        date: f.filledDate || f.date || "",
      });
    }
  }

  // Crypto news
  if (results[14].status === "fulfilled" && Array.isArray(results[14].value)) {
    for (const item of results[14].value.slice(0, 20)) {
      const title = item.title || "";
      const text = `${title} ${item.text || item.description || ""}`;
      const catalyst = detectCatalyst(text);
      bundle.cryptoNews.push({
        title: title.slice(0, 120),
        ticker: (item.symbol || item.ticker || "").toUpperCase() || null,
        catalyst: catalyst?.label || null,
      });
    }
  }

  const totalSignals =
    bundle.news.length + bundle.insiderBuys.length + bundle.congressBuys.length +
    bundle.screenerMoves.length + bundle.earnings.length + bundle.grades.length +
    bundle.pressReleases.length + bundle.mergers.length + bundle.institutional.length +
    bundle.filings8k.length + bundle.cryptoNews.length;
  console.log(`[RawSignals] Total signals collected: ${totalSignals} across ${sourceNames.length} sources`);

  return bundle;
}

/* ── Full discovery pipeline ─────────────────────────── */

export async function discoverOpportunities(): Promise<DiscoveredTicker[]> {
  console.log("[Discovery] Starting market-wide scan across 10 sources...");
  const startTime = Date.now();

  const results = await Promise.allSettled([
    discoverFromScreener(),
    discoverFromNews(),
    discoverFromCongress(),
    discoverFromInsiders(),
    discoverFromEarnings(),
    discoverFromGrades(),
    discoverFromPressReleases(),
    discoverFromMergers(),
    discoverFromInstitutional(),
    discoverFrom8K(),
  ]);

  const sourceNames = [
    "Screener", "News", "Congress", "Insider", "Earnings",
    "Grades", "PressReleases", "Mergers", "Institutional", "8K-Filings",
  ] as const;
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
    .slice(0, 30);

  const elapsed = Date.now() - startTime;
  console.log(`[Discovery] Complete in ${elapsed}ms — ${all.length} raw → ${final.length} unique tickers after dedup`);
  if (final.length > 0) {
    console.log(`[Discovery] Top 5: ${final.slice(0, 5).map((d) => `${d.ticker}(${d.source},urg=${d.urgency})`).join(" | ")}`);
  }

  return final;
}
