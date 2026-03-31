"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import StockLogo from "@/components/ui/StockLogo";
import { Landmark, ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";

interface Trade {
  politicianName: string;
  bioguideId: string;
  party: string;
  chamber: string;
  state: string;
  issuerName: string;
  ticker: string | null;
  type: "buy" | "sell";
  size: string;
  tradeDate: string;
  publishedDate: string;
}

function PoliticianPhoto({
  bioguideId,
  name,
  party,
}: {
  bioguideId: string;
  name: string;
  party: string;
}) {
  const [error, setError] = useState(false);
  const borderColor =
    party === "Democrat"
      ? "ring-blue-500/50"
      : party === "Republican"
        ? "ring-red-500/50"
        : "ring-gray-500/50";

  if (error || !bioguideId) {
    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const bgColor =
      party === "Democrat"
        ? "bg-blue-900/50 text-blue-300"
        : party === "Republican"
          ? "bg-red-900/50 text-red-300"
          : "bg-gray-800 text-gray-400";
    return (
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ring-2 ${borderColor} ${bgColor}`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={`https://theunitedstates.io/images/congress/225x275/${bioguideId}.jpg`}
      alt={name}
      width={40}
      height={40}
      className={`w-10 h-10 rounded-full object-cover shrink-0 ring-2 ${borderColor} bg-gray-800`}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}

function TradeCard({ trade }: { trade: Trade }) {
  const isBuy = trade.type === "buy";

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-all group">
      <PoliticianPhoto
        bioguideId={trade.bioguideId}
        name={trade.politicianName}
        party={trade.party}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white truncate">
            {trade.politicianName}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
              trade.party === "Democrat"
                ? "bg-blue-500/15 text-blue-400"
                : trade.party === "Republican"
                  ? "bg-red-500/15 text-red-400"
                  : "bg-gray-500/15 text-gray-400"
            }`}
          >
            {trade.party === "Democrat"
              ? "D"
              : trade.party === "Republican"
                ? "R"
                : "I"}
          </span>
          <span className="text-[10px] text-white/20">
            {trade.chamber} · {trade.state}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mt-1">
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
              isBuy
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {isBuy ? (
              <ArrowUpRight size={10} />
            ) : (
              <ArrowDownRight size={10} />
            )}
            {isBuy ? "BOUGHT" : "SOLD"}
          </span>

          {trade.ticker ? (
            <div className="flex items-center gap-1">
              <StockLogo ticker={trade.ticker} size={16} />
              <span className="text-xs font-bold text-white/80">
                {trade.ticker}
              </span>
            </div>
          ) : (
            <span className="text-xs text-white/50 truncate max-w-[140px]">
              {trade.issuerName}
            </span>
          )}

          {trade.size && (
            <>
              <span className="text-[10px] text-white/10">·</span>
              <span className="text-[10px] text-white/30 font-medium">
                ${trade.size}
              </span>
            </>
          )}
        </div>

        {(trade.tradeDate || trade.publishedDate) && (
          <div className="flex items-center gap-2 mt-1">
            {trade.tradeDate && (
              <span className="text-[10px] text-white/20">
                Traded {trade.tradeDate}
              </span>
            )}
            {trade.publishedDate && trade.publishedDate !== trade.tradeDate && (
              <>
                <span className="text-[10px] text-white/10">·</span>
                <span className="text-[10px] text-white/15">
                  Filed {trade.publishedDate}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Landmark size={14} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-gray-400">
          Capitol Hill Trades
        </h3>
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-white/[0.05]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-white/[0.05] rounded w-32" />
              <div className="h-3 bg-white/[0.05] rounded w-48" />
              <div className="h-2 bg-white/[0.05] rounded w-24" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function CongressTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/congress/trades")
      .then((r) => r.json())
      .then((data) => setTrades(data.trades || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (trades.length === 0) return null;

  const visibleTrades = expanded ? trades : trades.slice(0, 5);

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Landmark size={14} className="text-amber-400" />
          <h3 className="text-sm font-semibold text-gray-400">
            Capitol Hill Trades
          </h3>
        </div>
        <a
          href="https://www.capitoltrades.com/trades"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/40 transition-colors"
        >
          STOCK Act
          <ExternalLink size={8} />
        </a>
      </div>
      <p className="text-[10px] text-white/15 mb-3">
        Recent stock trades disclosed by members of Congress
      </p>

      <div className="space-y-0.5">
        {visibleTrades.map((trade, i) => (
          <TradeCard key={`${trade.bioguideId}-${trade.ticker}-${i}`} trade={trade} />
        ))}
      </div>

      {trades.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-2 py-2 text-xs text-white/30 hover:text-white/50 transition-colors font-medium"
        >
          {expanded ? "Show less" : `Show all ${trades.length} trades`}
        </button>
      )}
    </Card>
  );
}
