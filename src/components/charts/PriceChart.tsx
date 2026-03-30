"use client";

import { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/useMediaQuery";
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateLabel(dateStr: string, rangeDays: number): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const month = MONTHS[parseInt(m, 10) - 1] || m;
  if (rangeDays <= 90) return `${month} ${parseInt(d, 10)}`;
  if (rangeDays <= 365) return `${month} '${y.slice(2)}`;
  return `${month} ${y}`;
}

function formatFullDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const month = MONTHS[parseInt(m, 10) - 1] || m;
  return `${month} ${parseInt(d, 10)}, ${y}`;
}

interface RefPoint {
  date: string;
  price: number;
  index: number;
}

export default function PriceChart({ ticker }: PriceChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [range, setRange] = useState(365);
  const [loading, setLoading] = useState(true);
  const [refPoint, setRefPoint] = useState<RefPoint | null>(null);
  const [hoverData, setHoverData] = useState<{ price: number; date: string } | null>(null);
  const mobile = useIsMobile();

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
      setRefPoint(null);
      setHoverData(null);
    }
    load();
  }, [ticker, range]);

  const handleChartClick = useCallback(
    (e: any) => {
      if (!e?.activePayload?.[0]) return;
      const payload = e.activePayload[0].payload;
      if (refPoint && refPoint.date === payload.fullDate) {
        setRefPoint(null);
        return;
      }
      setRefPoint({
        date: payload.fullDate,
        price: payload.price,
        index: e.activeTooltipIndex ?? 0,
      });
    },
    [refPoint]
  );

  const handleMouseMove = useCallback((e: any) => {
    if (e?.activePayload?.[0]) {
      const p = e.activePayload[0].payload;
      setHoverData({ price: p.price, date: p.fullDate });
    }
  }, []);

  if (loading) return <div className="h-96 rounded-2xl bg-gray-900/50 animate-pulse" />;
  if (data.length === 0) {
    return <div className="h-96 flex items-center justify-center bg-gray-900/50 rounded-2xl text-gray-600">No price data available</div>;
  }

  const chartData = data.map((d: any) => ({
    date: formatDateLabel(d.date, range),
    fullDate: d.date,
    price: d.close,
  }));

  const firstPrice = chartData[0]?.price || 0;
  const lastPrice = chartData[chartData.length - 1]?.price || 0;
  const isPositive = lastPrice >= firstPrice;
  const totalChange = ((lastPrice - firstPrice) / firstPrice) * 100;

  const refChange =
    refPoint && hoverData
      ? ((hoverData.price - refPoint.price) / refPoint.price) * 100
      : null;
  const refDollarChange =
    refPoint && hoverData ? hoverData.price - refPoint.price : null;

  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">Price History</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-2xl font-bold text-white">${lastPrice.toFixed(2)}</span>
            <span className={`text-sm font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {isPositive ? "+" : ""}{totalChange.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.days)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                range === r.days ? "bg-blue-600 text-white" : "bg-gray-800/50 text-gray-500 hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reference point info bar */}
      {refPoint && (
        <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-blue-300">
              Anchor: <span className="text-white font-semibold">${refPoint.price.toFixed(2)}</span>
              <span className="text-gray-500 ml-1">({formatFullDate(refPoint.date)})</span>
            </span>
            {refChange !== null && (
              <span className={`font-semibold ${refChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {refChange >= 0 ? "+" : ""}{refDollarChange!.toFixed(2)} ({refChange >= 0 ? "+" : ""}{refChange.toFixed(2)}%)
              </span>
            )}
          </div>
          <button
            onClick={() => setRefPoint(null)}
            className="text-gray-500 hover:text-white transition-colors p-0.5"
            title="Clear anchor"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {!refPoint && (
        <p className="text-[11px] text-gray-600 italic">{mobile ? "Tap" : "Click"} any point to set an anchor and track % change</p>
      )}

      <div className={`${mobile ? "h-56" : "h-80"} bg-gray-900/30 rounded-xl p-2`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 5, left: 0, bottom: 0 }}
            onClick={handleChartClick}
            onMouseMove={handleMouseMove}
          >
            <defs>
              <linearGradient id={`priceGrad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.2} />
                <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#9ca3af", fontSize: mobile ? 9 : 11 }}
              axisLine={{ stroke: "#1f2937" }}
              tickLine={false}
              interval={mobile ? Math.max(tickInterval, Math.floor(chartData.length / 5)) : tickInterval}
              angle={range > 365 ? -30 : 0}
              dy={range > 365 ? 8 : 0}
              height={range > 365 ? 50 : 30}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: mobile ? 9 : 11 }}
              axisLine={false}
              tickLine={false}
              domain={["auto", "auto"]}
              tickFormatter={(v) => `$${v}`}
              width={mobile ? 45 : 60}
            />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: "12px", fontSize: "13px" }}
              labelFormatter={(_, payload) => {
                const d = payload?.[0]?.payload?.fullDate;
                return d ? formatFullDate(d) : "";
              }}
              formatter={(value: any) => {
                const price = Number(value);
                const parts: string[] = [`$${price.toFixed(2)}`];
                return [parts.join(""), "Price"];
              }}
            />
            {refPoint && (
              <ReferenceLine
                y={refPoint.price}
                stroke="#3b82f6"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{
                  value: `$${refPoint.price.toFixed(2)}`,
                  position: "right",
                  fill: "#60a5fa",
                  fontSize: 11,
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="price"
              stroke={isPositive ? "#22c55e" : "#ef4444"}
              fill={`url(#priceGrad-${ticker})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: isPositive ? "#22c55e" : "#ef4444", stroke: "#111827", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
