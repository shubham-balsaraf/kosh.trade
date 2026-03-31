"use client";

import { useState, useEffect } from "react";

interface Ticker {
  symbol: string;
  price: string;
  change: string;
  up: boolean;
}

const FALLBACK: Ticker[] = [
  { symbol: "AAPL", price: "—", change: "—", up: true },
  { symbol: "MSFT", price: "—", change: "—", up: true },
  { symbol: "NVDA", price: "—", change: "—", up: true },
  { symbol: "GOOGL", price: "—", change: "—", up: true },
  { symbol: "AMZN", price: "—", change: "—", up: false },
  { symbol: "META", price: "—", change: "—", up: true },
  { symbol: "TSLA", price: "—", change: "—", up: false },
  { symbol: "JPM", price: "—", change: "—", up: true },
];

function TickerItem({ symbol, price, change, up }: Ticker) {
  return (
    <span className="inline-flex items-center gap-2 px-4 whitespace-nowrap">
      <span className="text-gray-400 font-semibold text-xs">{symbol}</span>
      <span className="text-gray-300 text-xs">${price}</span>
      <span className={`text-xs font-medium ${up ? "text-emerald-400" : "text-red-400"}`}>
        {change}
      </span>
    </span>
  );
}

export default function TickerStrip() {
  const [tickers, setTickers] = useState<Ticker[]>(FALLBACK);

  useEffect(() => {
    fetch("/api/market/tickers")
      .then((r) => r.json())
      .then((data) => {
        if (data.tickers?.length > 0) setTickers(data.tickers);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="w-full overflow-hidden border-y border-gray-800/50 bg-gray-950/50 py-2.5">
      <div className="animate-scroll-ticker flex w-max">
        {tickers.map((t, i) => (
          <TickerItem key={`a-${i}`} {...t} />
        ))}
        {tickers.map((t, i) => (
          <TickerItem key={`b-${i}`} {...t} />
        ))}
      </div>
    </div>
  );
}
