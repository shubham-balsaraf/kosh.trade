"use client";

import { useState, useEffect } from "react";
import { Activity } from "lucide-react";

interface Signal {
  name: string;
  score: number;
  signal: string;
}

interface FearGreedData {
  score: number;
  rating: string;
  signals: Signal[];
  spyPrice: number | null;
  spyChange: number;
  vix: number | null;
  updatedAt: string;
}

const RATING_CONFIG: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  "Extreme Fear": { color: "text-red-400", bg: "bg-red-500", border: "border-red-500/20", glow: "shadow-red-500/10" },
  "Fear": { color: "text-orange-400", bg: "bg-orange-500", border: "border-orange-500/20", glow: "shadow-orange-500/10" },
  "Neutral": { color: "text-yellow-400", bg: "bg-yellow-500", border: "border-yellow-500/20", glow: "shadow-yellow-500/10" },
  "Greed": { color: "text-lime-400", bg: "bg-lime-500", border: "border-lime-500/20", glow: "shadow-lime-500/10" },
  "Extreme Greed": { color: "text-emerald-400", bg: "bg-emerald-500", border: "border-emerald-500/20", glow: "shadow-emerald-500/10" },
};

function scoreColor(score: number): string {
  if (score <= 20) return "#ef4444";
  if (score <= 40) return "#f97316";
  if (score <= 60) return "#eab308";
  if (score <= 80) return "#84cc16";
  return "#22c55e";
}

function GaugeSVG({ score }: { score: number }) {
  const startAngle = -135;
  const endAngle = 135;
  const totalAngle = endAngle - startAngle;
  const needleAngle = startAngle + (score / 100) * totalAngle;

  const r = 80;
  const cx = 100;
  const cy = 100;

  function polarToCart(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  const segments = [
    { from: 0, to: 20, color: "#ef4444" },
    { from: 20, to: 40, color: "#f97316" },
    { from: 40, to: 60, color: "#eab308" },
    { from: 60, to: 80, color: "#84cc16" },
    { from: 80, to: 100, color: "#22c55e" },
  ];

  const needleEnd = polarToCart(needleAngle, r - 15);
  const needleColor = scoreColor(score);

  return (
    <svg viewBox="0 0 200 130" className="w-full max-w-[220px] mx-auto">
      {segments.map((seg, i) => {
        const a1 = startAngle + (seg.from / 100) * totalAngle;
        const a2 = startAngle + (seg.to / 100) * totalAngle;
        const p1 = polarToCart(a1, r);
        const p2 = polarToCart(a2, r);
        const largeArc = a2 - a1 > 180 ? 1 : 0;
        return (
          <path
            key={i}
            d={`M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`}
            fill="none"
            stroke={seg.color}
            strokeWidth="10"
            strokeLinecap="round"
            opacity={0.25}
          />
        );
      })}

      {/* Active arc up to needle */}
      {(() => {
        const a1 = startAngle;
        const a2 = needleAngle;
        const p1 = polarToCart(a1, r);
        const p2 = polarToCart(a2, r);
        const largeArc = a2 - a1 > 180 ? 1 : 0;
        return (
          <path
            d={`M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`}
            fill="none"
            stroke={needleColor}
            strokeWidth="10"
            strokeLinecap="round"
            opacity={0.85}
            className="transition-all duration-1000"
          />
        );
      })()}

      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={needleEnd.x}
        y2={needleEnd.y}
        stroke={needleColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        className="transition-all duration-1000"
      />
      <circle cx={cx} cy={cy} r="5" fill={needleColor} />
      <circle cx={cx} cy={cy} r="2.5" fill="#111827" />

      {/* Labels */}
      <text x="25" y="120" fill="#6b7280" fontSize="8" textAnchor="middle">Fear</text>
      <text x="175" y="120" fill="#6b7280" fontSize="8" textAnchor="middle">Greed</text>
    </svg>
  );
}

function SignalBar({ signal }: { signal: Signal }) {
  const color = scoreColor(signal.score);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500 w-28 shrink-0 truncate">{signal.name}</span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${signal.score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-gray-400 w-7 text-right font-mono">{signal.score}</span>
    </div>
  );
}

export default function FearGreedGauge() {
  const [data, setData] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/market/fear-greed")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
        <div className="skeleton h-4 w-32 mb-4" />
        <div className="skeleton h-28 w-28 mx-auto rounded-full mb-3" />
        <div className="skeleton h-4 w-20 mx-auto" />
      </div>
    );
  }

  if (!data || data.score === undefined) return null;

  const config = RATING_CONFIG[data.rating] || RATING_CONFIG["Neutral"];

  return (
    <div
      className={`bg-gray-900/50 border ${config.border} rounded-2xl p-4 sm:p-5 shadow-lg ${config.glow} transition-all cursor-pointer`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity size={16} className={config.color} />
          <span className="text-sm font-semibold text-gray-300">Market Sentiment</span>
        </div>
        <div className="flex items-center gap-3">
          {data.spyPrice != null && (
            <div>
              <span className="text-[10px] text-gray-500">SPY</span>
              <span className={`text-[10px] font-semibold ml-1 ${data.spyChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {data.spyChange >= 0 ? "+" : ""}{data.spyChange.toFixed(2)}%
              </span>
            </div>
          )}
          {data.vix != null && (
            <div>
              <span className="text-[10px] text-gray-500">VIX</span>
              <span className={`text-[10px] font-semibold ml-1 ${data.vix > 25 ? "text-red-400" : data.vix > 18 ? "text-amber-400" : "text-emerald-400"}`}>
                {data.vix.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <div className="shrink-0 w-[140px] sm:w-[180px]">
          <GaugeSVG score={data.score} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-3xl sm:text-4xl font-black text-white">{data.score}</div>
          <div className={`text-sm font-bold ${config.color} mt-0.5`}>{data.rating}</div>
          {!expanded && data.signals.length > 0 && (
            <div className="mt-2 space-y-1.5 hidden sm:block">
              {data.signals.slice(0, 3).map((sig) => (
                <SignalBar key={sig.name} signal={sig} />
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-600 mt-2">
            {expanded ? "Tap to collapse" : "Tap for full breakdown"}
          </p>
        </div>
      </div>

      {expanded && data.signals.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-800 space-y-2.5">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-2">All Indicators</p>
          {data.signals.map((sig) => (
            <SignalBar key={sig.name} signal={sig} />
          ))}
        </div>
      )}
    </div>
  );
}
