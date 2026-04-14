"use client";

import { useState } from "react";
import { Brain, Target, TrendingUp, DollarSign, AlertTriangle, BarChart3 } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, YAxis } from "recharts";
import StockLogo from "@/components/ui/StockLogo";
import Badge from "@/components/ui/Badge";
import ConfidenceGauge from "./ConfidenceGauge";
import DecisionBasis from "./DecisionBasis";

interface QueryResult {
  ticker: string;
  companyName: string;
  sector: string;
  currentPrice: number;
  targetPrice: number;
  expectedReturnPct: number;
  allocation: number;
  allocationPct: number;
  koshConfidence: number;
  conviction: number;
  holdLabel: string;
  scores: Record<string, number>;
  sources: string[];
  sparkline: number[];
  thesis: string;
}

interface KoshQueryResultsProps {
  results: QueryResult[];
  verdict: string;
  riskWarning: string;
  meta: {
    scanned: number;
    scored: number;
    horizon: string;
    amount: number;
    elapsed: number;
  };
}

function MiniSparkline({ data, isPositive }: { data: number[]; isPositive: boolean }) {
  if (data.length < 2) return null;

  const chartData = data.map((value, i) => ({ i, v: value }));
  const color = isPositive ? "#34d399" : "#f87171";

  return (
    <div className="w-20 h-10">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${isPositive ? "up" : "down"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-${isPositive ? "up" : "down"})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ResultCard({ result, rank }: { result: QueryResult; rank: number }) {
  const [showThesis, setShowThesis] = useState(false);
  const isPositive = result.expectedReturnPct > 0;

  return (
    <div className="glass-card overflow-hidden kosh-query-result-card" style={{ animationDelay: `${rank * 100}ms` }}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="relative shrink-0">
            <StockLogo ticker={result.ticker} size={44} />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black/80 border border-white/[0.08] flex items-center justify-center">
              <span className="text-[9px] font-bold text-amber-400">#{rank}</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white/90 font-bold text-sm">{result.ticker}</span>
              <span className="text-white/25 text-xs truncate">{result.companyName}</span>
              <Badge variant="gray">{result.sector}</Badge>
            </div>

            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <DollarSign size={10} className="text-white/20" />
                <span className="text-white/50 text-xs">${result.currentPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Target size={10} className="text-amber-400/50" />
                <span className="text-amber-400/70 text-xs font-semibold">${result.targetPrice.toFixed(2)}</span>
              </div>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${
                isPositive ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
              }`}>
                <TrendingUp size={10} />
                {isPositive ? "+" : ""}{result.expectedReturnPct}%
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {result.sparkline.length > 1 && (
              <MiniSparkline data={result.sparkline} isPositive={isPositive} />
            )}
            <ConfidenceGauge value={result.koshConfidence} size={52} label="conf" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 pt-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] text-white/20">Allocate</p>
              <p className="text-sm font-bold text-amber-400">${result.allocation.toLocaleString()}</p>
              <p className="text-[9px] text-white/15">{result.allocationPct}% of budget</p>
            </div>
            <div>
              <p className="text-[10px] text-white/20">Conviction</p>
              <p className="text-sm font-bold text-white/70">{result.conviction}<span className="text-white/20 text-[10px]">/100</span></p>
            </div>
            <div>
              <p className="text-[10px] text-white/20">Hold</p>
              <p className="text-sm font-semibold text-white/50">{result.holdLabel}</p>
            </div>
          </div>

          <button
            onClick={() => setShowThesis(!showThesis)}
            className="text-[10px] text-white/25 hover:text-amber-400/60 transition-colors flex items-center gap-1"
          >
            <BarChart3 size={10} />
            {showThesis ? "Hide" : "Thesis"}
          </button>
        </div>

        {showThesis && result.thesis && (
          <div className="mt-3 p-3 bg-white/[0.02] rounded-xl border border-white/[0.04] animate-fade-slide-up">
            <p className="text-xs text-white/40 leading-relaxed">{result.thesis}</p>
          </div>
        )}

        <DecisionBasis scores={result.scores} sources={result.sources} ticker={result.ticker} />
      </div>
    </div>
  );
}

export default function KoshQueryResults({ results, verdict, riskWarning, meta }: KoshQueryResultsProps) {
  return (
    <div className="space-y-4 kosh-query-results">
      <div className="glass-card-gold p-4 sm:p-5 kosh-query-result-card" style={{ animationDelay: "0ms" }}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <Brain size={14} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-white/80 font-semibold text-sm">Kosh&apos;s Verdict</h4>
              <span className="text-[9px] text-white/15 tabular-nums">
                {meta.scanned} scanned &middot; {meta.scored} scored &middot; {(meta.elapsed / 1000).toFixed(1)}s
              </span>
            </div>
            <p className="text-white/50 text-xs leading-relaxed">{verdict}</p>
          </div>
        </div>
      </div>

      {results.map((result, idx) => (
        <ResultCard key={result.ticker} result={result} rank={idx + 1} />
      ))}

      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/[0.04] border border-red-500/[0.08]">
        <AlertTriangle size={12} className="text-red-400/50 shrink-0 mt-0.5" />
        <p className="text-[10px] text-red-400/40 leading-relaxed">{riskWarning}</p>
      </div>
    </div>
  );
}
