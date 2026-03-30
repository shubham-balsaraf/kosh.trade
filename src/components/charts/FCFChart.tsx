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
  ReferenceLine,
} from "recharts";

interface FCFChartProps {
  ticker: string;
}

export default function FCFChart({ ticker }: FCFChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [period, setPeriod] = useState<"annual" | "quarter">("annual");
  const [years, setYears] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const limit = period === "annual" ? years : years * 4;
        const res = await fetch(`/api/stocks/${ticker}/fcf?period=${period}&limit=${limit}`);
        const json = await res.json();
        setData(json.data || []);
      } catch {
        setData([]);
      }
      setLoading(false);
    }
    load();
  }, [ticker, period, years]);

  if (loading) {
    return <div className="h-80 rounded-2xl bg-gray-900/50 animate-pulse" />;
  }

  if (data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center bg-gray-900/50 rounded-2xl text-gray-600">
        No FCF data available
      </div>
    );
  }

  const chartData = data.map((d: any) => ({
    label: period === "annual" ? d.date?.substring(0, 4) : d.date?.substring(0, 7),
    fcfPerShare: Number(d.fcfPerShare?.toFixed(2)) || 0,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">FCF Per Share</h3>
        <div className="flex gap-2">
          {(["annual", "quarter"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                period === p ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {p === "annual" ? "Annual" : "Quarterly"}
            </button>
          ))}
          <span className="text-gray-600 text-xs flex items-center mx-1">|</span>
          {[3, 5, 10, 20].map((y) => (
            <button
              key={y}
              onClick={() => setYears(y)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                years === y ? "bg-gray-700 text-white" : "bg-gray-800/50 text-gray-500 hover:text-white"
              }`}
            >
              {y}Y
            </button>
          ))}
        </div>
      </div>

      <div className="h-80 bg-gray-900/30 rounded-xl p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fcfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={{ stroke: "#1f2937" }} tickLine={false} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: "12px", fontSize: "13px" }}
              labelStyle={{ color: "#9ca3af" }}
              itemStyle={{ color: "#22c55e" }}
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "FCF/Share"]}
            />
            <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="fcfPerShare" stroke="#22c55e" fill="url(#fcfGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#22c55e" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
