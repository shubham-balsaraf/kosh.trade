"use client";

interface ConfidenceGaugeProps {
  value: number;
  size?: number;
  label?: string;
}

export default function ConfidenceGauge({ value, size = 64, label }: ConfidenceGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  const color =
    clamped >= 70 ? "text-emerald-400" :
    clamped >= 45 ? "text-amber-400" :
    "text-red-400";

  const strokeColor =
    clamped >= 70 ? "#34d399" :
    clamped >= 45 ? "#fbbf24" :
    "#f87171";

  const glowColor =
    clamped >= 70 ? "rgba(52, 211, 153, 0.3)" :
    clamped >= 45 ? "rgba(251, 191, 36, 0.3)" :
    "rgba(248, 113, 113, 0.3)";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={4}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1s ease-out",
            filter: `drop-shadow(0 0 6px ${glowColor})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xs font-bold tabular-nums ${color}`}>{Math.round(clamped)}</span>
        {label && <span className="text-[7px] text-white/25 mt-px">{label}</span>}
      </div>
    </div>
  );
}
