"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";

type Horizon = "1Y" | "2Y" | "3Y" | "COMPOUNDING";

interface KoshQueryBoxProps {
  onSubmit: (query: string, horizon: Horizon, amount: number) => void;
  loading: boolean;
}

const HORIZONS: { value: Horizon; label: string; desc: string }[] = [
  { value: "1Y", label: "1Y", desc: "Sprint" },
  { value: "2Y", label: "2Y", desc: "Growth" },
  { value: "3Y", label: "3Y", desc: "Build" },
  { value: "COMPOUNDING", label: "Compounding Final Boss", desc: "Legacy" },
];

function extractAmount(text: string): number | null {
  const patterns = [
    /\$\s*([\d,]+(?:\.\d+)?)\s*(?:k|K)/,
    /\$\s*([\d,]+(?:\.\d+)?)/,
    /([\d,]+(?:\.\d+)?)\s*(?:dollars?|usd|USD)/i,
    /([\d,]+(?:\.\d+)?)\s*(?:k|K)\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let val = parseFloat(match[1].replace(/,/g, ""));
      if (/k|K/.test(match[0])) val *= 1000;
      if (val > 0 && val <= 10_000_000) return val;
    }
  }
  return null;
}

export default function KoshQueryBox({ onSubmit, loading }: KoshQueryBoxProps) {
  const [query, setQuery] = useState("");
  const [horizon, setHorizon] = useState<Horizon>("1Y");
  const [amount, setAmount] = useState<number>(1000);
  const [amountStr, setAmountStr] = useState("1000");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const extracted = extractAmount(query);
    if (extracted) {
      setAmount(extracted);
      setAmountStr(extracted.toLocaleString());
    }
  }, [query]);

  const handleAmountChange = useCallback((val: string) => {
    setAmountStr(val);
    const parsed = parseFloat(val.replace(/,/g, ""));
    if (!isNaN(parsed) && parsed > 0) setAmount(parsed);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!query.trim() || loading) return;
    onSubmit(query.trim(), horizon, amount);
  }, [query, horizon, amount, loading, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="kosh-query-box glass-card overflow-hidden">
      <div className="p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-500/15 flex items-center justify-center shrink-0">
            <Sparkles size={14} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-white/80 font-semibold text-sm">Ask Kosh</h3>
            <p className="text-white/20 text-[10px]">AI-powered investment analysis</p>
          </div>
        </div>

        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="I have $1000, where should I put it right now?"
            disabled={loading}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/20 transition-all disabled:opacity-40"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {HORIZONS.map((h) => (
            <button
              key={h.value}
              onClick={() => setHorizon(h.value)}
              disabled={loading}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-300 border ${
                horizon === h.value
                  ? "bg-gradient-to-b from-amber-400/20 to-amber-600/10 border-amber-500/30 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.1)]"
                  : "bg-white/[0.02] border-white/[0.06] text-white/30 hover:text-white/50 hover:border-white/[0.1]"
              } disabled:opacity-30`}
            >
              {h.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-white/20 text-xs shrink-0">Budget</span>
            <div className="relative flex-1 max-w-[140px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/50 text-xs">$</span>
              <input
                value={amountStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                disabled={loading}
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-7 pr-3 py-1.5 text-xs text-white/70 font-semibold tabular-nums focus:outline-none focus:border-amber-500/30 transition-all disabled:opacity-40"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !query.trim()}
            className="koshpilot-btn px-5 py-2 rounded-xl text-xs font-bold text-black flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <span>Analyze</span>
                <ArrowRight size={12} />
              </>
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="kosh-query-scanning-bar h-0.5 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
      )}
    </div>
  );
}
