"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, TrendingUp } from "lucide-react";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import StockLogo from "@/components/ui/StockLogo";

const popularTickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "UNH"];

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const goToStock = (ticker: string) => {
    router.push(`/stock/${ticker.toUpperCase()}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analyse a Stock</h1>
        <p className="text-gray-500 text-sm mt-1">
          Type a ticker or company name — results appear as you type
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
        <Input
          placeholder="Search... e.g. Apple, AAPL, Cisco, MSFT"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (results.length > 0) goToStock(results[0].symbol);
              else if (query.trim()) goToStock(query.trim());
            }
          }}
          className="pl-10 !text-base !py-3"
          autoFocus
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-indigo-400 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-600 px-1">{results.length} results</p>
          {results.map((r: any) => (
            <Card
              key={r.symbol}
              hover
              onClick={() => goToStock(r.symbol)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <StockLogo ticker={r.symbol} size={28} className="rounded-md" />
                <span className="text-white font-bold text-sm shrink-0">{r.symbol}</span>
                <span className="text-gray-400 text-sm truncate">{r.name}</span>
              </div>
              <span className="text-xs text-gray-600 shrink-0">{r.exchangeShortName}</span>
            </Card>
          ))}
        </div>
      )}

      {query.trim() && results.length === 0 && !loading && (
        <Card className="text-center py-8">
          <p className="text-gray-500">No results for &quot;{query}&quot;</p>
          <p className="text-gray-600 text-sm mt-1">Try a different ticker or company name</p>
        </Card>
      )}

      {!query.trim() && (
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm font-medium text-gray-300 hover:bg-gray-800 hover:border-gray-700 hover:text-white transition-all"
              >
                <StockLogo ticker={t} size={20} className="rounded-md" />
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
