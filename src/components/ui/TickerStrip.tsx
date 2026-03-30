"use client";

const tickers = [
  { symbol: "AAPL", price: "198.52", change: "+1.24%", up: true },
  { symbol: "MSFT", price: "425.10", change: "-0.31%", up: false },
  { symbol: "NVDA", price: "890.00", change: "+2.87%", up: true },
  { symbol: "GOOGL", price: "172.45", change: "+0.68%", up: true },
  { symbol: "AMZN", price: "186.30", change: "-0.52%", up: false },
  { symbol: "META", price: "510.75", change: "+1.93%", up: true },
  { symbol: "TSLA", price: "245.20", change: "-1.15%", up: false },
  { symbol: "JPM", price: "198.80", change: "+0.42%", up: true },
  { symbol: "V", price: "280.90", change: "+0.78%", up: true },
  { symbol: "UNH", price: "520.15", change: "-0.89%", up: false },
  { symbol: "BRK.B", price: "410.50", change: "+0.35%", up: true },
  { symbol: "LLY", price: "780.25", change: "+2.14%", up: true },
];

function TickerItem({ symbol, price, change, up }: typeof tickers[number]) {
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
