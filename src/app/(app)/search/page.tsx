"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, TrendingUp, Clock } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";

const popularTickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "UNH"];

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  const goToStock = (ticker: string) => {
    router.push(`/stock/${ticker.toUpperCase()}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analyse a Stock</h1>
        <p className="text-gray-500 text-sm mt-1">
          Enter a ticker or company name for full fundamental analysis
        </p>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <Input
            placeholder="Enter ticker or company name... e.g. AAPL"
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (results.length > 0) goToStock(results[0].symbol);
                else if (query.trim()) goToStock(query.trim());
              }
            }}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} loading={loading}>
          Search
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r: any) => (
            <Card
              key={r.symbol}
              hover
              onClick={() => goToStock(r.symbol)}
              className="flex items-center justify-between"
            >
              <div>
                <span className="text-white font-bold">{r.symbol}</span>
                <span className="text-gray-500 text-sm ml-3">{r.name}</span>
              </div>
              <span className="text-xs text-gray-600">{r.exchangeShortName}</span>
            </Card>
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-gray-400">Popular Tickers</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {popularTickers.map((t) => (
            <button
              key={t}
              onClick={() => goToStock(t)}
              className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm font-medium text-gray-300 hover:bg-gray-800 hover:border-gray-700 hover:text-white transition-all"
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
