"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Users,
  Award,
} from "lucide-react";

interface InsiderTrade {
  name: string;
  title: string;
  type: "buy" | "sell";
  shares: number;
  price: number;
  value: number;
  date: string;
}

function formatCompact(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function FlashCard({ trade, direction }: { trade: InsiderTrade; direction: "enter" | "idle" }) {
  const isBuy = trade.type === "buy";
  const dateStr = trade.date
    ? new Date(trade.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div
      className={`w-full transition-all duration-500 ease-out ${
        direction === "enter" ? "animate-flashcardIn" : ""
      }`}
    >
      <div
        className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 ${
          isBuy
            ? "bg-emerald-500/[0.04] border-emerald-500/15"
            : "bg-red-500/[0.04] border-red-500/15"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isBuy ? "bg-emerald-500/10" : "bg-red-500/10"
              }`}
            >
              {isBuy ? (
                <ArrowUpRight size={18} className="text-emerald-400" />
              ) : (
                <ArrowDownRight size={18} className="text-red-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {trade.name}
              </p>
              {trade.title && (
                <p className="text-[11px] text-white/30 truncate">
                  {trade.title}
                </p>
              )}
            </div>
          </div>
          <div
            className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${
              isBuy
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {isBuy ? "BOUGHT" : "SOLD"}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="text-xl sm:text-2xl font-bold text-white">
              {formatCompact(trade.value)}
            </p>
            <p className="text-[11px] text-white/25 mt-0.5">
              {trade.shares.toLocaleString()} shares
              {trade.price > 0 ? ` @ $${trade.price.toFixed(2)}` : ""}
            </p>
          </div>
          <p className="text-[11px] text-white/20">{dateStr}</p>
        </div>
      </div>
    </div>
  );
}

export default function InsiderFlashcards({ ticker }: { ticker: string }) {
  const [trades, setTrades] = useState<InsiderTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [direction, setDirection] = useState<"enter" | "idle">("enter");

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/insiders`)
      .then((r) => r.json())
      .then((d) => setTrades(d.trades || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker]);

  const go = useCallback(
    (delta: number) => {
      setDirection("enter");
      setIndex((i) => (i + delta + trades.length) % trades.length);
    },
    [trades.length]
  );

  const next = useCallback(() => go(1), [go]);
  const prev = useCallback(() => go(-1), [go]);

  useEffect(() => {
    if (trades.length < 2 || paused) return;
    const id = setInterval(next, 4500);
    return () => clearInterval(id);
  }, [trades.length, paused, next]);

  useEffect(() => {
    if (direction === "enter") {
      const t = setTimeout(() => setDirection("idle"), 500);
      return () => clearTimeout(t);
    }
  }, [direction, index]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded bg-white/[0.05]" />
          <div className="h-3 w-28 rounded bg-white/[0.05]" />
        </div>
        <div className="h-24 rounded-xl bg-white/[0.03]" />
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={13} className="text-amber-400" />
          <h3 className="text-xs font-semibold text-gray-400">
            Insider Activity
          </h3>
        </div>
        <div className="flex items-center justify-center py-6 text-white/15 text-xs gap-2">
          <Award size={14} />
          <span>No recent insider transactions found</span>
        </div>
      </div>
    );
  }

  const buys = trades.filter((t) => t.type === "buy").length;
  const sells = trades.length - buys;

  return (
    <div
      className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={13} className="text-amber-400" />
          <h3 className="text-xs font-semibold text-gray-400">
            Insider Activity
          </h3>
          <span className="text-[10px] text-white/15 ml-1">
            {buys}↑ {sells}↓
          </span>
        </div>
        {trades.length > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={prev}
              className="w-6 h-6 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
            >
              <ChevronLeft size={12} className="text-white/40" />
            </button>
            <span className="text-[10px] text-white/20 tabular-nums min-w-[32px] text-center">
              {index + 1}/{trades.length}
            </span>
            <button
              onClick={next}
              className="w-6 h-6 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
            >
              <ChevronRight size={12} className="text-white/40" />
            </button>
          </div>
        )}
      </div>

      <FlashCard
        key={`${trades[index].name}-${trades[index].date}-${index}`}
        trade={trades[index]}
        direction={direction}
      />

      {trades.length > 1 && (
        <div className="flex justify-center gap-1 mt-3">
          {trades.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection("enter");
                setIndex(i);
              }}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === index
                  ? "w-4 bg-amber-400/50"
                  : "w-1.5 bg-white/10 hover:bg-white/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
