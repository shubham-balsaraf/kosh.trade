"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useIsMobile } from "@/hooks/useMediaQuery";

interface AIAnalysisProps {
  ticker: string;
  onVerdictChange?: (signal: string | null) => void;
}

type AnalysisTab = "verdict" | "valuation" | "growth" | "health" | "returns" | "scenarios";

const HORIZONS = ["3 years", "5 years", "7 years", "10 years"];
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function cacheKey(ticker: string) {
  return `kosh-analysis-${ticker.toUpperCase()}`;
}

function loadCached(ticker: string) {
  try {
    const raw = sessionStorage.getItem(cacheKey(ticker));
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      sessionStorage.removeItem(cacheKey(ticker));
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function saveCache(ticker: string, analysis: any, horizon: string) {
  try {
    sessionStorage.setItem(
      cacheKey(ticker),
      JSON.stringify({ analysis, horizon, timestamp: Date.now() })
    );
  } catch { /* storage full — not critical */ }
}

function VerdictBadge({ signal }: { signal: string }) {
  const config: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    CONSIDER: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", icon: "🟢" },
    MODERATE: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", icon: "🟡" },
    AVOID: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", icon: "🔴" },
  };
  const c = config[signal] || config.MODERATE;
  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl px-4 sm:px-6 py-4 text-center`}>
      <span className="text-2xl sm:text-3xl">{c.icon}</span>
      <span className={`text-xl sm:text-2xl font-black ml-2 sm:ml-3 ${c.text}`}>{signal}</span>
    </div>
  );
}

function SignalBadge({ signal }: { signal: string }) {
  const green = ["CHEAP", "SAFE", "STRONG", "HEALTHY", "GOOD", "ACCELERATING", "HIGH-QUALITY COMPOUNDER", "UNDERVALUED"];
  const yellow = ["FAIR", "MODERATE", "STABLE", "WATCH", "AVERAGE", "STEADY", "FAIRLY VALUED", "AVERAGE RETURNS", "MIXED", "DIVIDEND PLAY"];
  if (green.includes(signal)) return <Badge variant="green">{signal}</Badge>;
  if (yellow.includes(signal)) return <Badge variant="yellow">{signal}</Badge>;
  return <Badge variant="red">{signal}</Badge>;
}

export default function AIAnalysis({ ticker, onVerdictChange }: AIAnalysisProps) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [horizon, setHorizon] = useState("5 years");
  const [tab, setTab] = useState<AnalysisTab>("verdict");
  const [fromCache, setFromCache] = useState(false);
  const mobile = useIsMobile();

  useEffect(() => {
    const cached = loadCached(ticker);
    if (cached) {
      setAnalysis(cached.analysis);
      setHorizon(cached.horizon);
      setFromCache(true);
      onVerdictChange?.(cached.analysis?.verdict?.signal || null);
    }
  }, [ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnalysisResult = useCallback(
    (result: any, h: string) => {
      setAnalysis(result);
      setFromCache(false);
      saveCache(ticker, result, h);
      onVerdictChange?.(result?.verdict?.signal || null);
    },
    [ticker, onVerdictChange]
  );

  async function runAnalysis() {
    setLoading(true);
    setError("");
    setAnalysis(null);
    onVerdictChange?.(null);
    try {
      const res = await fetch(`/api/stocks/${ticker}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizon }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      handleAnalysisResult(json.analysis, horizon);
      setTab("verdict");
    } catch (e: any) {
      setError(e.message || "Analysis failed");
    }
    setLoading(false);
  }

  function clearAndRerun() {
    sessionStorage.removeItem(cacheKey(ticker));
    setAnalysis(null);
    setFromCache(false);
    setError("");
    onVerdictChange?.(null);
  }

  if (!analysis && !loading) {
    return (
      <Card className="text-center py-10 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white">AI Fundamental Analysis</h3>
          <p className="text-sm text-gray-500 mt-1">
            Powered by Claude — comprehensive view based on historical data
          </p>
        </div>
        <div className="flex justify-center gap-2 flex-wrap">
          {HORIZONS.map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                horizon === h ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {h}
            </button>
          ))}
        </div>
        <Button onClick={runAnalysis} className="!px-8">
          Run Analysis for {ticker.toUpperCase()}
        </Button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <p className="text-[11px] text-gray-600 max-w-md mx-auto">
          This is NOT investment advice. AI can make errors — verify independently.
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="text-center py-16">
        <div className="inline-block w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 mt-4 text-sm">Claude is analyzing {ticker.toUpperCase()}...</p>
        <p className="text-gray-600 text-xs mt-1">This takes 15-30 seconds</p>
      </Card>
    );
  }

  const a = analysis;
  const tabs: { key: AnalysisTab; label: string }[] = [
    { key: "verdict", label: "Verdict" },
    { key: "valuation", label: "Valuation" },
    { key: "growth", label: "Growth" },
    { key: "health", label: "Health" },
    { key: "returns", label: "Returns" },
    { key: "scenarios", label: "Scenarios" },
  ];

  const verdictSignal = a?.verdict?.signal || "MODERATE";
  const tabAccent: Record<string, string> = {
    CONSIDER: "bg-emerald-600",
    MODERATE: "bg-amber-600",
    AVOID: "bg-red-600",
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all min-h-[36px] ${
                tab === key
                  ? `${tabAccent[verdictSignal] || "bg-indigo-600"} text-white`
                  : "text-gray-500 hover:text-white hover:bg-gray-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 justify-end">
          {fromCache && (
            <span className="text-[10px] text-gray-600 italic">cached</span>
          )}
          <button
            onClick={clearAndRerun}
            className="px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:text-gray-300 transition-all"
          >
            Re-run
          </button>
        </div>
      </div>

      {tab === "verdict" && (
        <div className="space-y-4">
          <VerdictBadge signal={verdictSignal} />

          <Card>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <SignalBadge signal={a.verdict?.quality || "MODERATE"} />
                <span className="text-xs text-gray-500">Quality Rating</span>
                <span className="text-xs text-gray-600 ml-auto">Horizon: {horizon}</span>
              </div>
              <p className="text-sm text-gray-300">{a.verdict?.reason}</p>
              {a.overview?.summary && (
                <p className="text-sm text-gray-400 border-t border-gray-800 pt-3">{a.overview.summary}</p>
              )}
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <h4 className="text-xs font-semibold text-emerald-400 uppercase mb-3">Strengths</h4>
              <ul className="space-y-2">
                {(a.strengths || []).map((s: string, i: number) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-emerald-400 flex-shrink-0">✓</span>{s}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h4 className="text-xs font-semibold text-amber-400 uppercase mb-3">Watch Points</h4>
              <ul className="space-y-2">
                {(a.watchPoints || []).map((w: string, i: number) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-amber-400 flex-shrink-0">⚠</span>{w}
                  </li>
                ))}
              </ul>
              {a.track && (
                <p className="text-sm text-gray-400 mt-3 pt-3 border-t border-gray-800 flex gap-2">
                  <span className="text-blue-400 flex-shrink-0">→</span>{a.track}
                </p>
              )}
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <h4 className="text-xs font-semibold text-blue-400 uppercase mb-3">Opportunities</h4>
              <ul className="space-y-2">
                {(a.opportunities || []).map((o: string, i: number) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-blue-400 flex-shrink-0">+</span>{o}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h4 className="text-xs font-semibold text-red-400 uppercase mb-3">Risks</h4>
              <ul className="space-y-2">
                {(a.risks || []).map((r: string, i: number) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-red-400 flex-shrink-0">−</span>{r}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {a.timelineMatch && (
            <Card className="border-blue-500/20 bg-blue-950/20">
              <h4 className="text-xs font-semibold text-blue-400 uppercase mb-2">Timeline Match — {horizon}</h4>
              <p className="text-sm text-gray-300">{a.timelineMatch}</p>
            </Card>
          )}
        </div>
      )}

      {tab === "valuation" && a.valuation && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h4 className="text-sm font-semibold text-gray-400">
              Sector: {a.overview?.sector} — Primary: {a.valuation.primaryMetric}
            </h4>
            <SignalBadge signal={a.valuation.overall || "MIXED"} />
          </div>
          {mobile ? (
            <div className="space-y-2">
              {(a.valuation.metrics || []).map((m: any, i: number) => (
                <div key={i} className="bg-gray-900/50 rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">{m.name}</div>
                    <div className="text-xs text-gray-500 truncate">{m.explanation}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-gray-300 font-medium">{m.value}</span>
                    <SignalBadge signal={m.signal} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800">
                    <th className="text-left py-2 pr-4">Metric</th>
                    <th className="text-right py-2 px-2">Value</th>
                    <th className="text-center py-2 px-2">Signal</th>
                    <th className="text-left py-2 pl-2">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {(a.valuation.metrics || []).map((m: any, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-gray-900/50" : ""}>
                      <td className="py-2 pr-4 font-medium text-white">{m.name}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{m.value}</td>
                      <td className="py-2 px-2 text-center"><SignalBadge signal={m.signal} /></td>
                      <td className="py-2 pl-2 text-gray-500 text-xs">{m.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "growth" && a.growth && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-400">Growth Assessment</h4>
            <SignalBadge signal={a.growth.classification || "STEADY"} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Revenue CAGR (3Y)", value: a.growth.revenueCagr3y },
              { label: "Revenue CAGR (5Y)", value: a.growth.revenueCagr5y },
              { label: "Net Income CAGR (3Y)", value: a.growth.netIncomeCagr3y },
            ].filter(m => m.value != null).map(({ label, value }) => (
              <div key={label} className="bg-gray-900/50 rounded-xl p-3 text-center">
                <div className="text-[10px] text-gray-500 uppercase">{label}</div>
                <div className={`text-lg font-bold mt-1 ${(value as number) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {(value as number) >= 0 ? "+" : ""}{(value as number).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
          {a.growth.marginTrend && (
            <p className="text-sm text-gray-400 border-t border-gray-800 pt-3">{a.growth.marginTrend}</p>
          )}
        </Card>
      )}

      {tab === "health" && a.health && (
        <Card>
          <h4 className="text-sm font-semibold text-gray-400 mb-4">Financial Health</h4>
          <div className="space-y-3">
            {[
              { label: "Debt / Equity", data: a.health.debtEquity },
              { label: "Interest Coverage", data: a.health.interestCoverage },
              { label: "Current Ratio", data: a.health.currentRatio },
              { label: "Free Cash Flow", data: a.health.fcf },
            ].filter(m => m.data).map(({ label, data }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-gray-800/50">
                <span className="text-sm text-gray-400">{label}</span>
                <div className="flex items-center gap-3">
                  {data.value != null && (
                    <span className="text-sm text-white font-medium">
                      {typeof data.value === "number" ? data.value.toFixed(2) : data.value}
                    </span>
                  )}
                  <SignalBadge signal={data.signal} />
                </div>
              </div>
            ))}
            {a.health.fcf?.description && (
              <p className="text-xs text-gray-500 pt-2">{a.health.fcf.description}</p>
            )}
          </div>
        </Card>
      )}

      {tab === "returns" && a.returns && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-400">Return Quality</h4>
            <SignalBadge signal={a.returns.classification || "AVERAGE RETURNS"} />
          </div>
          <div className="space-y-3">
            {a.returns.roe && (
              <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
                <span className="text-sm text-gray-400">ROE (Current / 3Y Avg)</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white font-medium">
                    {a.returns.roe.current?.toFixed(1)}% / {a.returns.roe.avg3y?.toFixed(1)}%
                  </span>
                  <SignalBadge signal={a.returns.roe.signal} />
                </div>
              </div>
            )}
            {a.returns.roic && (
              <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
                <span className="text-sm text-gray-400">ROIC</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white font-medium">{a.returns.roic.current?.toFixed(1)}%</span>
                  <SignalBadge signal={a.returns.roic.signal} />
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {tab === "scenarios" && a.scenarios && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-red-500/20">
            <h4 className="text-xs font-semibold text-red-400 uppercase mb-3">Bear Case</h4>
            <p className="text-sm text-gray-300 leading-relaxed">{a.scenarios.bear}</p>
          </Card>
          <Card className="border-gray-500/20">
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Base Case</h4>
            <p className="text-sm text-gray-300 leading-relaxed">{a.scenarios.base}</p>
          </Card>
          <Card className="border-emerald-500/20">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase mb-3">Bull Case</h4>
            <p className="text-sm text-gray-300 leading-relaxed">{a.scenarios.bull}</p>
          </Card>
        </div>
      )}

      <p className="text-[10px] text-gray-600 text-center px-4">
        This tool is for fundamental screening and education only. Not investment advice. AI can make errors — verify independently. Past performance does not guarantee future results.
      </p>
    </div>
  );
}
