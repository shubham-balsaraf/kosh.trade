"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import StockLogo from "@/components/ui/StockLogo";
import Badge from "@/components/ui/Badge";
import {
  Trophy, Target, RefreshCw, ChevronDown, ChevronUp, Sparkles,
  Info, History, Radar, BarChart3,
  TrendingUp, TrendingDown, Shield, Crosshair, Clock,
  Flame, Search, Zap, Gem, Brain, Loader2,
  Activity, Gauge, BarChart2, Waves, Newspaper, Landmark,
} from "lucide-react";
import ProGate from "@/components/ui/ProGate";
import { useTrackView } from "@/hooks/useTrackView";

interface Pick {
  ticker: string;
  companyName: string;
  rank: number;
  conviction: number;
  dataConfidence?: number | null;
  targetPrice: number;
  currentPrice: number;
  upsidePct: number;
  holdPeriod: string;
  holdLabel: string;
  holdDays?: number | null;
  thesis: string;
  signals: string[];
  sector: string;
  latestPrice?: number;
  returnPct?: number | null;
  peakReturnPct?: number | null;
  outcome?: string | null;
  hitTarget?: boolean;
}

interface HistoryBatch {
  date: string;
  picks: Pick[];
  avgReturn: number;
  profitable: number;
  total: number;
  hitRate: number;
}

interface AlgoStats {
  totalPicks: number;
  winRate: number;
  targetHitRate: number;
  timelineAccuracy: number;
  avgReturn: number;
  avgPeakReturn: number;
  avgConfidence: number;
  outcomes: Record<string, number>;
  notableCalls: {
    ticker: string;
    companyName: string;
    predictedTarget: number;
    entryPrice: number;
    peakReturn: number;
    hitDays: number;
    outcome: string;
    pickedAt: string;
  }[];
  notableMisses: {
    ticker: string;
    companyName: string;
    predictedTarget: number;
    entryPrice: number;
    returnPct: number;
    pickedAt: string;
  }[];
}

const CACHE_KEY = "kosh:top-picks";
const HISTORY_CACHE_KEY = "kosh:top-picks:history";

const SIGNAL_COLORS: Record<string, string> = {
  news: "bg-blue-500/15 text-blue-400",
  insider: "bg-emerald-500/15 text-emerald-400",
  congress: "bg-purple-500/15 text-purple-400",
  screener: "bg-amber-500/15 text-amber-400",
  earnings: "bg-cyan-500/15 text-cyan-400",
  grades: "bg-indigo-500/15 text-indigo-400",
  press: "bg-rose-500/15 text-rose-400",
  merger: "bg-orange-500/15 text-orange-400",
  institutional: "bg-teal-500/15 text-teal-400",
  "8k": "bg-gray-500/15 text-gray-400",
};

const HOLD_CONFIG: Record<string, { color: string; bg: string }> = {
  SHORT: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  MEDIUM: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  LONG: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
};

const OUTCOME_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BULLSEYE: { label: "Bullseye", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  LATE_HIT: { label: "Late Hit", color: "text-blue-400", bg: "bg-blue-500/15" },
  WINNER: { label: "Winner", color: "text-amber-400", bg: "bg-amber-500/15" },
  MISS: { label: "Miss", color: "text-red-400", bg: "bg-red-500/15" },
  TRACKING: { label: "Tracking", color: "text-white/30", bg: "bg-white/5" },
};

const ANALYSIS_STEPS = [
  "Scanning 10+ signal sources across the market...",
  "Analyzing insider trading patterns & congress activity...",
  "Running technical indicators on 60+ candidates...",
  "Evaluating earnings momentum & analyst ratings...",
  "Cross-referencing institutional ownership changes...",
  "AI synthesizing conviction scores & theses...",
  "Ranking final picks by composite conviction...",
  "Generating investment rationale for top 10...",
];

function AnalysisLoader() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % ANALYSIS_STEPS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-full border-2 border-indigo-500/20 flex items-center justify-center">
          <Radar size={32} className="text-indigo-400 animate-spin" style={{ animationDuration: "3s" }} />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-indigo-400/40 animate-ping" style={{ animationDuration: "2s" }} />
      </div>
      <p className="text-white font-semibold text-lg mb-3">Generating Top 10 Picks</p>
      <p className="text-indigo-300/60 text-sm text-center max-w-md animate-pulse">
        {ANALYSIS_STEPS[step]}
      </p>
      <div className="flex gap-1.5 mt-6">
        {ANALYSIS_STEPS.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${i <= step ? "bg-indigo-400" : "bg-white/10"}`}
          />
        ))}
      </div>
    </div>
  );
}

function ConvictionBar({ value }: { value: number }) {
  const color = value >= 45 ? "bg-emerald-400" : value >= 25 ? "bg-blue-400" : value >= 15 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-[10px] text-white/40 font-mono w-6 text-right">{value}</span>
    </div>
  );
}

function ConfidenceGauge({ value }: { value: number }) {
  const [showTip, setShowTip] = useState(false);
  const color = value >= 80 ? "text-emerald-400 border-emerald-500/30" :
    value >= 50 ? "text-blue-400 border-blue-500/30" :
    "text-amber-400 border-amber-500/30";
  const bgColor = value >= 80 ? "bg-emerald-500/10" :
    value >= 50 ? "bg-blue-500/10" :
    "bg-amber-500/10";
  const label = value >= 80 ? "Excellent" : value >= 50 ? "Good" : "Limited";
  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border cursor-help ${color} ${bgColor}`}>
        <Shield size={10} />
        <span className="text-[10px] font-bold">{value}%</span>
      </div>
      {showTip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl border border-white/10 bg-[#0d0f14] shadow-2xl shadow-black/60 animate-fade-slide-up">
          <p className="text-[11px] font-bold text-white/80 mb-1.5">Kosh Confidence — {value}% ({label})</p>
          <p className="text-[10px] leading-relaxed text-white/40">
            Measures the depth and strength of evidence behind this pick — not just whether data existed,
            but whether there are real catalysts, insider/congress activity, strong fundamentals, and
            analyst coverage backing the prediction.
          </p>
          <p className="text-[10px] leading-relaxed text-white/40 mt-1.5">
            {value >= 80
              ? "Multiple strong signals (insider buys, catalysts, deep fundamentals, analyst targets) support this pick."
              : value >= 50
                ? "Solid data foundation with some gaps — fewer catalysts or limited smart-money activity."
                : "Limited supporting evidence — fewer catalysts, sparse fundamentals, or missing analyst coverage. Higher risk."}
          </p>
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 rotate-45 border-b border-r border-white/10 bg-[#0d0f14] -mt-1" />
        </div>
      )}
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const cfg = OUTCOME_CONFIG[outcome] || OUTCOME_CONFIG.TRACKING;
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function PredictionArrow({ upside }: { upside: number }) {
  const isUp = upside > 0;
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold ${isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
      {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {isUp ? "+" : ""}{upside}%
    </div>
  );
}

function PickCard({ pick, isExpanded, onToggle }: { pick: Pick; isExpanded: boolean; onToggle: () => void }) {
  const holdCfg = HOLD_CONFIG[pick.holdPeriod] || HOLD_CONFIG.MEDIUM;
  const rankColors = ["text-amber-400", "text-gray-300", "text-amber-600"];
  const rankColor = pick.rank <= 3 ? rankColors[pick.rank - 1] : "text-white/30";
  const isUp = pick.upsidePct > 0;

  return (
    <div className="glass-card border border-white/[0.04] hover:border-white/[0.08] transition-all duration-300">
      <button onClick={onToggle} className="w-full p-4 text-left">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xl font-black ${rankColor} w-7 text-center`}>
              {pick.rank <= 3 ? <Trophy size={18} className={rankColor} /> : `#${pick.rank}`}
            </span>
            <StockLogo ticker={pick.ticker} size={36} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">{pick.ticker}</span>
              <span className="text-white/25 text-xs truncate">{pick.companyName}</span>
              {pick.outcome && <OutcomeBadge outcome={pick.outcome} />}
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="w-28">
                <ConvictionBar value={pick.conviction} />
              </div>
              {pick.dataConfidence != null && pick.dataConfidence > 0 && (
                <ConfidenceGauge value={pick.dataConfidence} />
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-5 shrink-0">
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-[10px] text-white/25">Now</p>
                <p className="text-sm text-white font-semibold">${pick.currentPrice.toFixed(2)}</p>
              </div>
              <div className={`flex flex-col items-center px-1 ${isUp ? "text-emerald-400/40" : "text-red-400/40"}`}>
                <span className="text-[8px] font-bold">→</span>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/25">Kosh Target</p>
                <p className={`text-sm font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>${pick.targetPrice.toFixed(2)}</p>
              </div>
            </div>
            <PredictionArrow upside={pick.upsidePct} />
            <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold ${holdCfg.bg} ${holdCfg.color}`}>
              {pick.holdLabel}
            </div>
          </div>

          <ChevronDown size={16} className={`text-white/20 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </div>

        <div className="md:hidden flex items-center gap-3 mt-3 text-xs">
          <span className="text-white/40">${pick.currentPrice.toFixed(2)}</span>
          <span className={`text-[8px] ${isUp ? "text-emerald-400/40" : "text-red-400/40"}`}>→</span>
          <span className={`font-semibold ${isUp ? "text-emerald-400" : "text-red-400"}`}>${pick.targetPrice.toFixed(2)}</span>
          <PredictionArrow upside={pick.upsidePct} />
          <span className={`px-2 py-0.5 rounded border text-[10px] ${holdCfg.bg} ${holdCfg.color}`}>{pick.holdLabel}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04] pt-3 animate-fade-in">
          <div className={`rounded-lg px-3 py-2.5 text-xs ${isUp ? "bg-emerald-500/5 border border-emerald-500/10" : "bg-red-500/5 border border-red-500/10"}`}>
            <p className={`font-semibold mb-1 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
              Kosh Prediction: {pick.ticker} {isUp ? "will rise" : "may decline"} from ${pick.currentPrice.toFixed(2)} to ${pick.targetPrice.toFixed(2)} ({isUp ? "+" : ""}{pick.upsidePct}%)
            </p>
            <p className="text-white/30">
              Hold period: {pick.holdLabel} · Based on {pick.signals.length} signal source{pick.signals.length > 1 ? "s" : ""} ({pick.signals.join(", ")})
              {pick.dataConfidence != null && pick.dataConfidence > 0 ? ` · ${pick.dataConfidence}% data coverage` : ""}
            </p>
          </div>

          <div>
            <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1.5">Investment Thesis</p>
            <p className="text-sm text-white/60 leading-relaxed">{pick.thesis}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <p className="text-[10px] text-white/25 mb-1">Signal Sources</p>
              <div className="flex flex-wrap gap-1.5">
                {pick.signals.map((s) => (
                  <span key={s} className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${SIGNAL_COLORS[s] || "bg-white/5 text-white/40"}`}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-white/25 mb-1">Sector</p>
              <span className="text-xs text-white/50">{pick.sector}</span>
            </div>
            {pick.dataConfidence != null && pick.dataConfidence > 0 && (
              <div>
                <p className="text-[10px] text-white/25 mb-1">Data Coverage</p>
                <span className="text-xs text-white/50">{pick.dataConfidence}% of scoring dimensions had data</span>
              </div>
            )}
          </div>

          {pick.returnPct != null && (
            <div className="flex gap-4 pt-1">
              <div>
                <p className="text-[10px] text-white/25">Return Since Pick</p>
                <p className={`text-sm font-bold ${(pick.returnPct || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {(pick.returnPct || 0) >= 0 ? "+" : ""}{pick.returnPct}%
                </p>
              </div>
              {pick.peakReturnPct != null && (
                <div>
                  <p className="text-[10px] text-white/25">Peak Return</p>
                  <p className="text-sm font-bold text-blue-400">+{pick.peakReturnPct}%</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrackRecordSection({ history, onRefresh }: { history: HistoryBatch[]; onRefresh: () => void }) {
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <Card className="text-center py-10">
        <History size={32} className="mx-auto text-white/15 mb-3" />
        <p className="text-white/30 text-sm">No pick history yet. Generate your first batch above.</p>
      </Card>
    );
  }

  const allPicks = history.flatMap((b) => b.picks);
  const totalPicks = allPicks.length;
  const profitable = allPicks.filter((p) => (p.returnPct || 0) > 0).length;
  const avgReturn = totalPicks > 0 ? allPicks.reduce((s, p) => s + (p.returnPct || 0), 0) / totalPicks : 0;
  const avgPeakReturn = totalPicks > 0 ? allPicks.reduce((s, p) => s + (p.peakReturnPct || 0), 0) / totalPicks : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={18} className="text-white/30" />
          <h2 className="text-lg font-bold text-white">Pick Track Record</h2>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-white/30 hover:text-white/60 text-xs transition-all"
        >
          <RefreshCw size={12} />
          Update Prices
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="!p-3 text-center">
          <p className="text-2xl font-black text-white">{totalPicks}</p>
          <p className="text-[10px] text-white/30">Total Picks</p>
        </Card>
        <Card className="!p-3 text-center">
          <p className="text-2xl font-black text-emerald-400">{totalPicks > 0 ? Math.round((profitable / totalPicks) * 100) : 0}%</p>
          <p className="text-[10px] text-white/30">Win Rate</p>
        </Card>
        <Card className="!p-3 text-center">
          <p className={`text-2xl font-black ${avgReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {avgReturn >= 0 ? "+" : ""}{avgReturn.toFixed(1)}%
          </p>
          <p className="text-[10px] text-white/30">Avg Return</p>
        </Card>
        <Card className="!p-3 text-center">
          <p className="text-2xl font-black text-blue-400">+{avgPeakReturn.toFixed(1)}%</p>
          <p className="text-[10px] text-white/30">Avg Peak Return</p>
        </Card>
      </div>

      <div className="space-y-2">
        {history.map((batch) => (
          <div key={batch.date} className="glass-card border border-white/[0.04]">
            <button
              onClick={() => setExpandedBatch(expandedBatch === batch.date ? null : batch.date)}
              className="w-full p-3 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm text-white font-semibold">{new Date(batch.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                <span className="text-[10px] text-white/25">{batch.total} picks</span>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-xs font-bold ${batch.avgReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {batch.avgReturn >= 0 ? "+" : ""}{batch.avgReturn}% avg
                </span>
                <span className="text-[10px] text-white/25">{batch.hitRate}% profitable</span>
                <ChevronDown size={14} className={`text-white/20 transition-transform ${expandedBatch === batch.date ? "rotate-180" : ""}`} />
              </div>
            </button>
            {expandedBatch === batch.date && (
              <div className="px-3 pb-3 space-y-1.5 border-t border-white/[0.04] pt-2">
                {batch.picks.map((p) => (
                  <div key={p.ticker} className="flex items-center justify-between py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <StockLogo ticker={p.ticker} size={20} />
                      <span className="text-white font-medium">{p.ticker}</span>
                      <span className="text-white/20">{p.companyName}</span>
                      {p.outcome && <OutcomeBadge outcome={p.outcome} />}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-white/30">${p.currentPrice?.toFixed(2)}</span>
                      {p.latestPrice && <span className="text-white/50">${p.latestPrice.toFixed(2)}</span>}
                      <span className={`font-bold ${(p.returnPct || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {(p.returnPct || 0) >= 0 ? "+" : ""}{p.returnPct?.toFixed(1) || "0.0"}%
                      </span>
                      {p.peakReturnPct != null && (
                        <span className="text-blue-400/60 text-[10px]">peak +{p.peakReturnPct}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AlgoPerformance({ stats }: { stats: AlgoStats | null }) {
  if (!stats) {
    return (
      <Card className="text-center py-10">
        <BarChart3 size={32} className="mx-auto text-white/15 mb-3" />
        <p className="text-white/30 text-sm">Loading algorithm performance...</p>
      </Card>
    );
  }

  if (stats.totalPicks === 0) {
    return (
      <Card className="text-center py-10">
        <BarChart3 size={32} className="mx-auto text-white/15 mb-3" />
        <p className="text-white/30 text-sm">No tracked picks yet. Generate picks and update prices to see performance.</p>
      </Card>
    );
  }

  const outcomeEntries = Object.entries(stats.outcomes).filter(([, v]) => v > 0);
  const maxOutcome = Math.max(...outcomeEntries.map(([, v]) => v));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 size={18} className="text-white/30" />
        <h2 className="text-lg font-bold text-white">Algorithm Performance</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="!p-3 text-center">
          <p className="text-2xl font-black text-emerald-400">{stats.winRate}%</p>
          <p className="text-[10px] text-white/30">Win Rate</p>
        </Card>
        <Card className="!p-3 text-center">
          <p className="text-2xl font-black text-indigo-400">{stats.targetHitRate}%</p>
          <p className="text-[10px] text-white/30">Target Hit Rate</p>
        </Card>
        <Card className="!p-3 text-center">
          <p className="text-2xl font-black text-blue-400">{stats.timelineAccuracy}%</p>
          <p className="text-[10px] text-white/30">Timeline Accuracy</p>
        </Card>
        <Card className="!p-3 text-center">
          <p className="text-2xl font-black text-amber-400">{stats.avgConfidence}%</p>
          <p className="text-[10px] text-white/30">Avg Data Coverage</p>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-white/40 font-semibold mb-3">Returns</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/50">Avg Return</span>
              <span className={`text-sm font-bold ${stats.avgReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {stats.avgReturn >= 0 ? "+" : ""}{stats.avgReturn}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/50">Avg Peak Return</span>
              <span className="text-sm font-bold text-blue-400">+{stats.avgPeakReturn}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/50">Total Picks Tracked</span>
              <span className="text-sm font-bold text-white">{stats.totalPicks}</span>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <p className="text-xs text-white/40 font-semibold mb-3">Outcome Breakdown</p>
          <div className="space-y-2">
            {outcomeEntries.map(([outcome, count]) => {
              const cfg = OUTCOME_CONFIG[outcome] || OUTCOME_CONFIG.TRACKING;
              return (
                <div key={outcome} className="flex items-center gap-3">
                  <span className={`text-[10px] font-semibold w-16 ${cfg.color}`}>{cfg.label}</span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${cfg.bg.replace("/15", "/60")}`}
                      style={{ width: `${maxOutcome > 0 ? (count / maxOutcome) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/40 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {stats.notableCalls.length > 0 && (
        <Card className="!p-4">
          <div className="flex items-center gap-2 mb-3">
            <Crosshair size={14} className="text-emerald-400" />
            <p className="text-xs text-white/40 font-semibold">Notable Calls — Target Hits</p>
          </div>
          <div className="space-y-2">
            {stats.notableCalls.map((call) => (
              <div key={`${call.ticker}-${call.pickedAt}`} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                <div className="flex items-center gap-3">
                  <StockLogo ticker={call.ticker} size={24} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-bold">{call.ticker}</span>
                      <OutcomeBadge outcome={call.outcome} />
                    </div>
                    <p className="text-[10px] text-white/30">
                      Predicted ${call.predictedTarget.toFixed(0)} at ${call.entryPrice.toFixed(0)} — Hit in {call.hitDays} days
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-400">+{call.peakReturn}%</p>
                  <p className="text-[10px] text-white/20">{call.pickedAt}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {stats.notableMisses.length > 0 && (
        <Card className="!p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={14} className="text-red-400" />
            <p className="text-xs text-white/40 font-semibold">Notable Misses</p>
          </div>
          <div className="space-y-2">
            {stats.notableMisses.map((miss) => (
              <div key={`${miss.ticker}-${miss.pickedAt}`} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                <div className="flex items-center gap-3">
                  <StockLogo ticker={miss.ticker} size={24} />
                  <div>
                    <span className="text-sm text-white font-medium">{miss.ticker}</span>
                    <p className="text-[10px] text-white/30">
                      Target ${miss.predictedTarget.toFixed(0)} from ${miss.entryPrice.toFixed(0)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-400">{miss.returnPct}%</p>
                  <p className="text-[10px] text-white/20">{miss.pickedAt}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="!p-4">
        <div className="flex items-center gap-2 mb-2">
          <Info size={14} className="text-white/20" />
          <p className="text-[10px] text-white/25 font-semibold uppercase tracking-wider">How Outcomes Are Classified</p>
        </div>
        <div className="grid md:grid-cols-4 gap-3 text-[10px]">
          <div>
            <p className="text-emerald-400 font-semibold">Bullseye</p>
            <p className="text-white/25 mt-0.5">Target price hit within the predicted hold period (+60d grace)</p>
          </div>
          <div>
            <p className="text-blue-400 font-semibold">Late Hit</p>
            <p className="text-white/25 mt-0.5">Target price was eventually hit, but took longer than predicted</p>
          </div>
          <div>
            <p className="text-amber-400 font-semibold">Winner</p>
            <p className="text-white/25 mt-0.5">Positive return even though target price was not reached</p>
          </div>
          <div>
            <p className="text-red-400 font-semibold">Miss</p>
            <p className="text-white/25 mt-0.5">Negative return past the predicted hold timeline</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── Signal-Driven Best Picks (moved from Signals page) ── */

interface SignalIndicator { name: string; score: number; reason: string }
interface HorizonInfo { horizon: "sprint" | "marathon" | "legacy"; reason: string; score: number }

interface BestPick {
  ticker: string;
  price: number;
  action: string;
  score: number;
  confidence: number;
  strategy: string;
  stopLoss: number;
  takeProfit: number;
  indicators: SignalIndicator[];
  horizons: HorizonInfo[];
  discoveryInfo: { source: string; reason: string } | null;
  raw: { rsi: number; weekReturn: number; monthReturn: number; volumeRatio: number; changePercent: number };
}

const HORIZON_META = {
  sprint: { label: "Sprint", sub: "< 1 Year", icon: Zap, color: "amber", gradient: "from-amber-500/10 to-orange-500/5", border: "border-amber-500/20" },
  marathon: { label: "Marathon", sub: "1 – 3 Years", icon: TrendingUp, color: "blue", gradient: "from-blue-500/10 to-cyan-500/5", border: "border-blue-500/20" },
  legacy: { label: "Legacy", sub: "3 – 10 Years", icon: Gem, color: "emerald", gradient: "from-emerald-500/10 to-teal-500/5", border: "border-emerald-500/20" },
} as const;

function BestPickCard({ pick, horizon }: { pick: BestPick; horizon: "sprint" | "marathon" | "legacy" }) {
  const [expanded, setExpanded] = useState(false);
  const meta = HORIZON_META[horizon];
  const horizonInfo = pick.horizons.find((h) => h.horizon === horizon);

  return (
    <div
      className={`rounded-xl border transition-all duration-300 cursor-pointer ${
        expanded ? `${meta.border} bg-white/[0.03]` : "border-white/[0.04] bg-white/[0.015] hover:border-white/[0.08]"
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-3 sm:p-4 flex items-center gap-3">
        <StockLogo ticker={pick.ticker} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/90 font-bold text-sm">{pick.ticker}</span>
            <Badge variant="green">{pick.action}</Badge>
            {pick.horizons.map((h) => {
              const m = HORIZON_META[h.horizon];
              const HIcon = m.icon;
              return (
                <span key={h.horizon} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${m.border} flex items-center gap-1 ${
                  h.horizon === "sprint" ? "text-amber-400/70" : h.horizon === "marathon" ? "text-blue-400/70" : "text-emerald-400/70"
                }`}>
                  <HIcon size={8} />
                  {m.label}
                </span>
              );
            })}
          </div>
          <p className="text-[10px] text-white/25 mt-0.5 truncate">{horizonInfo?.reason || pick.strategy}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm text-white/80 font-semibold">${pick.price.toFixed(2)}</p>
          <p className="text-[10px] text-white/25">Signal Strength: {pick.confidence}%</p>
        </div>
      </div>
      {expanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2 border-t border-white/[0.04] pt-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
            <div className="bg-white/[0.03] rounded-lg p-2">
              <p className="text-white/25">Stop Loss</p>
              <p className="text-red-400 font-bold">${pick.stopLoss.toFixed(2)}</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-2">
              <p className="text-white/25">Take Profit</p>
              <p className="text-emerald-400 font-bold">${pick.takeProfit.toFixed(2)}</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-2">
              <p className="text-white/25">RSI</p>
              <p className={`font-bold ${pick.raw.rsi < 30 ? "text-emerald-400" : pick.raw.rsi > 70 ? "text-red-400" : "text-white/50"}`}>{pick.raw.rsi.toFixed(0)}</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-2">
              <p className="text-white/25">Volume</p>
              <p className={`font-bold ${pick.raw.volumeRatio > 1.5 ? "text-amber-400" : "text-white/50"}`}>{pick.raw.volumeRatio.toFixed(1)}x</p>
            </div>
          </div>
          {pick.discoveryInfo && (
            <p className="text-[10px] text-white/20">Source: {pick.discoveryInfo.source} — {pick.discoveryInfo.reason}</p>
          )}
          {pick.indicators.length > 0 && (
            <div className="space-y-1">
              {pick.indicators.slice(0, 4).map((ind) => (
                <div key={ind.name} className="flex items-center gap-2 text-[10px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${ind.score > 0 ? "bg-emerald-500" : "bg-red-500"}`} />
                  <span className="text-white/40">{ind.name}</span>
                  <span className="text-white/20 truncate">{ind.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BestPickHorizonSection({ title, subtitle, icon: Icon, gradient, border, picks, horizon }: {
  title: string; subtitle: string; icon: typeof Zap; gradient: string; border: string; picks: BestPick[]; horizon: "sprint" | "marathon" | "legacy";
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? picks : picks.slice(0, 5);
  if (picks.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${gradient} border ${border}`}>
        <Icon size={20} className={
          horizon === "sprint" ? "text-amber-400/80" : horizon === "marathon" ? "text-blue-400/80" : "text-emerald-400/80"
        } />
        <div>
          <h3 className={`text-sm font-bold ${
            horizon === "sprint" ? "text-amber-300/90" : horizon === "marathon" ? "text-blue-300/90" : "text-emerald-300/90"
          }`}>{title}</h3>
          <p className="text-[10px] text-white/25">{subtitle}</p>
        </div>
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${
          horizon === "sprint" ? "text-amber-400/60 bg-amber-500/10"
          : horizon === "marathon" ? "text-blue-400/60 bg-blue-500/10"
          : "text-emerald-400/60 bg-emerald-500/10"
        }`}>
          {picks.length} pick{picks.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {shown.map((pick) => (
          <BestPickCard key={pick.ticker} pick={pick} horizon={horizon} />
        ))}
      </div>
      {picks.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-white/25 hover:text-white/50 transition-colors flex items-center gap-1 mx-auto"
        >
          {showAll ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {picks.length}</>}
        </button>
      )}
    </div>
  );
}

const BEST_PICKS_CACHE = "kosh:topPicks:bestPicks";

export default function TopPicksPage() {
  useTrackView("Top Picks");
  const [picks, setPicks] = useState<Pick[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPick, setExpandedPick] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryBatch[]>([]);
  const [algoStats, setAlgoStats] = useState<AlgoStats | null>(null);
  const [tab, setTab] = useState<"picks" | "history" | "algo">("picks");

  const [bestPicks, setBestPicks] = useState<{ sprint: BestPick[]; marathon: BestPick[]; legacy: BestPick[] } | null>(null);
  const [bestPicksLoading, setBestPicksLoading] = useState(false);
  const [bestPicksStats, setBestPicksStats] = useState<{ scanned: number; totalBuySignals: number; totalPicks: number; signalDerived?: number } | null>(null);
  const [koshpilotRecLoading, setKoshpilotRecLoading] = useState(false);
  const [koshpilotRecMsg, setKoshpilotRecMsg] = useState<string | null>(null);

  async function fetchLatestPicks(): Promise<boolean> {
    try {
      const res = await fetch("/api/top-picks");
      if (!res.ok) return false;
      const data = await res.json();
      if (data.picks?.length > 0) {
        setPicks(data.picks);
        setGeneratedAt(data.generatedAt);
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
        return true;
      }
    } catch {}
    return false;
  }

  async function fetchHistory() {
    try {
      const res = await fetch("/api/top-picks?action=history");
      if (!res.ok) return;
      const data = await res.json();
      if (data.history) {
        setHistory(data.history);
        try { sessionStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(data.history)); } catch {}
      }
    } catch {}
  }

  async function fetchAlgoStats() {
    try {
      const res = await fetch("/api/top-picks?action=algo-stats");
      if (!res.ok) return;
      const data = await res.json();
      if (data.totalPicks !== undefined) setAlgoStats(data);
    } catch {}
  }

  async function runBestPicks() {
    setBestPicksLoading(true);
    try {
      const res = await fetch("/api/signals?mode=best-picks");
      const json = await res.json();
      if (json.error) {
        console.error("[BestPicks] API error:", json.error);
        setBestPicks(null);
      } else {
        const bp = { sprint: json.sprint || [], marathon: json.marathon || [], legacy: json.legacy || [] };
        const stats = { scanned: json.scanned || 0, totalBuySignals: json.totalBuySignals || 0, totalPicks: json.totalPicks || 0, signalDerived: json.signalDerived || 0 };
        setBestPicks(bp);
        setBestPicksStats(stats);
        try { sessionStorage.setItem(BEST_PICKS_CACHE, JSON.stringify({ ...bp, stats })); } catch {}
      }
    } catch (e) {
      console.error("[BestPicks] Fetch failed:", e);
      setBestPicks(null);
    }
    setBestPicksLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const data = JSON.parse(cached);
          if (data.picks?.length > 0) {
            setPicks(data.picks);
            setGeneratedAt(data.generatedAt || null);
          }
        }
      } catch {}

      try {
        const cached = sessionStorage.getItem(HISTORY_CACHE_KEY);
        if (cached) setHistory(JSON.parse(cached));
      } catch {}

      try {
        const cached = sessionStorage.getItem(BEST_PICKS_CACHE);
        if (cached) {
          const data = JSON.parse(cached);
          setBestPicks({ sprint: data.sprint || [], marathon: data.marathon || [], legacy: data.legacy || [] });
          setBestPicksStats(data.stats || null);
        }
      } catch {}

      const found = await fetchLatestPicks();
      if (!cancelled) setLoading(false);
      if (!found && !cancelled) setError(null);

      fetchHistory();
      fetchAlgoStats();
    }
    init();
    return () => { cancelled = true; };
  }, []);

  async function generatePicks() {
    setGenerating(true);
    setError(null);
    const savedPicks = [...picks];
    const savedAt = generatedAt;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 150000);
      const res = await fetch("/api/top-picks", {
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data.picks?.length > 0) {
          setPicks(data.picks);
          setGeneratedAt(data.generatedAt);
          try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
          setGenerating(false);
          fetchHistory();
          fetchAlgoStats();
          return;
        }
      }
    } catch {
      // POST may have timed out — picks are still persisted server-side
    }

    // POST response didn't come through — poll the GET endpoint
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 3000));
      const found = await fetchLatestPicks();
      if (found) {
        setGenerating(false);
        fetchHistory();
        fetchAlgoStats();
        return;
      }
    }

    // Nothing worked — restore previous picks if any
    if (savedPicks.length > 0) {
      setPicks(savedPicks);
      setGeneratedAt(savedAt);
    }
    setError("Generation may still be processing. Refresh the page in a minute.");
    setGenerating(false);
    fetchHistory();
    fetchAlgoStats();
  }

  async function updatePerformance() {
    try {
      await fetch("/api/top-picks?action=update-performance");
      fetchHistory();
      fetchAlgoStats();
    } catch {}
  }

  async function sendToKoshPilot() {
    setKoshpilotRecLoading(true);
    setKoshpilotRecMsg(null);
    try {
      const res = await fetch("/api/trading/auto/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "top10" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setKoshpilotRecMsg(data.error || "Could not merge into KoshPilot");
        return;
      }
      setKoshpilotRecMsg(
        `Merged ${data.added} ticker${data.added === 1 ? "" : "s"} into KoshPilot scan queue (${data.recommendedTickers?.length ?? 0} total recommended).`,
      );
    } catch {
      setKoshpilotRecMsg("Request failed");
    } finally {
      setKoshpilotRecLoading(false);
    }
  }

  return (
    <ProGate feature="Top Picks">
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy size={22} className="text-amber-400" />
            <h1 className="text-2xl font-bold text-white">Top 10 Conviction Picks</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Deep multi-source analysis to surface the highest-conviction opportunities in the market right now.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap gap-2 justify-end">
            {picks.length > 0 && (
              <button
                type="button"
                onClick={sendToKoshPilot}
                disabled={koshpilotRecLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/25 text-cyan-200 text-sm font-semibold rounded-xl transition-all disabled:opacity-40"
              >
                {koshpilotRecLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                Send to KoshPilot
              </button>
            )}
            <button
              onClick={generatePicks}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 disabled:hover:scale-100"
            >
              {generating ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {generating ? "Generating..." : picks.length > 0 ? "Regenerate Picks" : "Generate Picks"}
            </button>
          </div>
          {koshpilotRecMsg && (
            <p className="text-[11px] text-cyan-400/70 text-right max-w-sm">{koshpilotRecMsg}</p>
          )}
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl w-fit">
        <button
          onClick={() => setTab("picks")}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === "picks" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/60"}`}
        >
          <div className="flex items-center gap-1.5">
            <Target size={12} />
            Current Picks
          </div>
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === "history" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/60"}`}
        >
          <div className="flex items-center gap-1.5">
            <History size={12} />
            Track Record
            {history.length > 0 && <span className="text-[10px] text-white/20">({history.length})</span>}
          </div>
        </button>
        <button
          onClick={() => setTab("algo")}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === "algo" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/60"}`}
        >
          <div className="flex items-center gap-1.5">
            <BarChart3 size={12} />
            Algorithm
          </div>
        </button>
      </div>

      {tab === "picks" && (
        <>
          {generating && <AnalysisLoader />}

          {!generating && loading && (
            <Card className="text-center py-16">
              <RefreshCw size={24} className="mx-auto text-white/20 animate-spin mb-3" />
              <p className="text-white/30 text-sm">Loading picks...</p>
            </Card>
          )}

          {error && (
            <Card className="!p-4 border-amber-500/20">
              <p className="text-amber-400 text-sm">{error}</p>
            </Card>
          )}

          {!generating && !loading && picks.length === 0 && (
            <Card className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
                <Target size={28} className="text-indigo-400/50" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No picks generated yet</h3>
              <p className="text-white/30 text-sm max-w-md mx-auto">
                Click &quot;Generate Picks&quot; to run a deep analysis across news, insider trades, congressional activity,
                earnings, technicals, and more to find the top 10 highest-conviction stocks.
              </p>
            </Card>
          )}

          {!generating && picks.length > 0 && (
            <div className="space-y-3">
              {generatedAt && (
                <p className="text-[10px] text-white/20">
                  Generated {new Date(generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              )}
              {picks.map((pick) => (
                <PickCard
                  key={pick.ticker}
                  pick={pick}
                  isExpanded={expandedPick === pick.rank}
                  onToggle={() => setExpandedPick(expandedPick === pick.rank ? null : pick.rank)}
                />
              ))}
            </div>
          )}

          {!generating && picks.length > 0 && (
            <Card className="!p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info size={14} className="text-white/20" />
                <p className="text-[10px] text-white/25 font-semibold uppercase tracking-wider">How Scoring Works</p>
              </div>
              <div className="grid md:grid-cols-3 gap-4 text-[10px]">
                <div>
                  <p className="text-white/50 font-semibold mb-1">Conviction Score</p>
                  <p className="text-white/25">Weighted blend of 7 dimensions: signal diversity, technicals, fundamentals, valuation, smart money, AI sentiment, and risk-adjusted return.</p>
                </div>
                <div>
                  <p className="text-white/50 font-semibold mb-1">Kosh Confidence <Shield size={10} className="inline text-blue-400" /></p>
                  <p className="text-white/25">Measures evidence depth — insider buys, catalysts, fundamental coverage, analyst targets. More signals = higher confidence.</p>
                </div>
                <div>
                  <p className="text-white/50 font-semibold mb-1">Ranking</p>
                  <p className="text-white/25">Picks are ranked by conviction weighted by confidence. A strong conviction with thin data won&apos;t outrank a solid pick backed by real evidence.</p>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {tab === "history" && (
        <TrackRecordSection history={history} onRefresh={updatePerformance} />
      )}

      {tab === "algo" && (
        <AlgoPerformance stats={algoStats} />
      )}

      {/* Other Picks Worth a Look — signal-driven Best Buys */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-orange-400" />
            <h2 className="text-sm font-semibold text-orange-300/80">Other Picks Worth a Look</h2>
            {bestPicksStats && (
              <span className="text-[10px] text-white/20 ml-2">
                {bestPicksStats.scanned} scanned · {bestPicksStats.totalPicks} picks
              </span>
            )}
          </div>
          <button
            onClick={runBestPicks}
            disabled={bestPicksLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600/80 hover:bg-orange-500/80 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-all"
          >
            {bestPicksLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {bestPicksLoading ? "Scanning..." : "Find Picks"}
          </button>
        </div>

        <p className="text-[10px] text-white/20 mb-4 -mt-2">
          Signal-first discovery: reads live news, insider buys, congress trades, then runs technicals to categorize by holding period.
        </p>

        {bestPicksLoading && (
          <div className="py-8 flex flex-col items-center gap-3">
            <Loader2 size={18} className="text-orange-400 animate-spin" />
            <span className="text-sm font-semibold text-orange-400">Finding Best Picks...</span>
          </div>
        )}

        {!bestPicksLoading && bestPicks && (bestPicks.sprint.length > 0 || bestPicks.marathon.length > 0 || bestPicks.legacy.length > 0) ? (
          <div className="space-y-6">
            {bestPicksStats && (
              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  ...(bestPicksStats.signalDerived ? [{ icon: Radar, val: bestPicksStats.signalDerived, label: "from signals", cls: "text-purple-400/70" }] : []),
                  { icon: Search, val: bestPicksStats.scanned, label: "scanned", cls: "text-orange-400/70" },
                  { icon: Brain, val: bestPicksStats.totalBuySignals, label: "buy signals", cls: "text-emerald-400/70" },
                  { icon: Zap, val: bestPicks.sprint.length, label: "sprint", cls: "text-amber-400/70" },
                  { icon: TrendingUp, val: bestPicks.marathon.length, label: "marathon", cls: "text-blue-400/70" },
                  { icon: Gem, val: bestPicks.legacy.length, label: "legacy", cls: "text-emerald-400/70" },
                ].map(({ icon: Ic, val, label, cls }) => (
                  <span key={label} className="flex items-center gap-1.5 bg-white/[0.03] rounded-lg px-3 py-1.5 text-xs">
                    <Ic size={12} className={cls} />
                    <span className="text-white/80 font-semibold">{val}</span>
                    <span className="text-white/25">{label}</span>
                  </span>
                ))}
              </div>
            )}

            <BestPickHorizonSection
              title="Sprint Picks"
              subtitle="Short-term opportunities — hold period under 1 year. Momentum plays, oversold bounces, and catalyst-driven moves."
              icon={Zap}
              gradient="from-amber-500/10 to-orange-500/5"
              border="border-amber-500/20"
              picks={bestPicks.sprint}
              horizon="sprint"
            />

            <BestPickHorizonSection
              title="Marathon Picks"
              subtitle="Medium-term growth — hold period 1 to 3 years. Strong uptrends, golden crosses, and steady compounders."
              icon={TrendingUp}
              gradient="from-blue-500/10 to-cyan-500/5"
              border="border-blue-500/20"
              picks={bestPicks.marathon}
              horizon="marathon"
            />

            <BestPickHorizonSection
              title="Legacy Picks"
              subtitle="Long-term value — hold period 3 to 10 years. Beaten-down quality names, accumulation zones, and deep discounts."
              icon={Gem}
              gradient="from-emerald-500/10 to-teal-500/5"
              border="border-emerald-500/20"
              picks={bestPicks.legacy}
              horizon="legacy"
            />
          </div>
        ) : !bestPicksLoading ? (
          <div className="text-center py-8 text-white/20 text-sm">
            <Flame size={24} className="mx-auto mb-2 text-orange-400/30" />
            <p>Click &quot;Find Picks&quot; to discover signal-driven stocks</p>
            <p className="text-[10px] text-white/15 mt-1">Scans news, insider buys, congress trades → derives which stocks to analyze → categorizes by holding period</p>
          </div>
        ) : null}
      </Card>
    </div>
    </ProGate>
  );
}
