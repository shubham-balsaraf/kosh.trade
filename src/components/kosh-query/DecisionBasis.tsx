"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface DecisionBasisProps {
  scores: Record<string, number>;
  sources: string[];
  ticker: string;
}

const DIMENSION_META: Record<string, { label: string; color: string; bg: string }> = {
  signalDiversity: { label: "Signal Diversity", color: "bg-purple-400", bg: "bg-purple-400/10" },
  technical: { label: "Technical", color: "bg-blue-400", bg: "bg-blue-400/10" },
  fundamental: { label: "Fundamental", color: "bg-emerald-400", bg: "bg-emerald-400/10" },
  valuation: { label: "Valuation", color: "bg-amber-400", bg: "bg-amber-400/10" },
  smartMoney: { label: "Smart Money", color: "bg-cyan-400", bg: "bg-cyan-400/10" },
  catalystSentiment: { label: "Catalyst & Sentiment", color: "bg-rose-400", bg: "bg-rose-400/10" },
  riskAdjusted: { label: "Risk-Adjusted", color: "bg-indigo-400", bg: "bg-indigo-400/10" },
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  news: { label: "News", color: "text-blue-400 bg-blue-500/10" },
  insider: { label: "Insider Trading", color: "text-emerald-400 bg-emerald-500/10" },
  congress: { label: "Congress Trades", color: "text-purple-400 bg-purple-500/10" },
  screener: { label: "Screener", color: "text-amber-400 bg-amber-500/10" },
  earnings: { label: "Earnings", color: "text-cyan-400 bg-cyan-500/10" },
  grades: { label: "Analyst Grades", color: "text-indigo-400 bg-indigo-500/10" },
  press: { label: "Press Release", color: "text-rose-400 bg-rose-500/10" },
  merger: { label: "M&A Activity", color: "text-orange-400 bg-orange-500/10" },
  institutional: { label: "Institutional", color: "text-teal-400 bg-teal-500/10" },
  "8k": { label: "SEC 8-K Filing", color: "text-gray-400 bg-gray-500/10" },
};

export default function DecisionBasis({ scores, sources, ticker }: DecisionBasisProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3">
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="flex items-center gap-1.5 text-[10px] text-white/25 hover:text-amber-400/60 transition-colors"
      >
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        Decision Basis
      </button>

      {expanded && (
        <div className="mt-3 space-y-4 animate-fade-slide-up" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-2">
            <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider">Scoring Dimensions</p>
            {Object.entries(scores).map(([key, value]) => {
              const meta = DIMENSION_META[key];
              if (!meta) return null;
              const normalized = Math.max(0, Math.min(100, value));
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/40">{meta.label}</span>
                    <span className="text-[10px] text-white/50 font-semibold tabular-nums">{Math.round(value)}</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${meta.color} transition-all duration-700 ease-out`}
                      style={{ width: `${normalized}%`, opacity: 0.7 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider">Data Sources</p>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((source) => {
                const meta = SOURCE_LABELS[source] || { label: source, color: "text-white/40 bg-white/[0.04]" };
                return (
                  <span
                    key={source}
                    className={`px-2 py-0.5 rounded-md text-[9px] font-medium ${meta.color}`}
                  >
                    {meta.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
