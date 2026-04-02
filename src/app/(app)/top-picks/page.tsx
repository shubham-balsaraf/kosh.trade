"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import StockLogo from "@/components/ui/StockLogo";
import {
  Trophy, Target, RefreshCw, ChevronDown, Sparkles,
  ArrowUpRight, Info, History, Radar, BarChart3,
  TrendingUp, TrendingDown, Shield, Crosshair, Clock,
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
  const color = value >= 80 ? "text-emerald-400 border-emerald-500/30" :
    value >= 50 ? "text-blue-400 border-blue-500/30" :
    "text-amber-400 border-amber-500/30";
  const bgColor = value >= 80 ? "bg-emerald-500/10" :
    value >= 50 ? "bg-blue-500/10" :
    "bg-amber-500/10";
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border ${color} ${bgColor}`}>
      <Shield size={10} />
      <span className="text-[10px] font-bold">{value}%</span>
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

function PickCard({ pick, isExpanded, onToggle }: { pick: Pick; isExpanded: boolean; onToggle: () => void }) {
  const holdCfg = HOLD_CONFIG[pick.holdPeriod] || HOLD_CONFIG.MEDIUM;
  const rankColors = ["text-amber-400", "text-gray-300", "text-amber-600"];
  const rankColor = pick.rank <= 3 ? rankColors[pick.rank - 1] : "text-white/30";

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
              {pick.dataConfidence != null && (
                <ConfidenceGauge value={pick.dataConfidence} />
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 shrink-0">
            <div className="text-right">
              <p className="text-[10px] text-white/25">Current</p>
              <p className="text-sm text-white font-semibold">${pick.currentPrice.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/25">Target</p>
              <p className="text-sm text-emerald-400 font-semibold">${pick.targetPrice.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/25">Upside</p>
              <p className={`text-sm font-bold ${pick.upsidePct > 0 ? "text-emerald-400" : "text-red-400"}`}>
                {pick.upsidePct > 0 ? "+" : ""}{pick.upsidePct}%
              </p>
            </div>
            <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold ${holdCfg.bg} ${holdCfg.color}`}>
              {pick.holdLabel}
            </div>
          </div>

          <ChevronDown size={16} className={`text-white/20 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </div>

        <div className="md:hidden flex items-center gap-4 mt-3 text-xs">
          <span className="text-white/40">${pick.currentPrice.toFixed(2)}</span>
          <ArrowUpRight size={12} className="text-white/20" />
          <span className="text-emerald-400">${pick.targetPrice.toFixed(2)}</span>
          <span className={`font-bold ${pick.upsidePct > 0 ? "text-emerald-400" : "text-red-400"}`}>
            {pick.upsidePct > 0 ? "+" : ""}{pick.upsidePct}%
          </span>
          <span className={`px-2 py-0.5 rounded border text-[10px] ${holdCfg.bg} ${holdCfg.color}`}>{pick.holdLabel}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04] pt-3 animate-fade-in">
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
            {pick.dataConfidence != null && (
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

export default function TopPicksPage() {
  useTrackView("Top Picks");
  const [picks, setPicks] = useState<Pick[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedPick, setExpandedPick] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryBatch[]>([]);
  const [algoStats, setAlgoStats] = useState<AlgoStats | null>(null);
  const [tab, setTab] = useState<"picks" | "history" | "algo">("picks");

  const loadCachedPicks = useCallback(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        setPicks(data.picks || []);
        setGeneratedAt(data.generatedAt || null);
        return true;
      }
    } catch {}
    return false;
  }, []);

  const loadCachedHistory = useCallback(() => {
    try {
      const cached = sessionStorage.getItem(HISTORY_CACHE_KEY);
      if (cached) {
        setHistory(JSON.parse(cached));
        return true;
      }
    } catch {}
    return false;
  }, []);

  useEffect(() => {
    const hadCache = loadCachedPicks();
    loadCachedHistory();
    if (!hadCache) {
      fetchLatestPicks();
    }
    fetchHistory();
    fetchAlgoStats();
  }, [loadCachedPicks, loadCachedHistory]);

  async function fetchLatestPicks() {
    try {
      const res = await fetch("/api/top-picks");
      const data = await res.json();
      if (data.picks?.length > 0) {
        setPicks(data.picks);
        setGeneratedAt(data.generatedAt);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
      }
    } catch {}
  }

  async function fetchHistory() {
    try {
      const res = await fetch("/api/top-picks?action=history");
      const data = await res.json();
      if (data.history) {
        setHistory(data.history);
        sessionStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(data.history));
      }
    } catch {}
  }

  async function fetchAlgoStats() {
    try {
      const res = await fetch("/api/top-picks?action=algo-stats");
      const data = await res.json();
      if (data.totalPicks !== undefined) {
        setAlgoStats(data);
      }
    } catch {}
  }

  async function generatePicks() {
    setLoading(true);
    setPicks([]);
    setGeneratedAt(null);
    sessionStorage.removeItem(CACHE_KEY);
    try {
      const res = await fetch("/api/top-picks", { method: "POST" });
      const data = await res.json();
      if (data.picks) {
        setPicks(data.picks);
        setGeneratedAt(data.generatedAt);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
        fetchHistory();
        fetchAlgoStats();
      }
    } catch {}
    setLoading(false);
  }

  async function updatePerformance() {
    try {
      await fetch("/api/top-picks?action=update-performance");
      fetchHistory();
      fetchAlgoStats();
    } catch {}
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
        <button
          onClick={generatePicks}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 disabled:hover:scale-100"
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? "Generating..." : picks.length > 0 ? "Regenerate Picks" : "Generate Picks"}
        </button>
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
          {loading && <AnalysisLoader />}

          {!loading && picks.length === 0 && (
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

          {!loading && picks.length > 0 && (
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

          {!loading && picks.length > 0 && (
            <Card className="!p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info size={14} className="text-white/20" />
                <p className="text-[10px] text-white/25 font-semibold uppercase tracking-wider">How Scoring Works</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4 text-[10px]">
                <div>
                  <p className="text-white/50 font-semibold mb-1">Conviction Score</p>
                  <p className="text-white/25">Weighted blend of 7 dimensions: signal diversity, technicals, fundamentals, valuation, smart money, AI sentiment, and risk-adjusted return. Higher = stronger recommendation.</p>
                </div>
                <div>
                  <p className="text-white/50 font-semibold mb-1">Kosh Confidence <Shield size={10} className="inline text-blue-400" /></p>
                  <p className="text-white/25">Percentage of scoring dimensions that had real data. 100% means all 7 dimensions had data. Lower confidence means some data sources were unavailable (e.g., fundamental data).</p>
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
    </div>
    </ProGate>
  );
}
