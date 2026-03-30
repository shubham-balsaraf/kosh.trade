"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface FCFvsSBCChartProps {
  ticker: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatLabel(dateStr: string, period: string): string {
  if (!dateStr) return "";
  if (period === "annual") return dateStr.substring(0, 4);
  const [y, m] = dateStr.split("-");
  return `${MONTHS[parseInt(m, 10) - 1] || m} '${y.slice(2)}`;
}

export default function FCFvsSBCChart({ ticker }: FCFvsSBCChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [period, setPeriod] = useState<"annual" | "quarter">("annual");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/${ticker}/fcf?period=${period}&limit=20`);
        const json = await res.json();
        setData(json.data || []);
      } catch {
        setData([]);
      }
      setLoading(false);
    }
    load();
  }, [ticker, period]);

  if (loading) return <div className="h-80 rounded-2xl bg-gray-900/50 animate-pulse" />;
  if (data.length === 0) {
    return <div className="h-80 flex items-center justify-center bg-gray-900/50 rounded-2xl text-gray-600">No data available</div>;
  }

  const fmt = (v: number) => {
    if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
    return `$${v}`;
  };

  const chartData = data.map((d: any) => ({
    label: formatLabel(d.date, period),
    fcf: d.freeCashFlow || 0,
    sbc: d.stockBasedCompensation || 0,
  }));

  const latestFcf = chartData[chartData.length - 1]?.fcf || 0;
  const latestSbc = chartData[chartData.length - 1]?.sbc || 0;
  const sbcRatio = latestFcf !== 0 ? ((latestSbc / latestFcf) * 100).toFixed(1) : "N/A";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">FCF vs Stock-Based Compensation</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            SBC is <span className={`font-semibold ${Number(sbcRatio) > 30 ? "text-amber-400" : "text-gray-400"}`}>{sbcRatio}%</span> of FCF (latest)
          </p>
        </div>
        <div className="flex gap-2">
          {(["annual", "quarter"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                period === p ? "bg-amber-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {p === "annual" ? "Annual" : "Quarterly"}
            </button>
          ))}
        </div>
      </div>

      <div className="h-80 bg-gray-900/30 rounded-xl p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              axisLine={{ stroke: "#1f2937" }}
              tickLine={false}
              interval={Math.max(0, Math.floor(chartData.length / 10) - 1)}
              angle={period === "quarter" ? -30 : 0}
              dy={period === "quarter" ? 8 : 0}
              height={period === "quarter" ? 50 : 30}
            />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={65} />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: "12px", fontSize: "13px" }}
              labelStyle={{ color: "#9ca3af" }}
              formatter={(value: any, name: any) => [fmt(Number(value)), name === "fcf" ? "Free Cash Flow" : "Stock-Based Comp"]}
            />
            <Legend
              formatter={(value) => (value === "fcf" ? "Free Cash Flow" : "Stock-Based Comp")}
              wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }}
            />
            <Bar dataKey="fcf" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="sbc" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
