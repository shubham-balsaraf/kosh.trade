"use client";

import { useState } from "react";

interface StockLogoProps {
  ticker: string;
  size?: number;
  className?: string;
}

export default function StockLogo({ ticker, size = 32, className = "" }: StockLogoProps) {
  const [error, setError] = useState(false);
  const symbol = ticker.toUpperCase().replace(".", "-");

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-gray-800 text-gray-400 font-bold shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        {ticker.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={`https://assets.parqet.com/logos/symbol/${symbol}`}
      alt={ticker}
      width={size}
      height={size}
      className={`rounded-lg bg-gray-800 object-contain shrink-0 ${className}`}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}
