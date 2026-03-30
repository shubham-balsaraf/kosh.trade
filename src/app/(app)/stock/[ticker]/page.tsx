"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import FCFChart from "@/components/charts/FCFChart";
import FCFvsSBCChart from "@/components/charts/FCFvsSBCChart";
import PriceChart from "@/components/charts/PriceChart";
import MarginChart from "@/components/charts/MarginChart";
import AIAnalysis from "@/components/stock/AIAnalysis";

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

export default function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("ai");
  const [verdict, setVerdict] = useState<VerdictTheme>(null);

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
        const res = await fetch(`/api/stocks/${ticker}`);
        if (!res.ok) throw new Error("Stock not found");
        const json = await res.json();
        setData(json);
        
        if (json.profile) {
          fetch(`/api/stocks/${ticker}/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyName: json.profile.companyName,
              sector: json.profile.sector,
            }),
          }).catch(() => {});
        }
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    }
    load();
  }, [ticker]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-20 w-full" />
        <div className="skeleton h-10 w-80" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-24" />)}
        </div>
        <div className="skeleton h-64 w-full" />
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

  const tabs: { key: Tab; label: string }[] = [
    { key: "ai", label: "AI Analysis" },
    { key: "overview", label: "Overview" },
    { key: "charts", label: "Charts" },
    { key: "valuation", label: "Valuation" },
    { key: "growth", label: "Growth" },
    { key: "health", label: "Health" },
    { key: "returns", label: "Returns" },
    { key: "fcf", label: "FCF Data" },
    { key: "earnings", label: "Earnings" },
  ];

  return (
    <div className="space-y-4 relative">
      {/* Subtle verdict gradient overlay at the top */}
      {verdict && (
        <div className={`absolute top-0 left-0 right-0 h-48 bg-gradient-to-b ${t.gradient} rounded-3xl pointer-events-none -z-0`} />
      )}

      {/* Thin accent bar */}
      {verdict && (
        <div className={`h-0.5 ${t.bar} rounded-full opacity-40 -mb-2`} />
      )}

      {/* Header */}
      <div className={`flex flex-wrap items-start justify-between gap-4 relative z-10 rounded-2xl p-4 -mx-4 transition-all duration-700 ${verdict ? `${t.stripBg} border ${t.stripBorder}` : ""}`}>
        <div>
          <div className="flex items-center gap-3">
            <h1 className={`text-3xl font-black transition-colors duration-700 ${verdict ? t.accent : "text-white"}`}>
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
          <p className="text-gray-500 text-sm mt-1">{p.companyName || q.name || ticker}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white">{formatCurrency(q.price || 0)}</div>
          <div className={`text-sm font-semibold ${priceChangePositive ? "text-emerald-400" : "text-red-400"}`}>
            {priceChangePositive ? "+" : ""}{formatCurrency(q.change || 0)} ({formatPercent(q.changePercentage ?? q.changesPercentage ?? 0)})
          </div>
        </div>
      </div>

      {/* Key metrics strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Market Cap", value: formatCurrency(q.marketCap || 0, true) },
          { label: "52W High", value: formatCurrency(q.yearHigh || 0) },
          { label: "52W Low", value: formatCurrency(q.yearLow || 0) },
          { label: "P/E Ratio", value: (q.pe || latestRatios.priceEarningsRatio || 0).toFixed(1) + "x" },
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
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === key
                ? `${t.tabActive} text-white shadow-md`
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-900/50"
            }`}
          >
            {activeTab === key && <span className={`w-1.5 h-1.5 rounded-full ${t.dot} animate-pulse`} />}
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
                  { label: "ROE", value: latestRatios.returnOnEquity },
                  { label: "ROIC", value: latestRatios.returnOnCapitalEmployed },
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
                  { label: "Debt/Equity", value: latestRatios.debtEquityRatio?.toFixed(2) },
                  { label: "Current Ratio", value: latestRatios.currentRatio?.toFixed(2) },
                  { label: "Interest Coverage", value: latestRatios.interestCoverage?.toFixed(1) + "x" },
                  { label: "FCF", value: formatCurrency(latestCashflow.freeCashFlow || 0, true) },
                  { label: "Dividend Yield", value: q.dividendYield ? formatPercent(q.dividendYield) : "N/A" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-white font-medium">{value || "N/A"}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
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
                    <td className="py-2 pr-4 font-medium text-white">{yr.calendarYear || yr.date?.substring(0, 4)}</td>
                    <td className="py-2 px-2 text-right text-gray-300">{formatCurrency(yr.revenue || 0, true)}</td>
                    <td className="py-2 px-2 text-right text-gray-300">{formatCurrency(yr.netIncome || 0, true)}</td>
                    <td className="py-2 px-2 text-right text-gray-300">{(yr.epsdiluted || 0).toFixed(2)}</td>
                    <td className="py-2 px-2 text-right text-gray-300">{yr.grossProfitRatio ? formatPercent(yr.grossProfitRatio * 100) : "N/A"}</td>
                    <td className="py-2 px-2 text-right text-gray-300">{yr.operatingIncomeRatio ? formatPercent(yr.operatingIncomeRatio * 100) : "N/A"}</td>
                    <td className="py-2 pl-2 text-right text-gray-300">{yr.netIncomeRatio ? formatPercent(yr.netIncomeRatio * 100) : "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === "valuation" && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Valuation Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "P/E (TTM)", value: q.pe || latestRatios.priceEarningsRatio },
              { label: "P/E (Forward)", value: latestMetrics.peRatio },
              { label: "EV/EBITDA", value: latestMetrics.enterpriseValueOverEBITDA },
              { label: "P/S", value: latestRatios.priceToSalesRatio },
              { label: "P/B", value: latestRatios.priceToBookRatio },
              { label: "P/FCF", value: latestRatios.priceToFreeCashFlowsRatio },
              { label: "PEG Ratio", value: latestRatios.priceEarningsToGrowthRatio },
              { label: "EV/Revenue", value: latestMetrics.evToSales },
              { label: "Dividend Yield", value: q.dividendYield ? `${q.dividendYield.toFixed(2)}%` : "N/A" },
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
          <Card>
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Balance Sheet Trend</h3>
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
                        <td className="py-2 pr-4 font-medium text-white">{yr.calendarYear || yr.date?.substring(0, 4)}</td>
                        <td className="py-2 px-2 text-right text-gray-300">{formatCurrency(yr.totalDebt || 0, true)}</td>
                        <td className="py-2 px-2 text-right text-gray-300">{formatCurrency(yr.totalStockholdersEquity || 0, true)}</td>
                        <td className="py-2 px-2 text-right text-gray-300">{r.debtEquityRatio?.toFixed(2) || "N/A"}</td>
                        <td className="py-2 px-2 text-right text-gray-300">{r.currentRatio?.toFixed(2) || "N/A"}</td>
                        <td className="py-2 pl-2 text-right text-gray-300">{formatCurrency(cf.freeCashFlow || 0, true)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "returns" && (
        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Return Metrics Trend</h3>
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
                  {(ratios || []).map((yr: any, i: number) => {
                    const cf = cashflow?.[i] || {};
                    return (
                      <tr key={yr.date} className={i % 2 === 0 ? "bg-gray-900/50" : ""}>
                        <td className="py-2 pr-4 font-medium text-white">{yr.date?.substring(0, 4)}</td>
                        <td className="py-2 px-2 text-right text-gray-300">{yr.returnOnEquity != null ? formatPercent(yr.returnOnEquity * 100) : "N/A"}</td>
                        <td className="py-2 px-2 text-right text-gray-300">{yr.returnOnCapitalEmployed != null ? formatPercent(yr.returnOnCapitalEmployed * 100) : "N/A"}</td>
                        <td className="py-2 px-2 text-right text-gray-300">{yr.dividendPerShare?.toFixed(2) || "N/A"}</td>
                        <td className="py-2 px-2 text-right text-gray-300">{yr.payoutRatio != null ? formatPercent(yr.payoutRatio * 100) : "N/A"}</td>
                        <td className="py-2 pl-2 text-right text-gray-300">{cf.commonStockRepurchased ? formatCurrency(Math.abs(cf.commonStockRepurchased), true) : "N/A"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "fcf" && <FCFTab ticker={ticker} />}

      {activeTab === "earnings" && <EarningsTab ticker={ticker} />}
    </div>
  );
}

function FCFTab({ ticker }: { ticker: string }) {
  const [data, setData] = useState<any[]>([]);
  const [period, setPeriod] = useState<"annual" | "quarter">("annual");
  const [loading, setLoading] = useState(true);

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
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              period === p ? "bg-indigo-600 text-white" : "bg-gray-900 text-gray-400 hover:text-white"
            }`}
          >
            {p === "annual" ? "Annual" : "Quarterly"}
          </button>
        ))}
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">FCF Per Share</h3>
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
      </Card>
    </div>
  );
}

function EarningsTab({ ticker }: { ticker: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
  const past = data?.past || [];

  const beatCount = past.filter((e: any) => e.eps != null && e.epsEstimated != null && e.eps > e.epsEstimated).length;
  const missCount = past.filter((e: any) => e.eps != null && e.epsEstimated != null && e.eps < e.epsEstimated).length;

  return (
    <div className="space-y-4">
      {next && (
        <Card glow className="border-orange-500/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-orange-400">Next Earnings Report</h3>
              <p className="text-2xl font-bold text-white mt-1">{next.date}</p>
              {next.time && (
                <Badge variant="blue" className="mt-2">
                  {next.time === "bmo" ? "Before Market Open" : next.time === "amc" ? "After Market Close" : next.time}
                </Badge>
              )}
            </div>
            <div className="text-right space-y-1">
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

      {past.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="!p-3 text-center">
              <div className="text-[11px] text-gray-500 uppercase">Beat</div>
              <div className="text-lg font-bold text-emerald-400">{beatCount}</div>
            </Card>
            <Card className="!p-3 text-center">
              <div className="text-[11px] text-gray-500 uppercase">Miss</div>
              <div className="text-lg font-bold text-red-400">{missCount}</div>
            </Card>
            <Card className="!p-3 text-center">
              <div className="text-[11px] text-gray-500 uppercase">Beat %</div>
              <div className="text-lg font-bold text-white">
                {(beatCount + missCount) > 0 ? `${((beatCount / (beatCount + missCount)) * 100).toFixed(0)}%` : "N/A"}
              </div>
            </Card>
          </div>

          <Card>
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Earnings History</h3>
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
          </Card>
        </>
      )}

      {past.length === 0 && (
        <Card className="text-center py-6">
          <p className="text-gray-500 text-sm">No earnings history available</p>
        </Card>
      )}
    </div>
  );
}
