"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface PriceChartProps {
  ticker: string;
}

const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "3Y", days: 1095 },
  { label: "5Y", days: 1825 },
];

export default function PriceChart({ ticker }: PriceChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [range, setRange] = useState(365);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const to = new Date().toISOString().split("T")[0];
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - range);
        const from = fromDate.toISOString().split("T")[0];
        const res = await fetch(`/api/stocks/${ticker}/price?from=${from}&to=${to}`);
        const json = await res.json();
        setData((json.data || []).reverse());
      } catch {
        setData([]);
      }
      setLoading(false);
    }
    load();
  }, [ticker, range]);

  if (loading) return <div className="h-80 rounded-2xl bg-gray-900/50 animate-pulse" />;
  if (data.length === 0) {
    return <div className="h-80 flex items-center justify-center bg-gray-900/50 rounded-2xl text-gray-600">No price data available</div>;
  }

  const chartData = data.map((d: any) => ({
    date: d.date?.substring(5, 10),
    price: d.close,
  }));

  const firstPrice = chartData[0]?.price || 0;
  const lastPrice = chartData[chartData.length - 1]?.price || 0;
  const isPositive = lastPrice >= firstPrice;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">Price History</h3>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.days)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                range === r.days ? "bg-indigo-600 text-white" : "bg-gray-800/50 text-gray-500 hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-80 bg-gray-900/30 rounded-xl p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.2} />
                <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={{ stroke: "#1f2937" }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: "12px", fontSize: "13px" }}
              labelStyle={{ color: "#9ca3af" }}
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Price"]}
            />
            <Area type="monotone" dataKey="price" stroke={isPositive ? "#22c55e" : "#ef4444"} fill="url(#priceGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
