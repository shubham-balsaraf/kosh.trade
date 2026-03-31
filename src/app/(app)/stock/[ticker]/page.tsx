"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMediaQuery";
import FCFChart from "@/components/charts/FCFChart";
import FCFvsSBCChart from "@/components/charts/FCFvsSBCChart";
import PriceChart from "@/components/charts/PriceChart";
import MarginChart from "@/components/charts/MarginChart";
import AIAnalysis from "@/components/stock/AIAnalysis";
import AnalysisHistory from "@/components/stock/AnalysisHistory";
import Link from "next/link";
import { Crown, Lock, TrendingUp, TrendingDown, Minus, Newspaper, ExternalLink, Zap } from "lucide-react";
import StockLogo from "@/components/ui/StockLogo";

type Tab = "ai" | "overview" | "charts" | "valuation" | "growth" | "health" | "returns" | "fcf" | "earnings";

type VerdictTheme = "consider" | "moderate" | "avoid" | null;

const THEME = {
  consider: {
    accent: "text-emerald-400",
    accentMuted: "text-emerald-500/60",
    border: "border-emerald-500/15",
    glow: "shadow-emerald-500/5",
    gradient: "from-emerald-500/6 via-transparent to-transparent",
    stripBg: "bg-emerald-500/5",
    stripBorder: "border-emerald-500/10",
    tabActive: "bg-emerald-600",
    dot: "bg-emerald-400",
    bar: "bg-emerald-500",
  },
  moderate: {
    accent: "text-amber-400",
    accentMuted: "text-amber-500/60",
    border: "border-amber-500/15",
    glow: "shadow-amber-500/5",
    gradient: "from-amber-500/6 via-transparent to-transparent",
    stripBg: "bg-amber-500/5",
    stripBorder: "border-amber-500/10",
    tabActive: "bg-amber-600",
    dot: "bg-amber-400",
    bar: "bg-amber-500",
  },
  avoid: {
    accent: "text-red-400",
    accentMuted: "text-red-500/60",
    border: "border-red-500/15",
    glow: "shadow-red-500/5",
    gradient: "from-red-500/6 via-transparent to-transparent",
    stripBg: "bg-red-500/5",
    stripBorder: "border-red-500/10",
    tabActive: "bg-red-600",
    dot: "bg-red-400",
    bar: "bg-red-500",
  },
};

const DEFAULT_THEME = {
  accent: "text-white",
  accentMuted: "text-gray-500",
  border: "border-gray-800",
  glow: "shadow-transparent",
  gradient: "from-transparent to-transparent",
  stripBg: "bg-transparent",
  stripBorder: "border-gray-800",
  tabActive: "bg-indigo-600",
  dot: "bg-indigo-400",
  bar: "bg-indigo-500",
};

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [verdict, setVerdict] = useState<VerdictTheme>(null);
  const [newsData, setNewsData] = useState<any>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const mobile = useIsMobile();

  const handleVerdictChange = useCallback((signal: string | null) => {
    if (signal === "CONSIDER") setVerdict("consider");
    else if (signal === "MODERATE") setVerdict("moderate");
    else if (signal === "AVOID") setVerdict("avoid");
    else setVerdict(null);
  }, []);

  const t = verdict ? THEME[verdict] : DEFAULT_THEME;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const usageRes = await fetch("/api/usage");
        const usage = await usageRes.json();
        const isAllowed = usage.isPro || (usage.tickers || []).includes(ticker.toUpperCase()) || (usage.remaining ?? 0) > 0;

        if (!isAllowed) {
          setLimitReached(true);
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/stocks/${ticker}`);
        if (!res.ok) throw new Error("Stock not found");
        const json = await res.json();
        setData(json);
        
        if (json.profile) {
          const saveRes = await fetch(`/api/stocks/${ticker}/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyName: json.profile.companyName,
              sector: json.profile.sector,
            }),
          }).catch(() => null);
          if (saveRes && saveRes.status === 403) {
            // already saved but limit check happened server-side too
          }
        }
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    }
    load();
  }, [ticker]);

  useEffect(() => {
    if (!data || newsData) return;
    setNewsLoading(true);
    fetch(`/api/stocks/${ticker}/news`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setNewsData(d); })
      .catch(() => {})
      .finally(() => setNewsLoading(false));
  }, [data, ticker, newsData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-20 w-full" />
        <div className="skeleton h-10 w-full max-w-xs" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-24" />)}
        </div>
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  if (limitReached) {
    return (
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <Card className="text-center py-16">
            <Lock size={48} className="mx-auto text-gray-600 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Free Analysis Limit Reached</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
              You&apos;ve used all 15 free stock analyses. Upgrade to Pro for unlimited analyses,
              AI portfolio management, and advanced signals.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold rounded-xl shadow-lg shadow-amber-500/25 transition-all hover:scale-105"
            >
              <Crown size={18} />
              Upgrade to Pro
            </Link>
            <p className="text-gray-600 text-xs mt-4">
              You can still access your previously analyzed stocks from the sidebar.
            </p>
          </Card>
        </div>
        <div className="w-full lg:w-64 shrink-0">
          <Card className="!p-3">
            <AnalysisHistory currentTicker={ticker} />
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="text-center py-12">
        <p className="text-red-400 text-lg font-semibold">Stock not found</p>
        <p className="text-gray-500 text-sm mt-2">Could not load data for {ticker.toUpperCase()}</p>
      </Card>
    );
  }

  const { quote, profile, income, balance, cashflow, metrics, ratios } = data;
  const q = quote || {};
  const p = profile || {};
  const latestIncome = income?.[0] || {};
  const latestBalance = balance?.[0] || {};
  const latestCashflow = cashflow?.[0] || {};
  const latestMetrics = metrics?.[0] || {};
  const latestRatios = ratios?.[0] || {};

  const priceChangePositive = (q.changePercentage ?? q.changesPercentage ?? 0) >= 0;

  const tabs: { key: Tab; label: string; icon?: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "charts", label: "Charts" },
    { key: "valuation", label: "Valuation" },
    { key: "growth", label: "Growth" },
    { key: "health", label: "Health" },
    { key: "returns", label: "Returns" },
    { key: "fcf", label: "FCF Data" },
    { key: "earnings", label: "Earnings" },
    { key: "ai", label: "✦ AI Analysis", icon: "ai" },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
    <div className="flex-1 min-w-0 space-y-4 relative">
      {/* Subtle verdict gradient overlay at the top */}
      {verdict && (
        <div className={`absolute top-0 left-0 right-0 h-48 bg-gradient-to-b ${t.gradient} rounded-3xl pointer-events-none -z-0`} />
      )}

      {/* Thin accent bar */}
      {verdict && (
        <div className={`h-0.5 ${t.bar} rounded-full opacity-40 -mb-2`} />
      )}

      {/* Header */}
      <div className={`flex flex-col sm:flex-row sm:flex-wrap sm:items-start justify-between gap-3 sm:gap-4 relative z-10 rounded-2xl p-4 -mx-4 transition-all duration-700 ${verdict ? `${t.stripBg} border ${t.stripBorder}` : ""}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <StockLogo ticker={ticker} size={mobile ? 36 : 44} />
            <h1 className={`text-2xl sm:text-3xl font-black transition-colors duration-700 ${verdict ? t.accent : "text-white"}`}>
              {ticker.toUpperCase()}
            </h1>
            <Badge variant="blue">{p.exchangeShortName || q.exchange || "NASDAQ"}</Badge>
            {p.sector && <Badge variant="gray">{p.sector}</Badge>}
            {verdict && (
              <span className={`text-[10px] font-bold uppercase tracking-widest ${t.accentMuted}`}>
                {verdict}
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-1 truncate">{p.companyName || q.name || ticker}</p>
        </div>
        <div className="flex items-baseline sm:items-end gap-3 sm:flex-col sm:text-right">
          <div className="text-2xl sm:text-3xl font-bold text-white">{formatCurrency(q.price || 0)}</div>
          <div className={`text-sm font-semibold ${priceChangePositive ? "text-emerald-400" : "text-red-400"}`}>
            {priceChangePositive ? "+" : ""}{formatCurrency(q.change || 0)} ({formatPercent(q.changePercentage ?? q.changesPercentage ?? 0)})
          </div>
        </div>
      </div>

      {/* Key metrics strip */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
        {[
          { label: "Market Cap", value: formatCurrency(q.marketCap || 0, true) },
          { label: "52W High", value: formatCurrency(q.yearHigh || 0) },
          { label: "52W Low", value: formatCurrency(q.yearLow || 0) },
          { label: "P/E Ratio", value: (q.pe || latestRatios.priceToEarningsRatio || 0).toFixed(1) + "x" },
          { label: "Volume", value: formatNumber(q.volume || 0, true) },
        ].map(({ label, value }) => (
          <Card key={label} className={`!p-3 text-center transition-all duration-500 ${verdict ? `border ${t.border} shadow-lg ${t.glow}` : ""}`}>
            <div className={`text-[11px] uppercase tracking-wide transition-colors duration-500 ${verdict ? t.accentMuted : "text-gray-500"}`}>{label}</div>
            <div className="text-base font-bold text-white mt-1">{value}</div>
          </Card>
        ))}
      </div>

      {/* Tab bar */}
      <div className={`flex gap-1 overflow-x-auto pb-1 px-1 py-1 rounded-xl transition-all duration-500 ${verdict ? `${t.stripBg} border ${t.stripBorder}` : ""}`}>
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 sm:gap-2 min-h-[40px] ${
              activeTab === key
                ? icon === "ai" ? "bg-gradient-to-r from-amber-600 to-amber-500 text-black shadow-md shadow-amber-500/20" : `${t.tabActive} text-white shadow-md`
                : icon === "ai" ? "text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/15" : "text-gray-400 hover:text-gray-200 hover:bg-gray-900/50"
            }`}
          >
            {activeTab === key && !icon && <span className={`w-1.5 h-1.5 rounded-full ${t.dot} animate-pulse`} />}
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "ai" && <AIAnalysis ticker={ticker} onVerdictChange={handleVerdictChange} />}

      {activeTab === "overview" && (
        <div className="space-y-4">
          {p.description && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">About</h3>
              <p className="text-sm text-gray-300 leading-relaxed line-clamp-4">{p.description}</p>
            </Card>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            <Card>
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Profitability</h3>
              <div className="space-y-2">
                {[
                  { label: "Gross Margin", value: latestRatios.grossProfitMargin },
                  { label: "Operating Margin", value: latestRatios.operatingProfitMargin },
                  { label: "Net Margin", value: latestRatios.netProfitMargin },
                  { label: "ROE", value: latestMetrics.returnOnEquity },
                  { label: "ROIC", value: latestMetrics.returnOnCapitalEmployed },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-white font-medium">{value != null ? formatPercent(value * 100) : "N/A"}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Financial Health</h3>
              <div className="space-y-2">
                {[
                  { label: "Debt/Equity", value: latestRatios.debtToEquityRatio?.toFixed(2) },
                  { label: "Current Ratio", value: latestRatios.currentRatio?.toFixed(2) },
                  { label: "Interest Coverage", value: latestRatios.interestCoverageRatio?.toFixed(1) + "x" },
                  { label: "FCF", value: formatCurrency(latestCashflow.freeCashFlow || 0, true) },
                  { label: "Dividend Yield", value: latestRatios.dividendYieldPercentage ? formatPercent(latestRatios.dividendYieldPercentage) : "N/A" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-white font-medium">{value || "N/A"}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* News & Sentiment */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Newspaper size={14} className={t.accent} />
                <h3 className="text-sm font-semibold text-gray-400">News & Sentiment</h3>
              </div>
              {newsData?.sentiment && (
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                    newsData.sentiment.overall === "bullish"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : newsData.sentiment.overall === "bearish"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-white/[0.04] text-white/40 border border-white/[0.06]"
                  }`}>
                    {newsData.sentiment.overall === "bullish" ? <TrendingUp size={10} /> : newsData.sentiment.overall === "bearish" ? <TrendingDown size={10} /> : <Minus size={10} />}
                    {newsData.sentiment.overall.charAt(0).toUpperCase() + newsData.sentiment.overall.slice(1)}
                  </div>
                  <span className="text-[10px] text-white/15">
                    {newsData.sentiment.bullish}↑ {newsData.sentiment.bearish}↓ {newsData.sentiment.neutral}—
                  </span>
                </div>
              )}
            </div>

            {/* Sentiment bar */}
            {newsData?.sentiment && newsData.news?.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden flex">
                    {newsData.sentiment.bullish > 0 && (
                      <div className="h-full bg-emerald-500/60 rounded-l-full transition-all" style={{ width: `${(newsData.sentiment.bullish / newsData.news.length) * 100}%` }} />
                    )}
                    {(newsData.news.length - newsData.sentiment.bullish - newsData.sentiment.bearish) > 0 && (
                      <div className="h-full bg-white/10 transition-all" style={{ width: `${((newsData.news.length - newsData.sentiment.bullish - newsData.sentiment.bearish) / newsData.news.length) * 100}%` }} />
                    )}
                    {newsData.sentiment.bearish > 0 && (
                      <div className="h-full bg-red-500/60 rounded-r-full transition-all" style={{ width: `${(newsData.sentiment.bearish / newsData.news.length) * 100}%` }} />
                    )}
                  </div>
                </div>
                <div className="flex justify-between mt-1.5 text-[10px]">
                  <span className="text-emerald-400/40">Bullish ({newsData.sentiment.bullish})</span>
                  <span className="text-red-400/40">Bearish ({newsData.sentiment.bearish})</span>
                </div>
              </div>
            )}

            {newsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="w-16 h-16 rounded-xl bg-white/[0.04] shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 bg-white/[0.04] rounded w-full" />
                      <div className="h-3 bg-white/[0.04] rounded w-3/4" />
                      <div className="h-2 bg-white/[0.04] rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : newsData?.news?.length > 0 ? (
              <div className="space-y-1">
                {newsData.news.slice(0, 6).map((item: any, i: number) => {
                  const sentColor = item.sentiment === "bullish" ? "border-l-emerald-500" : item.sentiment === "bearish" ? "border-l-red-500" : "border-l-white/10";
                  const timeAgo = getTimeAgo(item.publishedAt);
                  return (
                    <a
                      key={i}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex gap-3 p-3 -mx-1 rounded-xl hover:bg-white/[0.03] transition-all group border-l-2 ${sentColor}`}
                    >
                      {item.image && (
                        <div className="w-16 h-16 sm:w-20 sm:h-16 rounded-xl overflow-hidden shrink-0 bg-white/[0.03]">
                          <img
                            src={item.image}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-white/30 font-medium">{item.source}</span>
                          <span className="text-[10px] text-white/10">·</span>
                          <span className="text-[10px] text-white/20">{timeAgo}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md ml-auto ${
                            item.sentiment === "bullish" ? "bg-emerald-500/10 text-emerald-400/60"
                              : item.sentiment === "bearish" ? "bg-red-500/10 text-red-400/60"
                                : "bg-white/[0.03] text-white/20"
                          }`}>
                            {item.sentiment === "bullish" ? "↑" : item.sentiment === "bearish" ? "↓" : "—"}
                          </span>
                          <ExternalLink size={8} className="text-white/10 group-hover:text-white/30 transition-colors" />
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-white/20 text-center py-6">No recent news found for {ticker.toUpperCase()}</p>
            )}
          </Card>
        </div>
      )}

      {activeTab === "charts" && (
        <div className="space-y-6">
          <Card>
            <PriceChart ticker={ticker} />
          </Card>
          <Card>
            <FCFChart ticker={ticker} />
          </Card>
          <Card>
            <FCFvsSBCChart ticker={ticker} />
          </Card>
          <Card>
            <MarginChart ticker={ticker} />
          </Card>
        </div>
      )}

      {activeTab === "growth" && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Revenue & Earnings Trend</h3>
          {mobile ? (
            <div className="space-y-3">
              {(income || []).map((yr: any) => {
                const year = yr.fiscalYear || yr.calendarYear || yr.date?.substring(0, 4);
                const grossM = yr.revenue && yr.grossProfit ? (yr.grossProfit / yr.revenue) * 100 : null;
                const netM = yr.revenue && yr.netIncome ? (yr.netIncome / yr.revenue) * 100 : null;
                return (
                  <div key={yr.date} className="bg-gray-900/50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{year}</span>
                      <span className="text-xs text-gray-500">EPS {(yr.epsDiluted || 0).toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-gray-500">Revenue</span><div className="text-gray-200 font-medium">{formatCurrency(yr.revenue || 0, true)}</div></div>
                      <div><span className="text-gray-500">Net Income</span><div className="text-gray-200 font-medium">{formatCurrency(yr.netIncome || 0, true)}</div></div>
                      <div><span className="text-gray-500">Gross Margin</span><div className="text-gray-200 font-medium">{grossM != null ? formatPercent(grossM) : "N/A"}</div></div>
                      <div><span className="text-gray-500">Net Margin</span><div className="text-gray-200 font-medium">{netM != null ? formatPercent(netM) : "N/A"}</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800">
                    <th className="text-left py-2 pr-4">Year</th>
                    <th className="text-right py-2 px-2">Revenue</th>
                    <th className="text-right py-2 px-2">Net Income</th>
                    <th className="text-right py-2 px-2">EPS</th>
                    <th className="text-right py-2 px-2">Gross %</th>
                    <th className="text-right py-2 px-2">Op %</th>
                    <th className="text-right py-2 pl-2">Net %</th>
                  </tr>
                </thead>
                <tbody>
                  {(income || []).map((yr: any, i: number) => (
                    <tr key={yr.date} className={i % 2 === 0 ? "bg-gray-900/50" : ""}>
                      <td className="py-2 pr-4 font-medium text-white">{yr.fiscalYear || yr.calendarYear || yr.date?.substring(0, 4)}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{formatCurrency(yr.revenue || 0, true)}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{formatCurrency(yr.netIncome || 0, true)}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{(yr.epsDiluted || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{yr.revenue && yr.grossProfit ? formatPercent((yr.grossProfit / yr.revenue) * 100) : "N/A"}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{yr.revenue && yr.operatingIncome ? formatPercent((yr.operatingIncome / yr.revenue) * 100) : "N/A"}</td>
                      <td className="py-2 pl-2 text-right text-gray-300">{yr.revenue && yr.netIncome ? formatPercent((yr.netIncome / yr.revenue) * 100) : "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === "valuation" && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Valuation Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "P/E (TTM)", value: latestRatios.priceToEarningsRatio },
              { label: "Forward PEG", value: latestRatios.forwardPriceToEarningsGrowthRatio },
              { label: "EV/EBITDA", value: latestMetrics.evToEBITDA },
              { label: "P/S", value: latestRatios.priceToSalesRatio },
              { label: "P/B", value: latestRatios.priceToBookRatio },
              { label: "P/FCF", value: latestRatios.priceToFreeCashFlowRatio },
              { label: "PEG Ratio", value: latestRatios.priceToEarningsGrowthRatio },
              { label: "EV/Revenue", value: latestMetrics.evToSales },
              { label: "Dividend Yield", value: latestRatios.dividendYieldPercentage != null ? `${latestRatios.dividendYieldPercentage.toFixed(2)}%` : "N/A" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center p-3 bg-gray-900/50 rounded-xl">
                <div className="text-[11px] text-gray-500 uppercase">{label}</div>
                <div className="text-lg font-bold text-white mt-1">
                  {typeof value === "number" ? value.toFixed(2) + "x" : value || "N/A"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === "health" && (
        <div className="space-y-4">
          <HealthStatusBar
            debtToEquity={latestRatios.debtToEquityRatio}
            currentRatio={latestRatios.currentRatio}
            interestCoverage={latestRatios.interestCoverageRatio}
            fcf={latestCashflow.freeCashFlow}
            roe={latestMetrics.returnOnEquity}
            fcfMargin={latestCashflow.freeCashFlow && latestIncome.revenue
              ? latestCashflow.freeCashFlow / latestIncome.revenue
              : null}
          />

          <Card>
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Balance Sheet Trend</h3>
            {mobile ? (
              <div className="space-y-3">
                {(balance || []).map((yr: any, i: number) => {
                  const r = ratios?.[i] || {};
                  const cf = cashflow?.[i] || {};
                  return (
                    <div key={yr.date} className="bg-gray-900/50 rounded-xl p-3 space-y-2">
                      <span className="text-sm font-bold text-white">{yr.fiscalYear || yr.calendarYear || yr.date?.substring(0, 4)}</span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-gray-500">Total Debt</span><div className="text-gray-200 font-medium">{formatCurrency(yr.totalDebt || 0, true)}</div></div>
                        <div><span className="text-gray-500">Equity</span><div className="text-gray-200 font-medium">{formatCurrency(yr.totalStockholdersEquity || 0, true)}</div></div>
                        <div><span className="text-gray-500">D/E</span><div className="text-gray-200 font-medium">{r.debtToEquityRatio?.toFixed(2) || "N/A"}</div></div>
                        <div><span className="text-gray-500">Current Ratio</span><div className="text-gray-200 font-medium">{r.currentRatio?.toFixed(2) || "N/A"}</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left py-2 pr-4">Year</th>
                      <th className="text-right py-2 px-2">Total Debt</th>
                      <th className="text-right py-2 px-2">Total Equity</th>
                      <th className="text-right py-2 px-2">D/E</th>
                      <th className="text-right py-2 px-2">Current Ratio</th>
                      <th className="text-right py-2 pl-2">FCF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(balance || []).map((yr: any, i: number) => {
                      const r = ratios?.[i] || {};
                      const cf = cashflow?.[i] || {};
                      return (
                        <tr key={yr.date} className={i % 2 === 0 ? "bg-gray-900/50" : ""}>
                          <td className="py-2 pr-4 font-medium text-white">{yr.fiscalYear || yr.calendarYear || yr.date?.substring(0, 4)}</td>
                          <td className="py-2 px-2 text-right text-gray-300">{formatCurrency(yr.totalDebt || 0, true)}</td>
                          <td className="py-2 px-2 text-right text-gray-300">{formatCurrency(yr.totalStockholdersEquity || 0, true)}</td>
                          <td className="py-2 px-2 text-right text-gray-300">{r.debtToEquityRatio?.toFixed(2) || "N/A"}</td>
                          <td className="py-2 px-2 text-right text-gray-300">{r.currentRatio?.toFixed(2) || "N/A"}</td>
                          <td className="py-2 pl-2 text-right text-gray-300">{formatCurrency(cf.freeCashFlow || 0, true)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "returns" && (
        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Return Metrics Trend</h3>
            {mobile ? (
              <div className="space-y-3">
                {(metrics || []).map((yr: any, i: number) => {
                  const cf = cashflow?.[i] || {};
                  const r = ratios?.[i] || {};
                  return (
                    <div key={yr.date} className="bg-gray-900/50 rounded-xl p-3 space-y-2">
                      <span className="text-sm font-bold text-white">{yr.fiscalYear || yr.date?.substring(0, 4)}</span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-gray-500">ROE</span><div className="text-gray-200 font-medium">{yr.returnOnEquity != null ? formatPercent(yr.returnOnEquity * 100) : "N/A"}</div></div>
                        <div><span className="text-gray-500">ROIC</span><div className="text-gray-200 font-medium">{yr.returnOnCapitalEmployed != null ? formatPercent(yr.returnOnCapitalEmployed * 100) : "N/A"}</div></div>
                        <div><span className="text-gray-500">Div/Share</span><div className="text-gray-200 font-medium">{r.dividendPerShare?.toFixed(2) || "N/A"}</div></div>
                        <div><span className="text-gray-500">Buybacks</span><div className="text-gray-200 font-medium">{cf.commonStockRepurchased ? formatCurrency(Math.abs(cf.commonStockRepurchased), true) : "N/A"}</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left py-2 pr-4">Year</th>
                      <th className="text-right py-2 px-2">ROE</th>
                      <th className="text-right py-2 px-2">ROIC</th>
                      <th className="text-right py-2 px-2">Div/Share</th>
                      <th className="text-right py-2 px-2">Payout %</th>
                      <th className="text-right py-2 pl-2">Buybacks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(metrics || []).map((yr: any, i: number) => {
                      const cf = cashflow?.[i] || {};
                      const r = ratios?.[i] || {};
                      return (
                        <tr key={yr.date} className={i % 2 === 0 ? "bg-gray-900/50" : ""}>
                          <td className="py-2 pr-4 font-medium text-white">{yr.fiscalYear || yr.date?.substring(0, 4)}</td>
                          <td className="py-2 px-2 text-right text-gray-300">{yr.returnOnEquity != null ? formatPercent(yr.returnOnEquity * 100) : "N/A"}</td>
                          <td className="py-2 px-2 text-right text-gray-300">{yr.returnOnCapitalEmployed != null ? formatPercent(yr.returnOnCapitalEmployed * 100) : "N/A"}</td>
                          <td className="py-2 px-2 text-right text-gray-300">{r.dividendPerShare?.toFixed(2) || "N/A"}</td>
                          <td className="py-2 px-2 text-right text-gray-300">{r.dividendPayoutRatio != null ? formatPercent(r.dividendPayoutRatio * 100) : "N/A"}</td>
                          <td className="py-2 pl-2 text-right text-gray-300">{cf.commonStockRepurchased ? formatCurrency(Math.abs(cf.commonStockRepurchased), true) : "N/A"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "fcf" && <FCFTab ticker={ticker} />}

      {activeTab === "earnings" && <EarningsTab ticker={ticker} />}
    </div>

    {/* History sidebar */}
    {!mobile && (
      <div className="w-64 shrink-0 hidden lg:block">
        <div className="sticky top-20">
          <Card className="!p-3">
            <AnalysisHistory currentTicker={ticker} />
          </Card>
        </div>
      </div>
    )}

    {/* Mobile history - collapsible at bottom */}
    {mobile && (
      <Card className="!p-3">
        <AnalysisHistory currentTicker={ticker} />
      </Card>
    )}
    </div>
  );
}

function FCFTab({ ticker }: { ticker: string }) {
  const [data, setData] = useState<any[]>([]);
  const [period, setPeriod] = useState<"annual" | "quarter">("annual");
  const [loading, setLoading] = useState(true);
  const mobile = useIsMobile();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/${ticker}/fcf?period=${period}&limit=40`);
        const json = await res.json();
        setData(json.data || []);
      } catch {
        setData([]);
      }
      setLoading(false);
    }
    load();
  }, [ticker, period]);

  if (loading) return <div className="skeleton h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["annual", "quarter"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 sm:py-1.5 rounded-lg text-sm font-medium transition-all min-h-[40px] ${
              period === p ? "bg-indigo-600 text-white" : "bg-gray-900 text-gray-400 hover:text-white"
            }`}
          >
            {p === "annual" ? "Annual" : "Quarterly"}
          </button>
        ))}
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">FCF Per Share</h3>
        {mobile ? (
          <div className="space-y-3">
            {data.map((item: any) => (
              <div key={item.date} className="bg-gray-900/50 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{item.date?.substring(0, 10)}</span>
                  <span className="text-emerald-400 font-bold text-sm">${(item.fcfPerShare || 0).toFixed(2)}/sh</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-500">FCF</span><div className="text-gray-200 font-medium">{formatCurrency(item.freeCashFlow || 0, true)}</div></div>
                  <div><span className="text-gray-500">SBC</span><div className="text-amber-400 font-medium">{formatCurrency(item.stockBasedCompensation || 0, true)}</div></div>
                  <div><span className="text-gray-500">Op. Cash Flow</span><div className="text-gray-200 font-medium">{formatCurrency(item.operatingCashFlow || 0, true)}</div></div>
                  <div><span className="text-gray-500">CapEx</span><div className="text-red-400 font-medium">{formatCurrency(item.capitalExpenditure || 0, true)}</div></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left py-2">Period</th>
                  <th className="text-right py-2">FCF</th>
                  <th className="text-right py-2">FCF/Share</th>
                  <th className="text-right py-2">SBC</th>
                  <th className="text-right py-2">Op. Cash Flow</th>
                  <th className="text-right py-2">CapEx</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item: any, i: number) => (
                  <tr key={item.date} className={i % 2 === 0 ? "bg-gray-900/50" : ""}>
                    <td className="py-2 font-medium text-white">{item.date?.substring(0, 10)}</td>
                    <td className="py-2 text-right text-gray-300">{formatCurrency(item.freeCashFlow || 0, true)}</td>
                    <td className="py-2 text-right text-emerald-400 font-semibold">${(item.fcfPerShare || 0).toFixed(2)}</td>
                    <td className="py-2 text-right text-amber-400">{formatCurrency(item.stockBasedCompensation || 0, true)}</td>
                    <td className="py-2 text-right text-gray-300">{formatCurrency(item.operatingCashFlow || 0, true)}</td>
                    <td className="py-2 text-right text-red-400">{formatCurrency(item.capitalExpenditure || 0, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function EarningsTab({ ticker }: { ticker: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState(3);
  const mobile = useIsMobile();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/${ticker}/earnings`);
        const json = await res.json();
        setData(json);
      } catch {
        setData(null);
      }
      setLoading(false);
    }
    load();
  }, [ticker]);

  if (loading) return <div className="skeleton h-64 w-full" />;

  const next = data?.nextEarnings;
  const allPast = data?.past || [];

  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - yearFilter);
  const past = allPast.filter((e: any) => e.date && new Date(e.date) >= cutoffDate);

  const beatCount = past.filter((e: any) => e.eps != null && e.epsEstimated != null && e.eps > e.epsEstimated).length;
  const missCount = past.filter((e: any) => e.eps != null && e.epsEstimated != null && e.eps < e.epsEstimated).length;
  const meetCount = past.filter((e: any) => e.eps != null && e.epsEstimated != null && Math.abs(e.eps - e.epsEstimated) < 0.005).length;

  return (
    <div className="space-y-4">
      {next && (
        <Card glow className="border-orange-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-orange-400">Next Earnings Report</h3>
              <p className="text-2xl font-bold text-white mt-1">{next.date}</p>
              {next.time && (
                <Badge variant="blue" className="mt-2">
                  {next.time === "bmo" ? "Before Market Open" : next.time === "amc" ? "After Market Close" : next.time}
                </Badge>
              )}
            </div>
            <div className="sm:text-right flex sm:flex-col gap-3 sm:gap-1">
              {next.epsEstimated != null && (
                <div className="text-sm text-gray-400">
                  EPS Est: <span className="text-white font-semibold">${Number(next.epsEstimated).toFixed(2)}</span>
                </div>
              )}
              {next.revenueEstimated != null && (
                <div className="text-sm text-gray-400">
                  Rev Est: <span className="text-white font-semibold">{formatCurrency(next.revenueEstimated, true)}</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {!next && (
        <Card className="text-center py-6 border-gray-800">
          <p className="text-gray-500 text-sm">No upcoming earnings date scheduled yet</p>
        </Card>
      )}

      {allPast.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Lookback:</span>
            {[1, 2, 3, 4, 5].map((y) => (
              <button
                key={y}
                onClick={() => setYearFilter(y)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  yearFilter === y ? "bg-indigo-600 text-white" : "bg-gray-900 text-gray-400 hover:text-white"
                }`}
              >
                {y}Y
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="!p-3 text-center">
              <div className="text-[11px] text-gray-500 uppercase">Beat</div>
              <div className="text-lg font-bold text-emerald-400">{beatCount}</div>
            </Card>
            <Card className="!p-3 text-center">
              <div className="text-[11px] text-gray-500 uppercase">Meet</div>
              <div className="text-lg font-bold text-blue-400">{meetCount}</div>
            </Card>
            <Card className="!p-3 text-center">
              <div className="text-[11px] text-gray-500 uppercase">Miss</div>
              <div className="text-lg font-bold text-red-400">{missCount}</div>
            </Card>
            <Card className="!p-3 text-center">
              <div className="text-[11px] text-gray-500 uppercase">Beat %</div>
              <div className="text-lg font-bold text-white">
                {(beatCount + missCount + meetCount) > 0 ? `${((beatCount / (beatCount + missCount + meetCount)) * 100).toFixed(0)}%` : "N/A"}
              </div>
            </Card>
          </div>

          <Card>
            <h3 className="text-sm font-semibold text-gray-400 mb-3">
              Earnings History <span className="text-gray-600 text-xs ml-1">(last {yearFilter} {yearFilter === 1 ? "year" : "years"})</span>
            </h3>
            {mobile ? (
              <div className="space-y-2">
                {past.map((e: any, i: number) => {
                  const epsSurprise = e.epsEstimated != null && e.eps != null && Math.abs(e.epsEstimated) > 0.001
                    ? ((e.eps - e.epsEstimated) / Math.abs(e.epsEstimated) * 100)
                    : null;
                  const beat = epsSurprise !== null && epsSurprise >= 0;
                  return (
                    <div key={e.date + i} className="bg-gray-900/50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white">{e.date}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${epsSurprise != null ? (beat ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400") : "bg-gray-800 text-gray-500"}`}>
                          {epsSurprise != null ? `${beat ? "+" : ""}${epsSurprise.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-gray-500">EPS Est</span><div className="text-gray-300">{e.epsEstimated != null ? `$${Number(e.epsEstimated).toFixed(2)}` : "—"}</div></div>
                        <div><span className="text-gray-500">EPS Actual</span><div className="text-white font-medium">{e.eps != null ? `$${Number(e.eps).toFixed(2)}` : "—"}</div></div>
                        <div><span className="text-gray-500">Rev Est</span><div className="text-gray-300">{e.revenueEstimated ? formatCurrency(e.revenueEstimated, true) : "—"}</div></div>
                        <div><span className="text-gray-500">Rev Actual</span><div className="text-white font-medium">{e.revenue ? formatCurrency(e.revenue, true) : "—"}</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left py-2 pr-4">Date</th>
                      <th className="text-right py-2 px-2">EPS Est</th>
                      <th className="text-right py-2 px-2">EPS Actual</th>
                      <th className="text-right py-2 px-2">Surprise</th>
                      <th className="text-right py-2 px-2">Rev Est</th>
                      <th className="text-right py-2 pl-2">Rev Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {past.map((e: any, i: number) => {
                      const epsSurprise = e.epsEstimated != null && e.eps != null && Math.abs(e.epsEstimated) > 0.001
                        ? ((e.eps - e.epsEstimated) / Math.abs(e.epsEstimated) * 100)
                        : null;
                      const beat = epsSurprise !== null && epsSurprise >= 0;
                      return (
                        <tr key={e.date + i} className={i % 2 === 0 ? "bg-gray-900/50" : ""}>
                          <td className="py-2 pr-4 font-medium text-white">{e.date}</td>
                          <td className="py-2 px-2 text-right text-gray-400">
                            {e.epsEstimated != null ? `$${Number(e.epsEstimated).toFixed(2)}` : "—"}
                          </td>
                          <td className="py-2 px-2 text-right text-white font-medium">
                            {e.eps != null ? `$${Number(e.eps).toFixed(2)}` : "—"}
                          </td>
                          <td className={`py-2 px-2 text-right font-semibold ${epsSurprise != null ? (beat ? "text-emerald-400" : "text-red-400") : "text-gray-600"}`}>
                            {epsSurprise != null ? `${beat ? "+" : ""}${epsSurprise.toFixed(1)}%` : "—"}
                          </td>
                          <td className="py-2 px-2 text-right text-gray-400">
                            {e.revenueEstimated ? formatCurrency(e.revenueEstimated, true) : "—"}
                          </td>
                          <td className="py-2 pl-2 text-right text-white font-medium">
                            {e.revenue ? formatCurrency(e.revenue, true) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {allPast.length === 0 && (
        <Card className="text-center py-6">
          <p className="text-gray-500 text-sm">No earnings history available</p>
        </Card>
      )}
    </div>
  );
}

function HealthStatusBar({
  debtToEquity,
  currentRatio,
  interestCoverage,
  fcf,
  roe,
  fcfMargin,
}: {
  debtToEquity: number | null;
  currentRatio: number | null;
  interestCoverage: number | null;
  fcf: number | null;
  roe: number | null;
  fcfMargin: number | null;
}) {
  type Level = "strong" | "moderate" | "weak" | "na";

  function grade(val: number | null | undefined, thresholds: { strong: (v: number) => boolean; weak: (v: number) => boolean }): Level {
    if (val == null || isNaN(val)) return "na";
    if (thresholds.strong(val)) return "strong";
    if (thresholds.weak(val)) return "weak";
    return "moderate";
  }

  const indicators: { label: string; value: string; level: Level; desc: string }[] = [
    {
      label: "Debt/Equity",
      value: debtToEquity != null ? debtToEquity.toFixed(2) : "N/A",
      level: grade(debtToEquity, { strong: (v) => v < 0.5, weak: (v) => v > 1.5 }),
      desc: debtToEquity != null ? (debtToEquity < 0.5 ? "Low leverage" : debtToEquity > 1.5 ? "High leverage" : "Moderate leverage") : "",
    },
    {
      label: "Current Ratio",
      value: currentRatio != null ? currentRatio.toFixed(2) : "N/A",
      level: grade(currentRatio, { strong: (v) => v > 1.5, weak: (v) => v < 1.0 }),
      desc: currentRatio != null ? (currentRatio > 1.5 ? "Strong liquidity" : currentRatio < 1.0 ? "Liquidity risk" : "Adequate liquidity") : "",
    },
    {
      label: "Interest Coverage",
      value: interestCoverage != null ? `${interestCoverage.toFixed(1)}x` : "N/A",
      level: interestCoverage === 0 ? "strong" : grade(interestCoverage, { strong: (v) => v > 5, weak: (v) => v < 2 }),
      desc: interestCoverage != null ? (interestCoverage === 0 ? "Debt-free" : interestCoverage > 5 ? "Well covered" : interestCoverage < 2 ? "Debt strain" : "Manageable") : "",
    },
    {
      label: "Free Cash Flow",
      value: fcf != null ? (Math.abs(fcf) >= 1e9 ? `$${(fcf / 1e9).toFixed(1)}B` : `$${(fcf / 1e6).toFixed(0)}M`) : "N/A",
      level: grade(fcf, { strong: (v) => v > 0, weak: (v) => v <= 0 }),
      desc: fcf != null ? (fcf > 0 ? "Cash generative" : "Cash burn") : "",
    },
    {
      label: "ROE",
      value: roe != null ? `${(roe * 100).toFixed(1)}%` : "N/A",
      level: grade(roe, { strong: (v) => v > 0.15, weak: (v) => v < 0.10 }),
      desc: roe != null ? (roe > 0.15 ? "High returns" : roe < 0.10 ? "Low returns" : "Average returns") : "",
    },
    {
      label: "FCF Margin",
      value: fcfMargin != null ? `${(fcfMargin * 100).toFixed(1)}%` : "N/A",
      level: grade(fcfMargin, { strong: (v) => v > 0.15, weak: (v) => v < 0.05 }),
      desc: fcfMargin != null ? (fcfMargin > 0.15 ? "Excellent conversion" : fcfMargin < 0.05 ? "Thin conversion" : "Decent conversion") : "",
    },
  ];

  const strongCount = indicators.filter((x) => x.level === "strong").length;
  const weakCount = indicators.filter((x) => x.level === "weak").length;
  const scored = indicators.filter((x) => x.level !== "na").length;
  const overallPct = scored > 0 ? (strongCount / scored) * 100 : 0;
  const overallLabel = weakCount >= 3 ? "Weak" : strongCount >= 4 ? "Strong" : "Moderate";
  const overallColor = weakCount >= 3 ? "text-red-400" : strongCount >= 4 ? "text-emerald-400" : "text-amber-400";
  const barColor = weakCount >= 3 ? "bg-red-500" : strongCount >= 4 ? "bg-emerald-500" : "bg-amber-500";

  const levelStyles: Record<Level, { bg: string; text: string; dot: string }> = {
    strong: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
    moderate: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
    weak: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
    na: { bg: "bg-gray-800/50", text: "text-gray-500", dot: "bg-gray-600" },
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-400">Financial Health Score</h3>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${overallColor}`}>{overallLabel}</span>
          <span className="text-xs text-gray-500">({strongCount}/{scored} strong)</span>
        </div>
      </div>

      <div className="w-full h-2.5 bg-gray-800 rounded-full mb-5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${Math.max(overallPct, 5)}%` }}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {indicators.map((ind) => {
          const s = levelStyles[ind.level];
          return (
            <div key={ind.label} className={`rounded-xl p-3 ${s.bg} border border-transparent`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                <span className="text-[11px] text-gray-500 uppercase">{ind.label}</span>
              </div>
              <div className={`text-base font-bold ${s.text}`}>{ind.value}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{ind.desc}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
