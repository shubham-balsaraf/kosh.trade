"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface MarginChartProps {
  ticker: string;
}

export default function MarginChart({ ticker }: MarginChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/${ticker}`);
        const json = await res.json();
        const income = (json.income || []).reverse();
        setData(
          income.map((yr: any) => ({
            year: yr.calendarYear || yr.date?.substring(0, 4),
            gross: yr.grossProfitRatio ? +(yr.grossProfitRatio * 100).toFixed(1) : null,
            operating: yr.operatingIncomeRatio ? +(yr.operatingIncomeRatio * 100).toFixed(1) : null,
            net: yr.netIncomeRatio ? +(yr.netIncomeRatio * 100).toFixed(1) : null,
          }))
        );
      } catch {
        setData([]);
      }
      setLoading(false);
    }
    load();
  }, [ticker]);

  if (loading) return <div className="h-80 rounded-2xl bg-gray-900/50 animate-pulse" />;
  if (data.length === 0) {
    return <div className="h-80 flex items-center justify-center bg-gray-900/50 rounded-2xl text-gray-600">No margin data available</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-white">Margin Trends</h3>
      <div className="h-80 bg-gray-900/30 rounded-xl p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="year" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={{ stroke: "#1f2937" }} tickLine={false} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: "12px", fontSize: "13px" }}
              labelStyle={{ color: "#9ca3af" }}
              formatter={(value, name) => {
                const labels: Record<string, string> = { gross: "Gross Margin", operating: "Operating Margin", net: "Net Margin" };
                return [`${value}%`, labels[String(name)] || String(name)];
              }}
            />
            <Legend
              formatter={(value) => {
                const labels: Record<string, string> = { gross: "Gross", operating: "Operating", net: "Net" };
                return labels[value] || value;
              }}
              wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }}
            />
            <Line type="monotone" dataKey="gross" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} />
            <Line type="monotone" dataKey="operating" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} />
            <Line type="monotone" dataKey="net" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: "#f59e0b" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
