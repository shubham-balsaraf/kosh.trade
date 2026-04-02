"use client";

import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";

const DATA_WINDOWS = [
  { label: "Live Positions", ttl: "10 sec", color: "text-emerald-400" },
  { label: "Stock Quotes", ttl: "5 min", color: "text-blue-400" },
  { label: "Insider Trading", ttl: "10 min", color: "text-purple-400" },
  { label: "Congress Trades", ttl: "10 min", color: "text-purple-400" },
  { label: "Earnings Calendar", ttl: "10 min", color: "text-amber-400" },
  { label: "News & Press", ttl: "10 min", color: "text-cyan-400" },
  { label: "Market Movers", ttl: "30 min", color: "text-amber-400" },
  { label: "Fundamentals", ttl: "1 hour", color: "text-white/50" },
  { label: "Company Profiles", ttl: "24 hours", color: "text-white/30" },
  { label: "KoshPilot Cron", ttl: "~1 hour (market hours)", color: "text-indigo-400" },
];

export default function DataFreshness() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/40 transition-colors"
        title="Data refresh schedule"
      >
        <Info size={11} />
        <span>Data freshness</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-[#0a0a12] border border-white/[0.08] rounded-xl shadow-xl p-3 animate-fade-in">
          <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-2">Refresh Schedule</p>
          <div className="space-y-1.5">
            {DATA_WINDOWS.map((d) => (
              <div key={d.label} className="flex items-center justify-between">
                <span className="text-[10px] text-white/30">{d.label}</span>
                <span className={`text-[10px] font-mono font-medium ${d.color}`}>{d.ttl}</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-white/15 mt-2 pt-2 border-t border-white/[0.04]">
            Data is cached server-side per these TTLs. Click refresh buttons to force new data.
          </p>
        </div>
      )}
    </div>
  );
}
