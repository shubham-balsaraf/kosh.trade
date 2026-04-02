"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";
import ProGate from "@/components/ui/ProGate";
import { useTrackView } from "@/hooks/useTrackView";
import { TrendingDown, ArrowDown } from "lucide-react";

export default function DipFinderPage() {
  useTrackView("Dip Finder");
  const router = useRouter();
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dip-finder")
      .then((r) => r.json())
      .then((d) => setStocks(d.stocks || []))
      .catch(() => setStocks([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ProGate feature="Dip Finder">
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dip Finder</h1>
        <p className="text-gray-500 text-sm mt-1">
          Quality stocks trading 15%+ below their 52-week high
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-16 w-full" />
          ))}
        </div>
      ) : stocks.length === 0 ? (
        <Card className="text-center py-16">
          <TrendingDown size={48} className="mx-auto text-gray-700 mb-4" />
          <p className="text-gray-400 text-lg font-semibold">No dips found</p>
          <p className="text-gray-600 text-sm mt-2">
            All screened stocks are within 15% of their 52-week high
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-800">
                <th className="text-left py-3 pr-4">Stock</th>
                <th className="text-right py-3 px-2">Price</th>
                <th className="text-right py-3 px-2">52W High</th>
                <th className="text-right py-3 px-2">52W Low</th>
                <th className="text-right py-3 px-2">
                  <span className="flex items-center justify-end gap-1">
                    <ArrowDown size={12} /> From High
                  </span>
                </th>
                <th className="text-right py-3 px-2">P/E</th>
                <th className="text-right py-3 px-2">Mkt Cap</th>
                <th className="text-left py-3 pl-2">Sector</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((s: any, i: number) => (
                <tr
                  key={s.ticker}
                  className={`cursor-pointer hover:bg-gray-900/70 transition-colors ${i % 2 === 0 ? "bg-gray-900/30" : ""}`}
                  onClick={() => router.push(`/stock/${s.ticker}`)}
                >
                  <td className="py-3 pr-4">
                    <div className="font-bold text-white">{s.ticker}</div>
                    <div className="text-[11px] text-gray-500 truncate max-w-[180px]">{s.name}</div>
                  </td>
                  <td className="py-3 px-2 text-right text-white font-medium">{formatCurrency(s.price)}</td>
                  <td className="py-3 px-2 text-right text-gray-400">{formatCurrency(s.yearHigh)}</td>
                  <td className="py-3 px-2 text-right text-gray-400">{formatCurrency(s.yearLow)}</td>
                  <td className="py-3 px-2 text-right">
                    <Badge variant="red">-{s.distFromHigh}%</Badge>
                  </td>
                  <td className="py-3 px-2 text-right text-gray-300">{s.pe ? `${s.pe.toFixed(1)}x` : "N/A"}</td>
                  <td className="py-3 px-2 text-right text-gray-300">{formatCurrency(s.marketCap, true)}</td>
                  <td className="py-3 pl-2">
                    {s.sector && <Badge variant="gray">{s.sector}</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </ProGate>
  );
}
