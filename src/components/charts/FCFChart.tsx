"use client";

import { useState, useEffect, useCallback } from "react";
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
import { X } from "lucide-react";

interface FCFChartProps {
  ticker: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatLabel(dateStr: string, period: string): string {
  if (!dateStr) return "";
  if (period === "annual") return dateStr.substring(0, 4);
  const [y, m] = dateStr.split("-");
  return `${MONTHS[parseInt(m, 10) - 1] || m} '${y.slice(2)}`;
}

interface RefPoint {
  label: string;
  value: number;
}

export default function FCFChart({ ticker }: FCFChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [period, setPeriod] = useState<"annual" | "quarter">("annual");
  const [years, setYears] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refPoint, setRefPoint] = useState<RefPoint | null>(null);
  const [hoverVal, setHoverVal] = useState<number | null>(null);

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
      setRefPoint(null);
    }
    load();
  }, [ticker, period, years]);

  const handleClick = useCallback(
    (e: any) => {
      if (!e?.activePayload?.[0]) return;
      const p = e.activePayload[0].payload;
      if (refPoint && refPoint.label === p.label) {
        setRefPoint(null);
        return;
      }
      setRefPoint({ label: p.label, value: p.fcfPerShare });
    },
    [refPoint]
  );

  const handleMouseMove = useCallback((e: any) => {
    if (e?.activePayload?.[0]) setHoverVal(e.activePayload[0].payload.fcfPerShare);
  }, []);

  if (loading) return <div className="h-80 rounded-2xl bg-gray-900/50 animate-pulse" />;
  if (data.length === 0) {
    return <div className="h-80 flex items-center justify-center bg-gray-900/50 rounded-2xl text-gray-600">No FCF data available</div>;
  }

  const chartData = data.map((d: any) => ({
    label: formatLabel(d.date, period),
    fcfPerShare: Number(d.fcfPerShare?.toFixed(2)) || 0,
  }));

  const refChange = refPoint && hoverVal !== null && refPoint.value !== 0
    ? ((hoverVal - refPoint.value) / Math.abs(refPoint.value)) * 100
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">FCF Per Share</h3>
        <div className="flex gap-2">
          {(["annual", "quarter"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                period === p ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
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

      {refPoint && (
        <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-emerald-300">
              Anchor: <span className="text-white font-semibold">${refPoint.value.toFixed(2)}</span>
              <span className="text-gray-500 ml-1">({refPoint.label})</span>
            </span>
            {refChange !== null && (
              <span className={`font-semibold ${refChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {refChange >= 0 ? "+" : ""}{refChange.toFixed(2)}%
              </span>
            )}
          </div>
          <button onClick={() => setRefPoint(null)} className="text-gray-500 hover:text-white p-0.5"><X size={14} /></button>
        </div>
      )}

      {!refPoint && <p className="text-[11px] text-gray-600 italic">Click to set anchor point</p>}

      <div className="h-80 bg-gray-900/30 rounded-xl p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} onClick={handleClick} onMouseMove={handleMouseMove}>
            <defs>
              <linearGradient id={`fcfGrad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              axisLine={{ stroke: "#1f2937" }}
              tickLine={false}
              interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
              angle={period === "quarter" ? -30 : 0}
              dy={period === "quarter" ? 8 : 0}
              height={period === "quarter" ? 50 : 30}
            />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={60} />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: "12px", fontSize: "13px" }}
              labelStyle={{ color: "#9ca3af" }}
              itemStyle={{ color: "#22c55e" }}
              formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "FCF/Share"]}
            />
            <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
            {refPoint && (
              <ReferenceLine y={refPoint.value} stroke="#22c55e" strokeDasharray="6 3" strokeWidth={1.5} />
            )}
            <Area type="monotone" dataKey="fcfPerShare" stroke="#22c55e" fill={`url(#fcfGrad-${ticker})`} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: "#22c55e", stroke: "#111827", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
