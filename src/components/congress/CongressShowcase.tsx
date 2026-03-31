"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowUpRight, ArrowDownRight, Landmark, ChevronRight } from "lucide-react";
import StockLogo from "@/components/ui/StockLogo";

interface ShowcaseTrade {
  politicianName: string;
  bioguideId: string;
  party: "Democrat" | "Republican";
  chamber: string;
  state: string;
  ticker: string;
  issuerName: string;
  type: "buy" | "sell";
  size: string;
  tradeDate: string;
}

const SHOWCASE_TRADES: ShowcaseTrade[] = [
  { politicianName: "Nancy Pelosi", bioguideId: "P000197", party: "Democrat", chamber: "House", state: "CA", ticker: "NVDA", issuerName: "NVIDIA Corp", type: "buy", size: "$1M – $5M", tradeDate: "Nov 2024" },
  { politicianName: "Tommy Tuberville", bioguideId: "T000278", party: "Republican", chamber: "Senate", state: "AL", ticker: "MSFT", issuerName: "Microsoft Corp", type: "buy", size: "$50K – $100K", tradeDate: "Jan 2025" },
  { politicianName: "Dan Crenshaw", bioguideId: "C001120", party: "Republican", chamber: "House", state: "TX", ticker: "META", issuerName: "Meta Platforms", type: "buy", size: "$15K – $50K", tradeDate: "Jan 2025" },
  { politicianName: "Nancy Pelosi", bioguideId: "P000197", party: "Democrat", chamber: "House", state: "CA", ticker: "AAPL", issuerName: "Apple Inc", type: "buy", size: "$500K – $1M", tradeDate: "Dec 2024" },
  { politicianName: "Josh Gottheimer", bioguideId: "G000583", party: "Democrat", chamber: "House", state: "NJ", ticker: "AMZN", issuerName: "Amazon.com", type: "sell", size: "$15K – $50K", tradeDate: "Jan 2025" },
  { politicianName: "Steve Cohen", bioguideId: "C001068", party: "Democrat", chamber: "House", state: "TN", ticker: "TSLA", issuerName: "Tesla Inc", type: "buy", size: "$1K – $15K", tradeDate: "Feb 2025" },
  { politicianName: "Mark Green", bioguideId: "G000596", party: "Republican", chamber: "House", state: "TN", ticker: "PLTR", issuerName: "Palantir", type: "buy", size: "$15K – $50K", tradeDate: "Feb 2025" },
  { politicianName: "Tommy Tuberville", bioguideId: "T000278", party: "Republican", chamber: "Senate", state: "AL", ticker: "GOOGL", issuerName: "Alphabet Inc", type: "sell", size: "$100K – $250K", tradeDate: "Dec 2024" },
];

const PHOTO_SOURCES = [
  (id: string) =>
    `https://unitedstates.github.io/images/congress/225x275/${id}.jpg`,
  (id: string) =>
    `https://www.congress.gov/img/member/${id.toLowerCase()}_200.jpg`,
];

function ShowcasePhoto({
  bioguideId,
  name,
  party,
}: {
  bioguideId: string;
  name: string;
  party: "Democrat" | "Republican";
}) {
  const [srcIdx, setSrcIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  const ring = party === "Democrat" ? "ring-blue-400/60" : "ring-red-400/60";

  if (failed) {
    const bg =
      party === "Democrat"
        ? "bg-blue-900/60 text-blue-300"
        : "bg-red-900/60 text-red-300";
    return (
      <div
        className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-base font-bold shrink-0 ring-2 ${ring} ${bg}`}
      >
        {name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={PHOTO_SOURCES[srcIdx](bioguideId)}
      alt={name}
      className={`w-14 h-14 md:w-16 md:h-16 rounded-full object-cover shrink-0 ring-2 ${ring} bg-gray-800`}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      onError={() => {
        if (srcIdx < PHOTO_SOURCES.length - 1) setSrcIdx((p) => p + 1);
        else setFailed(true);
      }}
      loading="lazy"
    />
  );
}

function TradeShowcaseCard({ trade }: { trade: ShowcaseTrade }) {
  const isBuy = trade.type === "buy";

  return (
    <div className="min-w-[280px] md:min-w-[320px] bg-white/[0.04] backdrop-blur-lg border border-white/[0.08] rounded-2xl p-4 md:p-5 shrink-0 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300 group">
      <div className="flex items-center gap-3 mb-3">
        <ShowcasePhoto
          bioguideId={trade.bioguideId}
          name={trade.politicianName}
          party={trade.party}
        />
        <div className="min-w-0">
          <p className="text-sm md:text-base font-semibold text-white truncate">
            {trade.politicianName}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                trade.party === "Democrat"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {trade.party === "Democrat" ? "D" : "R"}
            </span>
            <span className="text-[11px] text-white/30">
              {trade.chamber} · {trade.state}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-lg ${
            isBuy
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-red-500/15 text-red-400"
          }`}
        >
          {isBuy ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {isBuy ? "BOUGHT" : "SOLD"}
        </span>
        <div className="flex items-center gap-1.5">
          <StockLogo ticker={trade.ticker} size={20} />
          <span className="text-sm font-bold text-white">{trade.ticker}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
        <span className="text-xs text-white/40 font-medium">{trade.size}</span>
        <span className="text-[10px] text-white/25">{trade.tradeDate}</span>
      </div>
    </div>
  );
}

export default function CongressShowcase() {
  const [scrollPos, setScrollPos] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const doubled = [...SHOWCASE_TRADES, ...SHOWCASE_TRADES];

  const animate = useCallback(() => {
    if (isPaused) return;
    setScrollPos((prev) => {
      const next = prev + 0.5;
      const singleWidth = SHOWCASE_TRADES.length * 336;
      return next >= singleWidth ? 0 : next;
    });
  }, [isPaused]);

  useEffect(() => {
    const id = setInterval(animate, 30);
    return () => clearInterval(id);
  }, [animate]);

  return (
    <div className="py-16 md:py-20 overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 mb-10">
        <div className="flex items-center gap-3 justify-center mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Landmark size={20} className="text-amber-400" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            See What Congress Is Trading
          </h2>
        </div>
        <p className="text-center text-gray-500 max-w-lg mx-auto text-sm md:text-base">
          Track STOCK Act disclosures from members of Congress.
          Know what politicians are buying and selling before the market moves.
        </p>
      </div>

      <div
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <div className="absolute left-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

        <div
          className="flex gap-4 transition-none"
          style={{ transform: `translateX(-${scrollPos}px)` }}
        >
          {doubled.map((trade, i) => (
            <TradeShowcaseCard key={`${trade.bioguideId}-${trade.ticker}-${i}`} trade={trade} />
          ))}
        </div>
      </div>

      <div className="text-center mt-8">
        <a
          href="/register"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/[0.06] border border-white/[0.1] text-sm font-medium text-white hover:bg-white/[0.1] hover:border-white/[0.15] transition-all duration-300"
        >
          Track all congressional trades
          <ChevronRight size={14} className="text-white/50" />
        </a>
      </div>
    </div>
  );
}
