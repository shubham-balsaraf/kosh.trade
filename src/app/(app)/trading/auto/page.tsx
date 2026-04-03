"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import StockLogo from "@/components/ui/StockLogo";
import DataFreshness from "@/components/ui/DataFreshness";
import {
  Navigation, Power, PowerOff, TrendingUp, TrendingDown, DollarSign,
  BarChart3, Target, Clock, Activity, RefreshCw, Settings, Zap,
  Search, Brain, ShieldCheck, ArrowRight, ArrowLeft, Sparkles,
  X, Plus, ChevronRight, AlertTriangle, RotateCcw,
  Wallet, Lock, ChevronDown, ChevronUp, Plane, Eye, Radio,
  Newspaper, Users, Landmark, CalendarDays, Radar,
} from "lucide-react";
import ProGate from "@/components/ui/ProGate";
import { useTrackView } from "@/hooks/useTrackView";

interface TradingConfig {
  enabled: boolean;
  mode: string;
  paperBalance: number;
  maxPositionPct: number;
  maxDailyLossPct: number;
  maxOpenPositions: number;
  riskProfile: string;
  weeklyTargetPct: number;
  watchlist: string[];
  strategies: string[];
  updatedAt?: string;
  createdAt?: string;
}

interface Stats {
  totalTrades: number;
  winners: number;
  losers: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  openPositions: number;
  weeklyPnl: number;
  weeklyTargetDollars: number;
  weeklyProgressPct: number;
}

interface AutoTrade {
  id: string;
  ticker: string;
  side: string;
  qty: number;
  entryPrice: number | null;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  pnl: number | null;
  strategy: string | null;
  aiConfidence: number | null;
  signalScore: number | null;
  status: string;
  exitReason: string | null;
  entryAt: string | null;
  exitAt: string | null;
  createdAt: string;
}

interface DiscoveredTicker {
  ticker: string;
  source: "screener" | "news" | "congress" | "insider" | "earnings";
  reason: string;
  urgency: number;
}

interface SignalIndicator {
  name: string;
  score: number;
  reason: string;
}

interface ScannedSignal {
  ticker: string;
  action: string;
  score: number;
  confidence: number;
  convictionScore: number | null;
  strategy: string;
  price: number;
  stopLoss: number;
  takeProfit: number;
  indicators: SignalIndicator[];
  source: "watchlist" | "discovered";
  discoveryReason: string | null;
  decision: "TRADED" | "SKIPPED" | "NOT_EVALUATED" | "ADD_ON";
  decisionReason: string | null;
}

interface RunResult {
  status?: string;
  reason?: string;
  scanned?: number;
  signalsFound?: number;
  tradesExecuted?: number;
  exitsExecuted?: number;
  details?: any[];
  discovered?: DiscoveredTicker[];
  allSignals?: ScannedSignal[];
  error?: string;
}

interface CronStatus {
  configured: boolean;
  enabled: boolean;
  status: "active" | "stale" | "inactive" | "sleeping";
  lastRunAt: string | null;
  lastResult: string | null;
  lastTrades: number;
  lastSignals: number;
  totalRuns: number;
  minutesAgo: number | null;
}

const DEFAULT_WATCHLIST = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD", "NFLX", "JPM",
  "BTC-USD", "ETH-USD", "SOL-USD",
];

const HOW_IT_WORKS = [
  { icon: Search, title: "Scans Markets", desc: "Scans 10+ stocks for RSI, MACD, Bollinger, VWAP, Stochastic, ADX every cycle" },
  { icon: Brain, title: "7-Dim Conviction", desc: "Scores each stock across technical, fundamental, valuation, smart money, catalysts, signals & risk" },
  { icon: Zap, title: "Auto Executes", desc: "Places trades automatically with stop-losses and take-profits" },
  { icon: ShieldCheck, title: "Risk Shield", desc: "Position limits, daily loss caps, conviction gates, PDT compliance built in" },
];

const BALANCE_OPTIONS = [
  { amount: 1000, label: "Starter" },
  { amount: 5000, label: "Standard" },
  { amount: 10000, label: "Pro" },
  { amount: 25000, label: "Whale" },
];

type LiveQuote = { price: number; change: number; changePercent: number };

function AnimatedPrice({ value, prefix = "$", decimals = 2, className = "" }: {
  value: number; prefix?: string; decimals?: number; className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  const prevRef = useRef(value);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev === value) return;
    setDirection(value > prev ? "up" : "down");
    const start = prev;
    const diff = value - prev;
    const duration = 600;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(start + diff * eased);
      if (t < 1) animRef.current = requestAnimationFrame(animate);
    };
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);
    prevRef.current = value;

    const timeout = setTimeout(() => setDirection(null), 1000);
    return () => { cancelAnimationFrame(animRef.current); clearTimeout(timeout); };
  }, [value]);

  return (
    <span className={`price-transition tabular-nums ${
      direction === "up" ? "price-glow-green" : direction === "down" ? "price-glow-red" : ""
    } ${className}`}>
      {prefix}{Math.abs(display).toFixed(decimals)}
    </span>
  );
}

function LivePositionCard({ trade, quote }: { trade: AutoTrade; quote?: LiveQuote }) {
  const [flashKey, setFlashKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const prevPriceRef = useRef(quote?.price);
  const flashDir = useRef<"up" | "down" | null>(null);

  useEffect(() => {
    if (!quote || prevPriceRef.current === quote.price) return;
    flashDir.current = quote.price > (prevPriceRef.current || 0) ? "up" : "down";
    prevPriceRef.current = quote.price;
    setFlashKey((k) => k + 1);
  }, [quote]);

  const currentPrice = quote?.price || trade.entryPrice || 0;
  const entryPrice = trade.entryPrice || 0;
  const unrealizedPnl = (currentPrice - entryPrice) * trade.qty;
  const unrealizedPct = entryPrice ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
  const isUp = unrealizedPnl >= 0;
  const positionValue = currentPrice * trade.qty;

  const sl = trade.stopLoss || 0;
  const tp = trade.takeProfit || 0;
  let progressPct = 50;
  if (sl && tp && tp !== sl) {
    progressPct = Math.max(0, Math.min(100, ((currentPrice - sl) / (tp - sl)) * 100));
  }

  const riskDollars = sl > 0 ? (entryPrice - sl) * trade.qty : 0;
  const rewardDollars = tp > 0 ? (tp - entryPrice) * trade.qty : 0;
  const holdingDays = trade.entryAt ? Math.floor((Date.now() - new Date(trade.entryAt).getTime()) / 86400000) : 0;

  return (
    <div
      key={flashKey}
      className={`glass-card overflow-hidden transition-all duration-300 cursor-pointer ${
        flashDir.current === "up" ? "tick-flash-green" : flashDir.current === "down" ? "tick-flash-red" : ""
      } ${expanded ? "border-white/[0.1]" : ""}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <StockLogo ticker={trade.ticker} size={40} />
              {quote && <span className="live-dot absolute -top-0.5 -right-0.5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white/90 font-bold text-sm">{trade.ticker}</span>
                <span className="text-white/20 text-xs">{trade.qty} shr</span>
                {trade.strategy && <Badge variant="gray">{trade.strategy}</Badge>}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-white/25 text-xs">${entryPrice.toFixed(2)}</span>
                {quote && (
                  <>
                    <span className="text-white/10">&rarr;</span>
                    <AnimatedPrice
                      value={currentPrice}
                      decimals={2}
                      className={`text-xs font-semibold ${isUp ? "text-emerald-400" : "text-red-400"}`}
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0 space-y-0.5">
            {quote ? (
              <>
                <div className="flex items-center justify-end gap-1.5">
                  {isUp ? <TrendingUp size={12} className="text-emerald-400/70" /> : <TrendingDown size={12} className="text-red-400/70" />}
                  <AnimatedPrice
                    value={unrealizedPnl}
                    prefix={unrealizedPnl >= 0 ? "+$" : "-$"}
                    decimals={2}
                    className={`text-sm font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}
                  />
                </div>
                <p className={`text-[10px] font-medium ${isUp ? "text-emerald-400/50" : "text-red-400/50"}`}>
                  {unrealizedPct >= 0 ? "+" : ""}{unrealizedPct.toFixed(2)}%
                </p>
              </>
            ) : (
              <>
                {trade.aiConfidence && <p className="text-xs text-amber-400/50 font-medium">{trade.aiConfidence.toFixed(0)}% AI</p>}
                <p className="text-[10px] text-white/15">{trade.entryAt ? new Date(trade.entryAt).toLocaleDateString() : "\u2014"}</p>
              </>
            )}
          </div>
        </div>

        {sl > 0 && tp > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-red-400/40">SL ${sl.toFixed(2)}</span>
              <span className="text-white/15">${currentPrice.toFixed(2)}</span>
              <span className="text-emerald-400/40">TP ${tp.toFixed(2)}</span>
            </div>
            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden relative">
              <div
                className={`pnl-bar h-full rounded-full ${
                  progressPct > 60 ? "bg-gradient-to-r from-amber-500/60 to-emerald-500/60"
                    : progressPct < 40 ? "bg-gradient-to-r from-red-500/60 to-amber-500/60"
                      : "bg-amber-500/50"
                }`}
                style={{ width: `${progressPct}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)] transition-all duration-600"
                style={{ left: `calc(${progressPct}% - 5px)` }}
              />
            </div>
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 border-t border-white/[0.04] mt-0 animate-fade-slide-up">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
            <div>
              <p className="text-[10px] text-white/20 uppercase tracking-wider">Value</p>
              <p className="text-xs font-semibold text-white/70 mt-0.5">${positionValue.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/20 uppercase tracking-wider">Risk</p>
              <p className="text-xs font-semibold text-red-400/70 mt-0.5">-${riskDollars.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/20 uppercase tracking-wider">Reward</p>
              <p className="text-xs font-semibold text-emerald-400/70 mt-0.5">+${rewardDollars.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/20 uppercase tracking-wider">Holding</p>
              <p className="text-xs font-semibold text-white/70 mt-0.5">{holdingDays}d</p>
            </div>
          </div>
          {trade.aiConfidence != null && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-white/20">AI Confidence</span>
                  <span className="text-amber-400/60">{trade.aiConfidence.toFixed(0)}%</span>
                </div>
                <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500/40 to-amber-400/60 rounded-full pnl-bar" style={{ width: `${trade.aiConfidence}%` }} />
                </div>
              </div>
              {trade.signalScore != null && (
                <div className="text-right">
                  <p className="text-[10px] text-white/20">Score</p>
                  <p className="text-xs font-bold text-amber-400/70">{trade.signalScore.toFixed(1)}</p>
                </div>
              )}
            </div>
          )}
          {quote && (
            <div className="mt-3 flex items-center gap-2 text-[10px] text-white/15">
              <Radio size={8} className="text-emerald-400/50" />
              Day change: <span className={quote.changePercent >= 0 ? "text-emerald-400/60" : "text-red-400/60"}>
                {quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
              </span>
              ({quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)})
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const RISK_PROFILES = [
  { id: "CONSERVATIVE", label: "Conservative", icon: ShieldCheck, desc: "Fewer trades, higher conviction. 3% position, 1% daily cap.", color: "emerald", maxPositionPct: 3, maxDailyLossPct: 1, maxOpenPositions: 3, weeklyTargetPct: 5 },
  { id: "MODERATE", label: "Moderate", icon: Target, desc: "Balanced approach. 5% position, 3% daily cap.", color: "amber", maxPositionPct: 5, maxDailyLossPct: 3, maxOpenPositions: 5, weeklyTargetPct: 10 },
  { id: "AGGRESSIVE", label: "Aggressive", icon: Zap, desc: "More trades, bigger positions. 10% position, 5% daily cap.", color: "red", maxPositionPct: 10, maxDailyLossPct: 5, maxOpenPositions: 10, weeklyTargetPct: 20 },
];

const TARGET_OPTIONS = [
  { pct: 5, label: "5%" },
  { pct: 10, label: "10%" },
  { pct: 15, label: "15%" },
  { pct: 20, label: "20%" },
  { pct: 25, label: "25%" },
];

function OnboardingFlow({ onComplete }: { onComplete: (config: TradingConfig) => void }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"PAPER" | "LIVE">("PAPER");
  const [paperBalance, setPaperBalance] = useState(10000);
  const [riskProfile, setRiskProfile] = useState("MODERATE");
  const [weeklyTargetPct, setWeeklyTargetPct] = useState(10);
  const [watchlist, setWatchlist] = useState<string[]>([...DEFAULT_WATCHLIST]);
  const [tickerInput, setTickerInput] = useState("");
  const [maxPositionPct, setMaxPositionPct] = useState(5);
  const [maxDailyLossPct, setMaxDailyLossPct] = useState(3);
  const [maxOpenPositions, setMaxOpenPositions] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const addTicker = () => {
    const t = tickerInput.trim().toUpperCase();
    if (t && !watchlist.includes(t)) setWatchlist([...watchlist, t]);
    setTickerInput("");
  };

  const removeTicker = (ticker: string) => setWatchlist(watchlist.filter((t) => t !== ticker));

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/trading/auto", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, mode, paperBalance, riskProfile, weeklyTargetPct, watchlist, maxPositionPct, maxDailyLossPct, maxOpenPositions }),
      });
      const config = await res.json();
      onComplete(config);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-3 justify-center mb-10 animate-fade-slide-up">
        {[0, 1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-3">
            <button
              onClick={() => { if (s < step) setStep(s); }}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                s === step
                  ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black scale-110 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                  : s < step
                    ? "bg-amber-500/15 text-amber-400 cursor-pointer hover:bg-amber-500/25"
                    : "bg-white/[0.04] text-white/20"
              }`}
            >
              {s < step ? "\u2713" : s + 1}
            </button>
            {s < 3 && (
              <div className={`w-12 h-px transition-all duration-500 ${s < step ? "bg-amber-500/30" : "bg-white/[0.06]"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Full-screen cinematic intro */}
      {step === 0 && (
        <div className="fixed inset-0 z-50 bg-black pilot-screen overflow-hidden">
          {/* Ambient gold particles */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="pilot-particle"
                style={{
                  left: `${5 + (i * 31) % 90}%`,
                  animationDelay: `${(i * 0.7) % 8}s`,
                  animationDuration: `${8 + (i % 6) * 2}s`,
                  width: `${1.5 + (i % 3)}px`,
                  height: `${1.5 + (i % 3)}px`,
                }}
              />
            ))}
          </div>

          {/* Central glow orb */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="pilot-glow-orb w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] rounded-full" />
          </div>

          {/* Concentric rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="pilot-ring pilot-ring-1" />
            <div className="pilot-ring pilot-ring-2" />
            <div className="pilot-ring pilot-ring-3" />
          </div>

          {/* Centered content — safe-area aware, scrollable on short viewports */}
          <div className="relative z-10 flex flex-col items-center justify-center min-h-full px-6 py-safe overflow-y-auto">
            <div className="flex flex-col items-center py-12 landscape:py-6">
              {/* Icon */}
              <div className="pilot-icon-reveal mb-5 sm:mb-8">
                <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl sm:rounded-3xl flex items-center justify-center relative">
                  <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-400/12 to-amber-600/4 border border-amber-500/20" />
                  <div className="absolute inset-0 rounded-2xl sm:rounded-3xl koshpilot-glow" />
                  <Navigation size={26} className="text-amber-400 relative z-10 sm:w-8 sm:h-8 md:w-9 md:h-9" />
                </div>
              </div>

              {/* Title */}
              <h1 className="pilot-title-reveal text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-bold tracking-tighter gold-gradient-text select-none pb-1">
                KoshPilot
              </h1>

              {/* Gold line */}
              <div className="pilot-line-expand h-px w-32 sm:w-40 md:w-56 my-4 sm:my-6 md:my-8 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

              {/* Tagline */}
              <p className="pilot-tagline-reveal text-sm sm:text-base md:text-xl text-white/40 font-light tracking-wide text-center max-w-xs sm:max-w-sm">
                Your AI co-pilot for the markets
              </p>

              {/* Features — minimal */}
              <div className="pilot-features-reveal flex items-center gap-3 sm:gap-4 md:gap-6 mt-5 sm:mt-8 text-[10px] sm:text-[11px] md:text-xs text-white/20 tracking-widest uppercase">
                <span>Scan</span>
                <span className="w-1 h-1 rounded-full bg-amber-500/30" />
                <span>Analyze</span>
                <span className="w-1 h-1 rounded-full bg-amber-500/30" />
                <span>Execute</span>
              </div>

              {/* CTA */}
              <div className="pilot-cta-reveal mt-8 sm:mt-12 md:mt-16 flex flex-col items-center gap-3 sm:gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-8 sm:px-10 md:px-14 py-3.5 sm:py-4 md:py-5 rounded-2xl font-semibold text-black koshpilot-btn flex items-center gap-2.5 sm:gap-3 text-sm sm:text-base md:text-lg"
                >
                  Get Started <ArrowRight size={18} className="sm:w-5 sm:h-5" />
                </button>
                <p className="text-[10px] sm:text-[11px] text-white/10 tracking-wide">Zero risk · Paper trading · Switch to live anytime</p>
              </div>
            </div>
          </div>

          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />
        </div>
      )}

      {/* Step 1: Mode */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center animate-fade-slide-up">
            <h2 className="text-2xl font-bold text-white tracking-tight">Choose Your Mode</h2>
            <p className="text-white/30 text-sm mt-1">Switch anytime from settings.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-slide-up-1">
            <button
              onClick={() => setMode("PAPER")}
              className={`text-left p-6 rounded-2xl border transition-all duration-300 ${
                mode === "PAPER"
                  ? "border-amber-500/30 bg-amber-500/[0.04] shadow-[0_0_40px_rgba(245,158,11,0.06)]"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.03]"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${mode === "PAPER" ? "bg-amber-500/10 border border-amber-500/20" : "bg-white/[0.04]"}`}>
                  <Plane size={20} className={mode === "PAPER" ? "text-amber-400" : "text-white/30"} />
                </div>
                {mode === "PAPER" && <Badge variant="gold">Recommended</Badge>}
              </div>
              <h3 className="text-white font-bold text-base mb-1">Simulation</h3>
              <p className="text-white/30 text-xs leading-relaxed">
                Practice with virtual capital. Zero risk. Real market performance.
              </p>
              <ul className="mt-4 space-y-2">
                {["No real capital at risk", "Real market data", "Track performance"].map((item) => (
                  <li key={item} className="text-xs text-white/35 flex items-center gap-2">
                    <div className={`w-1 h-1 rounded-full ${mode === "PAPER" ? "bg-amber-500" : "bg-white/20"}`} /> {item}
                  </li>
                ))}
              </ul>
            </button>

            <button
              onClick={() => setMode("LIVE")}
              className={`text-left p-6 rounded-2xl border transition-all duration-300 ${
                mode === "LIVE"
                  ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.03]"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${mode === "LIVE" ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-white/[0.04]"}`}>
                  <DollarSign size={20} className={mode === "LIVE" ? "text-emerald-400" : "text-white/30"} />
                </div>
                {mode === "LIVE" && <Badge variant="green">Advanced</Badge>}
              </div>
              <h3 className="text-white font-bold text-base mb-1">Live Trading</h3>
              <p className="text-white/30 text-xs leading-relaxed">
                Real money via Alpaca brokerage. Requires API keys.
              </p>
              <ul className="mt-4 space-y-2">
                {["Real execution", "Alpaca API required", "Start small"].map((item) => (
                  <li key={item} className="text-xs text-white/35 flex items-center gap-2">
                    <div className={`w-1 h-1 rounded-full ${mode === "LIVE" ? "bg-emerald-500" : "bg-white/20"}`} /> {item}
                  </li>
                ))}
              </ul>
            </button>
          </div>

          {mode === "LIVE" && (
            <div className="glass-card p-4 border-red-500/20 bg-red-500/[0.03] animate-fade-slide-up">
              <div className="flex gap-3">
                <Lock size={16} className="text-red-400/80 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300/90 text-sm font-medium">Not available yet</p>
                  <p className="text-white/20 text-xs mt-0.5">Complete 2 weeks of simulation first. Contact support to request access.</p>
                </div>
              </div>
            </div>
          )}

          {mode === "PAPER" && (
            <div className="glass-card p-5 space-y-4 animate-fade-slide-up-2">
              <div>
                <h3 className="text-sm font-semibold text-white/60">Starting Capital</h3>
                <p className="text-xs text-white/25 mt-0.5">How much virtual capital should KoshPilot trade with?</p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {BALANCE_OPTIONS.map(({ amount, label }) => (
                  <button
                    key={amount}
                    onClick={() => setPaperBalance(amount)}
                    className={`py-3 rounded-xl text-sm font-medium transition-all duration-300 flex flex-col items-center gap-0.5 ${
                      paperBalance === amount
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/25 shadow-[0_0_20px_rgba(245,158,11,0.08)]"
                        : "bg-white/[0.03] text-white/40 border border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="font-bold">${(amount / 1000).toFixed(0)}k</span>
                    <span className="text-[10px] opacity-50">{label}</span>
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-white/25 block mb-1.5">Custom amount</label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={paperBalance || ""}
                  onChange={(e) => setPaperBalance(Number(e.target.value))}
                  min={100}
                  max={1000000}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(0)}>
              <ArrowLeft size={16} /> Back
            </Button>
            <button
              className={`flex-1 py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all duration-300 text-sm ${
                mode === "LIVE" ? "bg-white/[0.04] text-white/20 cursor-not-allowed" : "koshpilot-btn text-black"
              }`}
              onClick={() => { if (mode !== "LIVE") setStep(2); }}
              disabled={mode === "LIVE"}
            >
              {mode === "LIVE" ? "Not Available" : <>Continue <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Risk Profile & Target */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center animate-fade-slide-up">
            <h2 className="text-2xl font-bold text-white tracking-tight">Risk & Target</h2>
            <p className="text-white/30 text-sm mt-1">How aggressive should KoshPilot trade?</p>
          </div>

          <div className="space-y-3 animate-fade-slide-up-1">
            {RISK_PROFILES.map((rp) => {
              const isSelected = riskProfile === rp.id;
              const Icon = rp.icon;
              const borderColor = rp.color === "emerald" ? "border-emerald-500/30" : rp.color === "amber" ? "border-amber-500/30" : "border-red-500/30";
              const bgColor = rp.color === "emerald" ? "bg-emerald-500/[0.04]" : rp.color === "amber" ? "bg-amber-500/[0.04]" : "bg-red-500/[0.04]";
              const iconBg = rp.color === "emerald" ? "bg-emerald-500/10 border-emerald-500/20" : rp.color === "amber" ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";
              const iconColor = rp.color === "emerald" ? "text-emerald-400" : rp.color === "amber" ? "text-amber-400" : "text-red-400";

              return (
                <button
                  key={rp.id}
                  onClick={() => {
                    setRiskProfile(rp.id);
                    setMaxPositionPct(rp.maxPositionPct);
                    setMaxDailyLossPct(rp.maxDailyLossPct);
                    setMaxOpenPositions(rp.maxOpenPositions);
                    setWeeklyTargetPct(rp.weeklyTargetPct);
                  }}
                  className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all duration-300 ${
                    isSelected ? `${borderColor} ${bgColor}` : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? `${iconBg} border` : "bg-white/[0.04]"}`}>
                      <Icon size={20} className={isSelected ? iconColor : "text-white/30"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-bold text-sm">{rp.label}</h3>
                        {isSelected && rp.id === "MODERATE" && <Badge variant="gold">Default</Badge>}
                      </div>
                      <p className="text-white/30 text-xs mt-0.5 leading-relaxed">{rp.desc}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${
                      isSelected ? `${borderColor.replace("30", "50")}` : "border-white/10"
                    }`}>
                      {isSelected && <div className={`w-2.5 h-2.5 rounded-full ${
                        rp.color === "emerald" ? "bg-emerald-400" : rp.color === "amber" ? "bg-amber-400" : "bg-red-400"
                      }`} />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="glass-card p-5 space-y-4 animate-fade-slide-up-2">
            <div>
              <h3 className="text-sm font-semibold text-white/60">Weekly Profit Target</h3>
              <p className="text-xs text-white/25 mt-0.5">What return should KoshPilot aim for each week?</p>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {TARGET_OPTIONS.map(({ pct, label }) => (
                <button
                  key={pct}
                  onClick={() => setWeeklyTargetPct(pct)}
                  className={`py-3 rounded-xl text-sm font-medium transition-all duration-300 flex flex-col items-center gap-0.5 ${
                    weeklyTargetPct === pct
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/25 shadow-[0_0_20px_rgba(245,158,11,0.08)]"
                      : "bg-white/[0.03] text-white/40 border border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="font-bold">{label}</span>
                  <span className="text-[10px] opacity-50">${((paperBalance * pct) / 100).toFixed(0)}/wk</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-white/15 text-center">AI performance varies. This sets a goal, not a guarantee.</p>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Back
            </Button>
            <button className="flex-1 py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all duration-300 text-sm koshpilot-btn text-black" onClick={() => setStep(3)}>
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Configure */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="text-center animate-fade-slide-up">
            <h2 className="text-2xl font-bold text-white tracking-tight">Configure</h2>
            <p className="text-white/30 text-sm mt-1">Set preferences. Change anytime.</p>
          </div>

          <div className="glass-card p-5 space-y-3 animate-fade-slide-up-1">
            <h3 className="text-sm font-semibold text-white/50">Watchlist ({watchlist.length})</h3>
            <div className="flex flex-wrap gap-2">
              {watchlist.map((ticker) => (
                <span key={ticker} className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white/80">
                  <StockLogo ticker={ticker} size={16} />
                  {ticker}
                  <button onClick={() => removeTicker(ticker)} className="text-white/20 hover:text-red-400 transition-colors ml-0.5">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Add ticker (e.g. AAPL)"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTicker(); } }}
                className="flex-1"
              />
              <Button size="sm" variant="secondary" onClick={addTicker} disabled={!tickerInput.trim()}>
                <Plus size={14} /> Add
              </Button>
            </div>
          </div>

          <div className="glass-card p-5 space-y-4 animate-fade-slide-up-2">
            <h3 className="text-sm font-semibold text-white/50">Risk Management</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-white/30 block mb-1.5">Max Position Size</label>
                <select
                  value={maxPositionPct}
                  onChange={(e) => setMaxPositionPct(Number(e.target.value))}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/30"
                >
                  {[2, 3, 5, 8, 10].map((v) => <option key={v} value={v}>{v}% per trade</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/30 block mb-1.5">Daily Loss Limit</label>
                <select
                  value={maxDailyLossPct}
                  onChange={(e) => setMaxDailyLossPct(Number(e.target.value))}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/30"
                >
                  {[1, 2, 3, 5].map((v) => <option key={v} value={v}>{v}% max/day</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/30 block mb-1.5">Max Positions</label>
                <select
                  value={maxOpenPositions}
                  onChange={(e) => setMaxOpenPositions(Number(e.target.value))}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/30"
                >
                  {[3, 5, 8, 10].map((v) => <option key={v} value={v}>{v} positions</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="glass-card-gold p-4 animate-fade-slide-up-3">
            <div className="flex items-start gap-3">
              <Navigation size={16} className="text-amber-400/80 shrink-0 mt-0.5" />
              <div className="text-xs text-white/35 space-y-0.5">
                <p><span className="text-amber-300/80 font-medium">Mode:</span> Simulation</p>
                <p><span className="text-amber-300/80 font-medium">Capital:</span> ${paperBalance.toLocaleString()}</p>
                <p><span className="text-amber-300/80 font-medium">Profile:</span> {riskProfile.charAt(0) + riskProfile.slice(1).toLowerCase()}</p>
                <p><span className="text-amber-300/80 font-medium">Target:</span> {weeklyTargetPct}% weekly (${((paperBalance * weeklyTargetPct) / 100).toFixed(0)}/wk)</p>
                <p><span className="text-amber-300/80 font-medium">Watching:</span> {watchlist.length} stocks</p>
                <p><span className="text-amber-300/80 font-medium">Risk:</span> {maxPositionPct}% max, {maxDailyLossPct}% daily cap, {maxOpenPositions} positions</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>
              <ArrowLeft size={16} /> Back
            </Button>
            <button
              className="flex-1 py-3.5 rounded-2xl font-semibold koshpilot-btn text-black flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              onClick={handleFinish}
              disabled={submitting || watchlist.length === 0}
            >
              {submitting ? <RefreshCw size={16} className="animate-spin" /> : <><Navigation size={16} /> Launch KoshPilot</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PilotSplash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3200);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 bg-black pilot-screen overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="pilot-particle"
            style={{
              left: `${5 + (i * 31) % 90}%`,
              animationDelay: `${(i * 0.5) % 6}s`,
              animationDuration: `${7 + (i % 5) * 2}s`,
              width: `${1.5 + (i % 3)}px`,
              height: `${1.5 + (i % 3)}px`,
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="pilot-glow-orb w-[280px] h-[280px] sm:w-[420px] sm:h-[420px] rounded-full" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="pilot-ring pilot-ring-1" />
        <div className="pilot-ring pilot-ring-2" />
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6">
        <div className="pilot-icon-reveal mb-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400/12 to-amber-600/4 border border-amber-500/20" />
            <div className="absolute inset-0 rounded-2xl koshpilot-glow" />
            <Navigation size={24} className="text-amber-400 relative z-10 sm:w-7 sm:h-7" />
          </div>
        </div>
        <h1 className="pilot-title-reveal text-4xl sm:text-6xl font-bold tracking-tighter gold-gradient-text select-none">
          KoshPilot
        </h1>
        <div className="pilot-line-expand h-px w-24 sm:w-32 my-4 bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
        <div className="pilot-features-reveal flex items-center gap-3 text-[10px] sm:text-[11px] text-white/15 tracking-widest uppercase">
          <span>Scan</span>
          <span className="w-0.5 h-0.5 rounded-full bg-amber-500/30" />
          <span>Analyze</span>
          <span className="w-0.5 h-0.5 rounded-full bg-amber-500/30" />
          <span>Execute</span>
        </div>
      </div>
      <button onClick={onDone} className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 text-[10px] text-white/10 hover:text-white/30 transition-colors tracking-widest uppercase pilot-cta-reveal">
        Skip
      </button>
    </div>
  );
}

function ConvictionRing({ score, size = 36 }: { score: number; size?: number }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 60 ? "#34d399" : pct >= 35 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={3} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <span className="absolute text-[9px] font-bold tabular-nums" style={{ color }}>{pct}</span>
    </div>
  );
}

function MiniRadar({ indicators }: { indicators: SignalIndicator[] }) {
  const dims = indicators.slice(0, 7);
  if (dims.length < 3) return null;

  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 48;
  const levels = 3;

  const angleStep = (2 * Math.PI) / dims.length;

  const gridPoints = (level: number) =>
    dims.map((_, i) => {
      const r = (maxR / levels) * (level + 1);
      const angle = i * angleStep - Math.PI / 2;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");

  const dataPoints = dims.map((d, i) => {
    const val = Math.max(0, Math.min(100, Math.abs(d.score)));
    const r = (val / 100) * maxR;
    const angle = i * angleStep - Math.PI / 2;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(" ");

  const labelPositions = dims.map((d, i) => {
    const r = maxR + 14;
    const angle = i * angleStep - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), label: d.name };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {Array.from({ length: levels }).map((_, l) => (
        <polygon key={l} points={gridPoints(l)} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
      ))}
      {dims.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        return (
          <line key={i} x1={cx} y1={cy}
            x2={cx + maxR * Math.cos(angle)} y2={cy + maxR * Math.sin(angle)}
            stroke="rgba(255,255,255,0.04)" strokeWidth={0.5}
          />
        );
      })}
      <polygon points={dataPoints} fill="rgba(52,211,153,0.08)" stroke="rgba(52,211,153,0.5)" strokeWidth={1.5} />
      {labelPositions.map((lp, i) => (
        <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central"
          fill="rgba(255,255,255,0.25)" fontSize={7} fontWeight={500}>
          {lp.label.length > 6 ? lp.label.slice(0, 6) : lp.label}
        </text>
      ))}
    </svg>
  );
}

function SignalCard({ signal, defaultExpanded = false }: { signal: ScannedSignal; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isPositive = signal.score > 0;
  const isBuy = signal.action === "BUY" || signal.action === "STRONG_BUY";
  const isTraded = signal.decision === "TRADED";
  const isAddOn = signal.decision === "ADD_ON";
  const isSkipped = signal.decision === "SKIPPED";
  const hasConviction = signal.convictionScore != null && signal.convictionScore > 0;

  return (
    <div
      className={`rounded-xl border transition-all duration-300 cursor-pointer ${
        isTraded || isAddOn
          ? "border-emerald-500/20 bg-emerald-500/[0.03]"
          : expanded ? "border-white/[0.08] bg-white/[0.03]" : "border-white/[0.04] bg-white/[0.015] hover:border-white/[0.08]"
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-3 sm:p-4 flex items-center gap-3">
        <StockLogo ticker={signal.ticker} size={28} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/90 font-bold text-xs">{signal.ticker}</span>
            <Badge variant={isBuy ? "green" : signal.action === "HOLD" ? "gold" : signal.action === "SELL" || signal.action === "STRONG_SELL" ? "red" : "gray"}>
              {signal.action}
            </Badge>
            {isTraded && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-500/15 text-emerald-400/90 border border-emerald-500/25">
                EXECUTED
              </span>
            )}
            {isAddOn && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-blue-500/15 text-blue-400/90 border border-blue-500/25">
                ADD-ON
              </span>
            )}
            {isSkipped && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-500/10 text-amber-400/70 border border-amber-500/15">
                SKIPPED
              </span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              signal.source === "discovered"
                ? "bg-purple-500/10 text-purple-400/80 border border-purple-500/20"
                : "bg-white/[0.04] text-white/30"
            }`}>
              {signal.source === "discovered" ? "Discovered" : "Watchlist"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/25">
            <span>${signal.price.toFixed(2)}</span>
            <span>{signal.strategy}</span>
          </div>
          {isSkipped && signal.decisionReason && (
            <p className="text-[10px] text-amber-400/50 mt-1 leading-snug">{signal.decisionReason}</p>
          )}
          {isTraded && signal.decisionReason && (
            <p className="text-[10px] text-emerald-400/60 mt-1 leading-snug">{signal.decisionReason}</p>
          )}
          {isAddOn && signal.decisionReason && (
            <p className="text-[10px] text-blue-400/60 mt-1 leading-snug">{signal.decisionReason}</p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {hasConviction ? (
            <ConvictionRing score={signal.convictionScore!} />
          ) : (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, j) => (
                <div
                  key={j}
                  className={`w-1 h-3 rounded-sm ${
                    j < Math.ceil(Math.abs(signal.score) / 10)
                      ? isPositive ? "bg-emerald-400/60" : "bg-red-400/60"
                      : "bg-white/[0.06]"
                  }`}
                />
              ))}
            </div>
          )}
          {expanded ? <ChevronUp size={12} className="text-white/20" /> : <ChevronDown size={12} className="text-white/20" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0 border-t border-white/[0.04] space-y-3 animate-fade-slide-up">
          {signal.discoveryReason && (
            <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-purple-500/[0.04] border border-purple-500/10">
              <Radar size={12} className="text-purple-400/70 shrink-0 mt-0.5" />
              <p className="text-[10px] text-purple-300/60 leading-relaxed">{signal.discoveryReason}</p>
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] text-white/25 uppercase tracking-wider font-semibold">Signal Breakdown</p>
              {signal.indicators.map((ind) => {
                const pct = Math.min(100, Math.abs(ind.score));
                return (
                  <div key={ind.name} className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30 w-16 shrink-0 text-right font-medium">{ind.name}</span>
                    <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          ind.score > 20 ? "bg-emerald-400/60" : ind.score > 0 ? "bg-emerald-400/30" : ind.score > -20 ? "bg-red-400/30" : "bg-red-400/60"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-[10px] w-8 text-right font-mono ${ind.score > 0 ? "text-emerald-400/50" : ind.score < 0 ? "text-red-400/50" : "text-white/20"}`}>
                      {ind.score > 0 ? "+" : ""}{ind.score.toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>

            {signal.indicators.length >= 3 && (
              <div className="flex flex-col items-center justify-center">
                <MiniRadar indicators={signal.indicators} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-[10px] text-white/20 pt-1">
            <span className="text-white/15">Reason:</span>
            {signal.indicators.filter((i) => Math.abs(i.score) > 10).slice(0, 3).map((i) => (
              <span key={i.name} className="text-white/30">{i.reason}</span>
            ))}
          </div>

          {signal.stopLoss > 0 && signal.takeProfit > 0 && (
            <div className="flex items-center gap-4 text-[10px] pt-1">
              <span className="text-red-400/40">SL ${signal.stopLoss.toFixed(2)}</span>
              <span className="text-white/15">→</span>
              <span className="text-emerald-400/40">TP ${signal.takeProfit.toFixed(2)}</span>
              <span className="text-white/15">R:R {((signal.takeProfit - signal.price) / (signal.price - signal.stopLoss)).toFixed(1)}x</span>
            </div>
          )}

          {hasConviction && (
            <div className="pt-2 border-t border-white/[0.04] flex items-center gap-3">
              <ConvictionRing score={signal.convictionScore!} size={28} />
              <div>
                <p className="text-[10px] font-semibold text-white/40">Kosh Conviction</p>
                <p className="text-[9px] text-white/20">7-dimension score: signal diversity, technical, fundamental, valuation, smart money, catalyst, risk</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MissionReport({ result, onClose }: { result: RunResult; onClose: () => void }) {
  const [showAllSignals, setShowAllSignals] = useState(false);
  const [filterSource, setFilterSource] = useState<"all" | "watchlist" | "discovered">("all");
  const [filterDecision, setFilterDecision] = useState<"all" | "traded" | "skipped">("all");

  if (result.status === "ERROR") {
    return (
      <div className="glass-card p-5 border-red-500/15 animate-scale-in">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-400/80 shrink-0 mt-0.5" />
          <p className="text-red-300/80 text-xs flex-1">{result.reason || result.error}</p>
          <button onClick={onClose} className="text-white/15 hover:text-white/40 shrink-0"><X size={14} /></button>
        </div>
      </div>
    );
  }

  if (result.status === "SKIPPED") {
    return (
      <div className="glass-card p-5 border-amber-500/15 animate-scale-in">
        <div className="flex items-start gap-3">
          <Clock size={16} className="text-amber-400/80 shrink-0 mt-0.5" />
          <p className="text-amber-300/80 text-xs flex-1">{result.reason}</p>
          <button onClick={onClose} className="text-white/15 hover:text-white/40 shrink-0"><X size={14} /></button>
        </div>
      </div>
    );
  }

  const signals = result.allSignals || [];
  const watchlistSignals = signals.filter((s) => s.source === "watchlist");
  const discoveredSignals = signals.filter((s) => s.source === "discovered");
  const tradedSignals = signals.filter((s) => s.decision === "TRADED" || s.decision === "ADD_ON");
  const skippedSignals = signals.filter((s) => s.decision === "SKIPPED");

  let filteredSignals = filterSource === "all" ? signals : filterSource === "watchlist" ? watchlistSignals : discoveredSignals;
  if (filterDecision === "traded") filteredSignals = filteredSignals.filter((s) => s.decision === "TRADED" || s.decision === "ADD_ON");
  else if (filterDecision === "skipped") filteredSignals = filteredSignals.filter((s) => s.decision === "SKIPPED");
  const shownSignals = showAllSignals ? filteredSignals : filteredSignals.slice(0, 8);

  return (
    <div className="glass-card p-5 border-amber-500/15 animate-scale-in space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation size={16} className="text-amber-400/80" />
          <p className="text-amber-300/90 font-semibold text-xs uppercase tracking-wider">Mission Report</p>
        </div>
        <button onClick={onClose} className="text-white/15 hover:text-white/40 transition-colors"><X size={14} /></button>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {[
          { icon: Search, val: result.scanned || 0, label: "scanned", color: "text-amber-400/70" },
          { icon: Radar, val: discoveredSignals.length, label: "discovered", color: "text-purple-400/70" },
          { icon: Brain, val: result.signalsFound || 0, label: "signals", color: "text-amber-400/70" },
          { icon: TrendingUp, val: result.tradesExecuted || 0, label: "trades", color: "text-emerald-400/70" },
          ...(result.exitsExecuted ? [{ icon: DollarSign, val: result.exitsExecuted, label: "exits", color: "text-white/40" }] : []),
        ].map(({ icon: Icon, val, label, color }) => (
          <span key={label} className="flex items-center gap-1.5 bg-white/[0.03] rounded-lg px-3 py-1.5 text-xs">
            <Icon size={12} className={color} />
            <span className="text-white/80 font-semibold">{val}</span>
            <span className="text-white/25">{label}</span>
          </span>
        ))}
      </div>

      {/* Sentiment context */}
      {result.details?.find((d: any) => d.action === "SENTIMENT") && (() => {
        const sd = result.details.find((d: any) => d.action === "SENTIMENT");
        const sentimentScore = sd?.score ?? 50;
        const sentimentColor = sentimentScore <= 20 ? "text-red-400" : sentimentScore <= 40 ? "text-orange-400" : sentimentScore <= 60 ? "text-yellow-400" : sentimentScore <= 80 ? "text-lime-400" : "text-emerald-400";
        const sentimentBg = sentimentScore <= 20 ? "bg-red-500/8 border-red-500/15" : sentimentScore <= 40 ? "bg-orange-500/8 border-orange-500/15" : sentimentScore <= 60 ? "bg-yellow-500/8 border-yellow-500/15" : sentimentScore <= 80 ? "bg-lime-500/8 border-lime-500/15" : "bg-emerald-500/8 border-emerald-500/15";
        return (
          <div className={`rounded-xl p-3 border ${sentimentBg}`}>
            <div className="flex items-center gap-2 mb-1">
              <Activity size={12} className={sentimentColor} />
              <span className={`text-xs font-semibold ${sentimentColor}`}>Market Conditions</span>
              <span className="text-xs text-white/40 font-mono">{sentimentScore}/100</span>
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">{sd?.reason}</p>
          </div>
        );
      })()}

      {/* Trade actions summary */}
      {result.details && result.details.filter((d: any) => d.action !== "SENTIMENT").length > 0 && (
        <div className="space-y-1 pt-1 border-t border-white/[0.04]">
          <p className="text-[10px] text-white/20 uppercase tracking-wider font-semibold pt-2">Actions Taken</p>
          {result.details.filter((d: any) => d.action !== "SENTIMENT").map((d: any, i: number) => (
            <div key={i} className="text-xs text-white/30 flex items-center gap-2">
              <Badge variant={d.action === "BUY" || d.action === "ADD_ON" ? "green" : d.action === "SELL" ? "red" : "gray"}>
                {d.action}
              </Badge>
              <span className="text-white/70 font-medium">{d.ticker}</span>
              {d.qty && <span>{d.qty} @ ${d.price?.toFixed(2)}</span>}
              {d.pnl != null && <span className={d.pnl >= 0 ? "text-emerald-400/60" : "text-red-400/60"}>{d.pnl >= 0 ? "+" : ""}${d.pnl.toFixed(2)}</span>}
              {d.reason && <span className="text-white/15 truncate">— {d.reason}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Signal breakdown */}
      {signals.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-white/[0.04]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/20 uppercase tracking-wider font-semibold pt-1">
                All Signals Analyzed ({filteredSignals.length})
              </p>
              <div className="flex items-center gap-1">
                {([
                  { id: "all", label: "All", count: signals.length },
                  { id: "watchlist", label: "Watchlist", count: watchlistSignals.length },
                  { id: "discovered", label: "Discovered", count: discoveredSignals.length },
                ] as const).map(({ id, label, count }) => (
                  <button
                    key={id}
                    onClick={(e) => { e.stopPropagation(); setFilterSource(id); }}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                      filterSource === id
                        ? id === "discovered" ? "bg-purple-500/15 text-purple-400/80 border border-purple-500/20"
                          : "bg-amber-500/10 text-amber-400/80 border border-amber-500/20"
                        : "bg-white/[0.03] text-white/25 border border-white/[0.04] hover:border-white/[0.08]"
                    }`}
                  >
                    {label} ({count})
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {([
                { id: "all" as const, label: "All Decisions", count: signals.length },
                { id: "traded" as const, label: "Executed", count: tradedSignals.length },
                { id: "skipped" as const, label: "Skipped", count: skippedSignals.length },
              ]).map(({ id, label, count }) => (
                <button
                  key={id}
                  onClick={(e) => { e.stopPropagation(); setFilterDecision(id); }}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                    filterDecision === id
                      ? id === "traded" ? "bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20"
                        : id === "skipped" ? "bg-amber-500/10 text-amber-400/80 border border-amber-500/20"
                        : "bg-amber-500/10 text-amber-400/80 border border-amber-500/20"
                      : "bg-white/[0.03] text-white/25 border border-white/[0.04] hover:border-white/[0.08]"
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {shownSignals.map((signal, i) => (
              <SignalCard key={`${signal.ticker}-${i}`} signal={signal} defaultExpanded={i === 0} />
            ))}
          </div>

          {filteredSignals.length > 8 && (
            <button
              onClick={() => setShowAllSignals(!showAllSignals)}
              className="text-xs text-white/25 hover:text-amber-400/60 transition-colors flex items-center gap-1 mx-auto"
            >
              {showAllSignals ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {filteredSignals.length} signals</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const DISCOVERY_SOURCES = {
  screener: { icon: Radar, label: "Screener", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  news: { icon: Newspaper, label: "News", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  congress: { icon: Landmark, label: "Congress", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  insider: { icon: Users, label: "Insider", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  earnings: { icon: CalendarDays, label: "Earnings", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
} as const;

function DiscoveriesSection({ discoveries }: { discoveries: DiscoveredTicker[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!discoveries || discoveries.length === 0) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/8 border border-amber-500/15 flex items-center justify-center">
            <Radar size={18} className="text-amber-400/60" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/60">Market Discovery</h3>
            <p className="text-xs text-white/20 mt-0.5">Run KoshPilot to discover opportunities from news, insiders, congress & screeners</p>
          </div>
        </div>
      </div>
    );
  }

  const shown = expanded ? discoveries : discoveries.slice(0, 5);
  const sourceCounts = discoveries.reduce((acc, d) => {
    acc[d.source] = (acc[d.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="glass-card p-5 space-y-4 animate-fade-slide-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar size={14} className="text-amber-400/70" />
          <h3 className="text-sm font-semibold text-white/60">Discoveries</h3>
          <span className="text-[10px] text-amber-400/50 bg-amber-500/[0.06] px-2 py-0.5 rounded-md font-medium">
            {discoveries.length} found
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {Object.entries(sourceCounts).map(([source, count]) => {
            const config = DISCOVERY_SOURCES[source as keyof typeof DISCOVERY_SOURCES];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <span key={source} className={`inline-flex items-center gap-1 ${config.bg} border rounded-md px-1.5 py-0.5 text-[10px] ${config.color}`}>
                <Icon size={10} /> {count}
              </span>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {shown.map((d, i) => {
          const config = DISCOVERY_SOURCES[d.source];
          const Icon = config?.icon || Search;
          return (
            <div
              key={`${d.ticker}-${i}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all"
            >
              <StockLogo ticker={d.ticker} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white/80 font-bold text-xs">{d.ticker}</span>
                  <span className={`inline-flex items-center gap-1 ${config?.bg || ""} border rounded px-1.5 py-0.5 text-[9px] font-medium ${config?.color || "text-white/40"}`}>
                    <Icon size={9} /> {config?.label || d.source}
                  </span>
                  {d.urgency >= 9 && (
                    <span className="text-[9px] text-red-400/70 bg-red-500/[0.06] px-1.5 py-0.5 rounded font-medium">
                      High Priority
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-white/25 mt-0.5 truncate">{d.reason}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div
                      key={j}
                      className={`w-1 h-3 rounded-sm ${j < Math.ceil(d.urgency / 2) ? "bg-amber-400/60" : "bg-white/[0.06]"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {discoveries.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-white/25 hover:text-amber-400/60 transition-colors flex items-center gap-1 mx-auto"
        >
          {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {discoveries.length}</>}
        </button>
      )}
    </div>
  );
}

interface EquityPoint { date: string; equity: number; }

function LiveUptime({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    const start = new Date(since).getTime();
    const tick = () => {
      const diff = Date.now() - start;
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setElapsed(`${d}d ${h}h ${m}m`);
      else if (h > 0) setElapsed(`${h}h ${m}m ${s}s`);
      else setElapsed(`${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [since]);
  return <span className="tabular-nums">{elapsed}</span>;
}

interface AccuracyData {
  window: string;
  totalTrades: number;
  winners: number;
  losers: number;
  winRate: number;
  totalPnl: number;
  avgReturn: number;
  bestPick: { ticker: string; pnl: number } | null;
  worstPick: { ticker: string; pnl: number } | null;
  strategyBreakdown: Array<{ strategy: string; wins: number; losses: number; pnl: number; winRate: number }>;
  recentTrades: Array<{ ticker: string; pnl: number; strategy: string | null; exitAt: string | null }>;
}

function AccuracyPanel() {
  const [window, setWindow] = useState<"week" | "month" | "year">("month");
  const [data, setData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchAccuracy = useCallback(async (w: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trading/auto?action=accuracy&window=${w}`);
      const json = await res.json();
      setData(json);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAccuracy(window);
  }, [window, fetchAccuracy]);

  if (!data && !loading) return null;

  return (
    <div className="glass-card border border-white/[0.04] animate-fade-slide-up">
      <button onClick={() => setExpanded(!expanded)} className="w-full p-4 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-indigo-400/70" />
            <h3 className="text-sm font-semibold text-white/70">Prediction Accuracy</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5 p-0.5 bg-white/[0.03] rounded-lg" onClick={(e) => e.stopPropagation()}>
              {(["week", "month", "year"] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setWindow(w)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    window === w ? "bg-white/[0.08] text-white" : "text-white/25 hover:text-white/50"
                  }`}
                >
                  {w === "week" ? "7D" : w === "month" ? "30D" : "1Y"}
                </button>
              ))}
            </div>
            <ChevronDown size={14} className={`text-white/20 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </div>
        </div>

        {data && (
          <div className="grid grid-cols-4 gap-4 mt-3">
            <div>
              <p className={`text-lg font-black ${data.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                {data.winRate}%
              </p>
              <p className="text-[10px] text-white/20">Win Rate</p>
            </div>
            <div>
              <p className={`text-lg font-black ${data.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {data.totalPnl >= 0 ? "+" : ""}${Math.abs(data.totalPnl).toFixed(0)}
              </p>
              <p className="text-[10px] text-white/20">Total PnL</p>
            </div>
            <div>
              <p className={`text-lg font-black ${data.avgReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {data.avgReturn >= 0 ? "+" : ""}${data.avgReturn.toFixed(2)}
              </p>
              <p className="text-[10px] text-white/20">Avg / Trade</p>
            </div>
            <div>
              <p className="text-lg font-black text-white">
                {data.totalTrades}
              </p>
              <p className="text-[10px] text-white/20">Trades</p>
            </div>
          </div>
        )}
      </button>

      {expanded && data && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/[0.04] pt-3">
          {/* Win / Loss bar */}
          {data.totalTrades > 0 && (
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-emerald-400/60">{data.winners}W</span>
                <span className="text-red-400/60">{data.losers}L</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.03]">
                <div className="bg-emerald-400/60 transition-all" style={{ width: `${(data.winners / data.totalTrades) * 100}%` }} />
                <div className="bg-red-400/60 transition-all" style={{ width: `${(data.losers / data.totalTrades) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Best / Worst */}
          <div className="grid grid-cols-2 gap-3">
            {data.bestPick && (
              <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10">
                <p className="text-[10px] text-emerald-400/50">Best Pick</p>
                <div className="flex items-center gap-2 mt-1">
                  <StockLogo ticker={data.bestPick.ticker} size={20} />
                  <span className="text-sm font-bold text-white">{data.bestPick.ticker}</span>
                  <span className="text-xs text-emerald-400 font-semibold ml-auto">+${data.bestPick.pnl.toFixed(2)}</span>
                </div>
              </div>
            )}
            {data.worstPick && (
              <div className="bg-red-500/5 rounded-xl p-3 border border-red-500/10">
                <p className="text-[10px] text-red-400/50">Worst Pick</p>
                <div className="flex items-center gap-2 mt-1">
                  <StockLogo ticker={data.worstPick.ticker} size={20} />
                  <span className="text-sm font-bold text-white">{data.worstPick.ticker}</span>
                  <span className="text-xs text-red-400 font-semibold ml-auto">${data.worstPick.pnl.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Strategy breakdown */}
          {data.strategyBreakdown.length > 0 && (
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">By Strategy</p>
              <div className="space-y-1.5">
                {data.strategyBreakdown.map((s) => (
                  <div key={s.strategy} className="flex items-center justify-between text-xs">
                    <span className="text-white/40">{s.strategy}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-white/20">{s.wins}W / {s.losses}L</span>
                      <span className={`font-semibold ${s.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {s.pnl >= 0 ? "+" : ""}${s.pnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.totalTrades === 0 && (
            <p className="text-center text-white/20 text-xs py-4">No closed trades in this period</p>
          )}
        </div>
      )}
    </div>
  );
}

function CronStatusBar({ cronStatus, enabled, createdAt, onRefresh }: {
  cronStatus: CronStatus | null; enabled: boolean; createdAt?: string; onRefresh: () => void;
}) {
  if (!cronStatus || !cronStatus.configured) return null;

  const statusConfig = {
    active: { color: "emerald", label: "Active", glow: "shadow-emerald-500/20 shadow-sm" },
    sleeping: { color: "blue", label: "Sleeping — Market Closed", glow: "shadow-blue-500/10" },
    stale: { color: "amber", label: "Delayed", glow: "shadow-amber-500/10" },
    inactive: { color: "red", label: "Not Running", glow: "" },
  };
  const s = statusConfig[cronStatus.status];

  const formatAgo = (mins: number | null) => {
    if (mins == null) return "Never";
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const nextRun = () => {
    if (cronStatus.status === "inactive") return "Not scheduled";
    if (cronStatus.status === "sleeping") return "Next market open";
    if (cronStatus.minutesAgo == null) return "Pending first run";
    return "~:45 next hour";
  };

  const colorMap: Record<string, { dot: string; label: string; border: string }> = {
    emerald: { dot: "bg-emerald-400", label: "text-emerald-400", border: "border-emerald-500/15" },
    blue: { dot: "bg-blue-400", label: "text-blue-400", border: "border-blue-500/15" },
    amber: { dot: "bg-amber-400", label: "text-amber-400", border: "border-amber-500/15" },
    red: { dot: "bg-red-400", label: "text-red-400", border: "border-red-500/15" },
  };
  const c = colorMap[s.color];

  return (
    <div className={`glass-card p-4 ${s.glow} ${c.border} border animate-fade-slide-up`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {(cronStatus.status === "active" || (cronStatus.status === "sleeping" && enabled)) && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c.dot} opacity-50`} />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${c.dot}`} />
            </span>
            <span className={`text-xs font-semibold ${c.label}`}>Autopilot {s.label}</span>
          </div>

          {enabled && createdAt && (
            <>
              <span className="text-white/10 text-[10px]">|</span>
              <div className="flex items-center gap-1.5">
                <Zap size={10} className="text-emerald-400/50" />
                <span className="text-[10px] text-emerald-400/60 font-medium">
                  Running for <LiveUptime since={createdAt} />
                </span>
              </div>
            </>
          )}

          <span className="text-white/10 text-[10px]">|</span>
          <div className="flex items-center gap-1.5">
            <Clock size={10} className="text-white/20" />
            <span className="text-[10px] text-white/35">
              Last: <span className="text-white/55 font-medium">{formatAgo(cronStatus.minutesAgo)}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Radio size={10} className="text-white/20" />
            <span className="text-[10px] text-white/35">
              Next: <span className="text-white/55 font-medium">{nextRun()}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {cronStatus.totalRuns > 0 && (
            <div className="flex items-center gap-3 text-[10px] text-white/25">
              <span>
                <span className="text-white/45 font-medium">{cronStatus.totalRuns}</span> runs
              </span>
              <span className="text-white/10">|</span>
              <span>
                Last scan: <span className="text-white/45 font-medium">{cronStatus.lastSignals}</span> signals
                {cronStatus.lastTrades > 0 && (
                  <>, <span className="text-amber-400/70 font-medium">{cronStatus.lastTrades}</span> trades</>
                )}
              </span>
            </div>
          )}
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-white/25 hover:text-white/50 transition-all"
            title="Refresh cron status"
          >
            <RefreshCw size={10} />
          </button>
        </div>
      </div>
      {cronStatus.lastResult && cronStatus.lastResult.startsWith("ERROR") && (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-red-400/60">
          <AlertTriangle size={10} />
          <span className="truncate">{cronStatus.lastResult}</span>
        </div>
      )}
    </div>
  );
}

function EquityChart({ points, paperBalance, liveEquity }: { points: EquityPoint[]; paperBalance: number; liveEquity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; value: number } | null>(null);

  const displayPoints = useMemo(() => {
    const pts = [...points];
    if (liveEquity != null) {
      const now = new Date().toISOString().slice(0, 10);
      const lastIdx = pts.findIndex((p) => p.date === now);
      if (lastIdx >= 0) {
        pts[lastIdx] = { date: now, equity: Math.round(liveEquity * 100) / 100 };
      } else {
        pts.push({ date: now, equity: Math.round(liveEquity * 100) / 100 });
      }
    }
    return pts;
  }, [points, liveEquity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || displayPoints.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const pad = { top: 20, right: 12, bottom: 28, left: 52 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    const vals = displayPoints.map((p) => p.equity);
    const minVal = Math.min(...vals, paperBalance) * 0.998;
    const maxVal = Math.max(...vals, paperBalance) * 1.002;
    const range = maxVal - minVal || 1;

    const xStep = cw / (displayPoints.length - 1);

    const toX = (i: number) => pad.left + i * xStep;
    const toY = (v: number) => pad.top + ch - ((v - minVal) / range) * ch;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + (ch / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      const val = maxVal - (range / gridLines) * i;
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(`$${val.toFixed(0)}`, pad.left - 6, y + 3);
    }

    const baseY = toY(paperBalance);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(pad.left, baseY);
    ctx.lineTo(w - pad.right, baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    const lastVal = vals[vals.length - 1];
    const isUp = lastVal >= paperBalance;
    const lineColor = isUp ? "#34d399" : "#f87171";
    const gradTop = isUp ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)";

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(vals[0]));
    for (let i = 1; i < displayPoints.length; i++) {
      const xm = (toX(i - 1) + toX(i)) / 2;
      ctx.bezierCurveTo(xm, toY(vals[i - 1]), xm, toY(vals[i]), toX(i), toY(vals[i]));
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
    grad.addColorStop(0, gradTop);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.lineTo(toX(displayPoints.length - 1), pad.top + ch);
    ctx.lineTo(toX(0), pad.top + ch);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    const labelCount = Math.min(5, displayPoints.length);
    const labelStep = Math.max(1, Math.floor((displayPoints.length - 1) / (labelCount - 1)));
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = "9px system-ui";
    ctx.textAlign = "center";
    for (let i = 0; i < displayPoints.length; i += labelStep) {
      const d = new Date(displayPoints[i].date);
      ctx.fillText(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), toX(i), h - 6);
    }

    const lastX = toX(displayPoints.length - 1);
    const lastY = toY(lastVal);

    if (liveEquity != null) {
      const pulseRadius = 10;
      const pulseGrad = ctx.createRadialGradient(lastX, lastY, 0, lastX, lastY, pulseRadius);
      pulseGrad.addColorStop(0, isUp ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)");
      pulseGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(lastX, lastY, pulseRadius, 0, Math.PI * 2);
      ctx.fillStyle = pulseGrad;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastX, lastY, 7, 0, Math.PI * 2);
    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [displayPoints, paperBalance, liveEquity]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || displayPoints.length < 2) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pad = { left: 52, right: 12 };
    const cw = rect.width - pad.left - pad.right;
    const xStep = cw / (displayPoints.length - 1);
    const idx = Math.round((x - pad.left) / xStep);
    if (idx >= 0 && idx < displayPoints.length) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, date: displayPoints[idx].date, value: displayPoints[idx].equity });
    }
  };

  if (displayPoints.length < 2) {
    return (
      <div className="glass-card p-6 text-center">
        <BarChart3 size={20} className="mx-auto text-white/8 mb-2" />
        <p className="text-white/20 text-xs">Equity curve appears after your first trade</p>
      </div>
    );
  }

  const first = displayPoints[0].equity;
  const last = displayPoints[displayPoints.length - 1].equity;
  const totalReturn = ((last - first) / first) * 100;

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-amber-400/70" />
          <h3 className="text-sm font-semibold text-white/60">Equity Curve</h3>
          {liveEquity != null && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400/50">
              <Radio size={8} /> Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${totalReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(2)}%
          </span>
          <span className="text-[10px] text-white/15">
            ${first.toFixed(2)} → ${last.toFixed(2)}
          </span>
        </div>
      </div>
      <div ref={containerRef} className="relative h-48 sm:h-56">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        />
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-black/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] z-10"
            style={{ left: Math.min(tooltip.x, (containerRef.current?.clientWidth || 200) - 100), top: Math.max(0, tooltip.y - 40) }}
          >
            <p className="text-white/40">{new Date(tooltip.date).toLocaleDateString()}</p>
            <p className="text-white font-bold">${tooltip.value.toFixed(2)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AutoTradingPage() {
  useTrackView("KoshPilot");
  const [config, setConfig] = useState<TradingConfig | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [trades, setTrades] = useState<AutoTrade[]>([]);
  const [openTrades, setOpenTrades] = useState<AutoTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [toggling, setToggling] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showModeSwitchConfirm, setShowModeSwitchConfirm] = useState(false);
  const [liveQuotes, setLiveQuotes] = useState<Record<string, LiveQuote>>({});
  const [equityHistory, setEquityHistory] = useState<EquityPoint[]>([]);
  const [discoveries, setDiscoveries] = useState<DiscoveredTicker[]>([]);
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [marketSentiment, setMarketSentiment] = useState<{ score: number; rating: string; brief: string } | null>(null);

  const openTickers = useMemo(() => [...new Set(openTrades.map((t) => t.ticker))], [openTrades]);

  const fetchLiveQuotes = useCallback(async () => {
    if (openTickers.length === 0) return;
    try {
      const res = await fetch(`/api/trading/quotes?tickers=${openTickers.join(",")}`);
      if (res.ok) setLiveQuotes(await res.json());
    } catch {}
  }, [openTickers]);

  useEffect(() => {
    if (openTickers.length === 0) return;
    fetchLiveQuotes();
    const interval = setInterval(fetchLiveQuotes, 10000);
    return () => clearInterval(interval);
  }, [openTickers, fetchLiveQuotes]);

  const totalUnrealizedPnl = useMemo(() => {
    return openTrades.reduce((sum, trade) => {
      const q = liveQuotes[trade.ticker];
      if (!q || !trade.entryPrice) return sum;
      return sum + (q.price - trade.entryPrice) * trade.qty;
    }, 0);
  }, [openTrades, liveQuotes]);

  const fetchCronStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/trading/auto?action=cron-status");
      if (res.ok) setCronStatus(await res.json());
    } catch {}
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const configRes = await fetch("/api/trading/auto?action=config");
      const configData = await configRes.json();
      if (configData.setup === false) { setNeedsSetup(true); setLoading(false); return; }
      setConfig(configData);
      setNeedsSetup(false);
      const [statsRes, tradesRes, openRes, equityRes] = await Promise.all([
        fetch("/api/trading/auto?action=stats"),
        fetch("/api/trading/auto?action=trades&status=CLOSED"),
        fetch("/api/trading/auto?action=trades&status=OPEN"),
        fetch("/api/trading/auto?action=equity-history"),
      ]);
      const [statsData, tradesData, openData, equityData] = await Promise.all([
        statsRes.json(), tradesRes.json(), openRes.json(), equityRes.json(),
      ]);
      setStats(statsData);
      setTrades(tradesData.trades || []);
      setOpenTrades(openData.trades || []);
      setEquityHistory(equityData.points || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    fetchCronStatus();
    fetch("/api/market/fear-greed")
      .then((r) => r.json())
      .then((d) => setMarketSentiment({ score: d.score ?? 50, rating: d.rating ?? "Neutral", brief: d.brief ?? "" }))
      .catch(() => {});
  }, [fetchData, fetchCronStatus]);

  useEffect(() => {
    const interval = setInterval(fetchCronStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchCronStatus]);

  const handleOnboardingComplete = (newConfig: TradingConfig) => { setConfig(newConfig); setNeedsSetup(false); fetchData(); };

  const toggleEnabled = async () => {
    if (!config) return;
    setToggling(true);
    try {
      const res = await fetch("/api/trading/auto", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !config.enabled }) });
      setConfig(await res.json());
    } catch {}
    setToggling(false);
  };

  const runNow = async () => {
    setRunning(true); setRunResult(null);
    try {
      if (!config?.enabled) {
        await fetch("/api/trading/auto", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: true }) });
      }
      const res = await fetch("/api/trading/auto", { method: "POST" });
      const result = await res.json();
      setRunResult(result);
      if (result.discovered?.length > 0) setDiscoveries(result.discovered);
      await fetchData();
    } catch (e: any) { setRunResult({ error: e.message || "Failed" }); }
    setRunning(false);
  };

  const getBriefing = async () => {
    setBriefing("Loading...");
    try {
      const res = await fetch("/api/trading/auto?action=briefing", { method: "POST" });
      const data = await res.json();
      setBriefing(data.briefing || "No briefing available.");
    } catch { setBriefing("Failed to load."); }
  };

  const updateConfig = async (updates: Partial<TradingConfig>) => {
    try {
      const res = await fetch("/api/trading/auto", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
      setConfig(await res.json());
    } catch {}
  };

  const resetSetup = async () => {
    if (!confirm("Reset KoshPilot? You'll go through setup again.")) return;
    setResetting(true);
    try {
      await fetch("/api/trading/auto", { method: "DELETE" });
      setConfig(null); setNeedsSetup(true); setStats(null); setTrades([]); setOpenTrades([]); setRunResult(null); setBriefing(null);
    } catch {}
    setResetting(false);
  };

  const dismissSplash = useCallback(() => setShowSplash(false), []);

  if (showSplash && !needsSetup) return <PilotSplash onDone={dismissSplash} />;

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (needsSetup) return <OnboardingFlow onComplete={handleOnboardingComplete} />;

  const realizedPnl = stats?.totalPnl || 0;
  const liveEquity = (config?.paperBalance || 10000) + realizedPnl + totalUnrealizedPnl;
  const equity = liveEquity;
  const pnlPct = config?.paperBalance ? ((realizedPnl + totalUnrealizedPnl) / config.paperBalance * 100) : 0;

  return (
    <ProGate feature="KoshPilot">
    <div className="space-y-6 max-w-5xl">
      {/* ─── Header ─── */}
      <div className="relative mesh-bg rounded-3xl p-6 overflow-hidden animate-fade-slide-up">
        <div className="orb orb-gold-1 top-[-120px] right-[-80px]" />
        <div className="orb orb-gold-2 bottom-[-80px] left-[-60px]" />

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl transition-all duration-500 ${
              config?.enabled ? "glass-card-gold koshpilot-glow" : "glass-card"
            }`}>
              <Navigation size={24} className={config?.enabled ? "text-amber-400" : "text-white/30"} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className={`text-2xl font-bold tracking-tight ${config?.enabled ? "gold-gradient-text" : "text-white"}`}>
                  KoshPilot
                </h1>
                {config?.enabled && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-white/25 text-xs">AI Co-Pilot</span>
                <Badge variant={config?.mode === "PAPER" ? "gold" : "green"}>
                  {config?.mode === "PAPER" ? "Sandbox" : "Live"}
                </Badge>
                {!config?.enabled && <Badge variant="gray">Paused</Badge>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleEnabled}
              disabled={toggling}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-300 ${
                config?.enabled
                  ? "bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400"
                  : "koshpilot-btn text-black"
              }`}
            >
              {toggling ? <RefreshCw size={14} className="animate-spin" /> : config?.enabled ? <><PowerOff size={14} /> Disable</> : <><Power size={14} /> Enable</>}
            </button>
            <button
              onClick={runNow}
              disabled={running}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-300 ${
                running ? "bg-white/[0.03] text-white/15 cursor-not-allowed" : "bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-400"
              }`}
            >
              <RefreshCw size={14} className={running ? "animate-spin" : ""} />
              {running ? "Scanning..." : "Run Now"}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2.5 rounded-xl transition-all duration-300 ${showSettings ? "bg-white/[0.08] text-white/60" : "bg-white/[0.03] text-white/25 hover:bg-white/[0.06] hover:text-white/50"}`}
            >
              <Settings size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── How It Works Toggle ─── */}
      <button
        onClick={() => setShowHowItWorks(!showHowItWorks)}
        className="flex items-center gap-2 text-xs text-white/25 hover:text-amber-400/60 transition-colors"
      >
        <Eye size={12} />
        {showHowItWorks ? "Hide" : "How it works"}
        {showHowItWorks ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {showHowItWorks && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {HOW_IT_WORKS.map((item, i) => (
            <div key={item.title} className={`glass-card p-3 space-y-2 animate-fade-slide-up-${i + 1}`}>
              <div className="w-7 h-7 rounded-lg bg-amber-500/8 border border-amber-500/10 flex items-center justify-center">
                <item.icon size={14} className="text-amber-400/70" />
              </div>
              <h4 className="text-white/70 font-semibold text-xs">{item.title}</h4>
              <p className="text-white/20 text-[10px] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* ─── Cron / Autopilot Status ─── */}
      <CronStatusBar
        cronStatus={cronStatus}
        enabled={config?.enabled ?? false}
        createdAt={config?.createdAt}
        onRefresh={fetchCronStatus}
      />

      {/* ─── Data Freshness ─── */}
      <div className="flex justify-end">
        <DataFreshness />
      </div>

      {/* ─── Portfolio Stats ─── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-fade-slide-up-1">
        <div className="stat-card-gold p-5 text-center md:col-span-1">
          <Wallet size={16} className="mx-auto text-amber-400/70 mb-2" />
          <AnimatedPrice value={equity} prefix="$" decimals={2} className="stat-value text-white" />
          <p className="stat-label mt-1">{config?.mode === "PAPER" ? "Simulation" : "Portfolio"}</p>
          {(realizedPnl !== 0 || totalUnrealizedPnl !== 0) && (
            <p className={`text-[10px] mt-1 font-medium ${pnlPct >= 0 ? "text-emerald-400/80" : "text-red-400/80"}`}>
              {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
            </p>
          )}
        </div>
        <div className="stat-card p-5 text-center">
          <DollarSign size={16} className="mx-auto text-white/20 mb-2" />
          <p className={`stat-value ${realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {realizedPnl >= 0 ? "+" : ""}${Math.abs(realizedPnl).toFixed(2)}
          </p>
          <p className="stat-label mt-1">Realized</p>
        </div>
        <div className="stat-card p-5 text-center">
          <TrendingUp size={16} className="mx-auto text-white/20 mb-2" />
          {totalUnrealizedPnl !== 0 ? (
            <AnimatedPrice
              value={totalUnrealizedPnl}
              prefix={totalUnrealizedPnl >= 0 ? "+$" : "-$"}
              decimals={0}
              className={`stat-value ${totalUnrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
            />
          ) : (
            <p className="stat-value text-white/30">$0</p>
          )}
          <p className="stat-label mt-1">Unrealized</p>
        </div>
        <div className="stat-card p-5 text-center">
          <Target size={16} className="mx-auto text-white/20 mb-2" />
          <p className="stat-value text-white">{stats?.winRate || 0}%</p>
          <p className="stat-label mt-1">Hit Rate</p>
          <p className="text-[10px] text-white/15 mt-0.5">{stats?.totalTrades || 0} trades</p>
        </div>
        <div className="stat-card p-5 text-center">
          <Activity size={16} className="mx-auto text-white/20 mb-2" />
          <p className="stat-value text-amber-400">{openTrades.length}</p>
          <p className="stat-label mt-1">Open</p>
        </div>
      </div>

      {/* ─── Equity Chart (Live) ─── */}
      <EquityChart points={equityHistory} paperBalance={config?.paperBalance || 10000} liveEquity={openTrades.length > 0 ? liveEquity : undefined} />

      {/* ─── Weekly Target Tracker ─── */}
      {stats && config && (
        <div className="glass-card p-5 animate-fade-slide-up-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-amber-400/70" />
              <h3 className="text-sm font-semibold text-white/60">Weekly Target</h3>
              <Badge variant={
                config.riskProfile === "CONSERVATIVE" ? "green" : config.riskProfile === "AGGRESSIVE" ? "red" : "gold"
              }>
                {config.riskProfile?.charAt(0) + (config.riskProfile?.slice(1).toLowerCase() || "")}
              </Badge>
            </div>
            <div className="text-right">
              <span className={`text-sm font-bold ${(stats.weeklyPnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {(stats.weeklyPnl || 0) >= 0 ? "+" : ""}${Math.abs(stats.weeklyPnl || 0).toFixed(0)}
              </span>
              <span className="text-white/15 text-xs"> / ${(stats.weeklyTargetDollars || 0).toFixed(0)}</span>
            </div>
          </div>
          <div className="h-2.5 bg-white/[0.04] rounded-full overflow-hidden relative">
            <div
              className={`h-full rounded-full pnl-bar transition-all duration-1000 ${
                (stats.weeklyProgressPct || 0) >= 100 ? "bg-gradient-to-r from-emerald-500/70 to-emerald-400/90"
                : (stats.weeklyProgressPct || 0) >= 50 ? "bg-gradient-to-r from-amber-500/60 to-amber-400/80"
                : (stats.weeklyProgressPct || 0) > 0 ? "bg-gradient-to-r from-amber-500/40 to-amber-400/50"
                : "bg-red-500/30"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, stats.weeklyProgressPct || 0))}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px]">
            <span className="text-white/15">0%</span>
            <span className={`font-medium ${
              (stats.weeklyProgressPct || 0) >= 100 ? "text-emerald-400/60" : "text-amber-400/40"
            }`}>
              {(stats.weeklyProgressPct || 0).toFixed(0)}% of {config.weeklyTargetPct || 10}% goal
            </span>
            <span className="text-white/15">100%</span>
          </div>
          {(stats.weeklyProgressPct || 0) >= 100 && (
            <p className="text-[10px] text-emerald-400/50 text-center mt-2 flex items-center justify-center gap-1">
              <Sparkles size={10} /> Weekly target achieved
            </p>
          )}
        </div>
      )}

      {/* ─── Prediction Accuracy ─── */}
      <AccuracyPanel />

      {/* ─── Mission Report ─── */}
      {runResult && <MissionReport result={runResult} onClose={() => setRunResult(null)} />}

      {/* ─── Discoveries ─── */}
      <DiscoveriesSection discoveries={discoveries} />

      {/* ─── Standby Banner ─── */}
      {!config?.enabled && (
        <div className="glass-card-gold p-4 flex items-center justify-between gap-4 animate-fade-slide-up">
          <div className="flex items-center gap-3">
            <Navigation size={18} className="text-amber-400/60 shrink-0" />
            <div>
              <p className="text-white/60 text-sm font-medium">KoshPilot is paused</p>
              <p className="text-white/20 text-xs">Enable for automatic scanning, or tap Run Now to scan once.</p>
            </div>
          </div>
          <button onClick={toggleEnabled} className="px-4 py-2 rounded-xl font-semibold koshpilot-btn text-black text-xs shrink-0">
            {toggling ? <RefreshCw size={14} className="animate-spin" /> : <><Power size={14} className="inline mr-1" />Enable</>}
          </button>
        </div>
      )}

      {/* ─── Settings ─── */}
      {showSettings && config && (
        <div className="glass-card p-5 space-y-5 animate-fade-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/50">Settings</h3>
            <Button size="sm" variant="secondary" onClick={resetSetup} loading={resetting}>
              <RotateCcw size={12} /> Reset
            </Button>
          </div>

          <div className={`rounded-xl p-4 border transition-all ${
            config.mode === "PAPER"
              ? "bg-amber-500/[0.03] border-amber-500/10"
              : "bg-emerald-500/[0.03] border-emerald-500/10"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {config.mode === "PAPER" ? <Plane size={18} className="text-amber-400/70" /> : <DollarSign size={18} className="text-emerald-400/70" />}
                <div>
                  <p className="text-white/80 text-sm font-semibold">{config.mode === "PAPER" ? "Simulation" : "Live"}</p>
                  <p className="text-white/25 text-xs">{config.mode === "PAPER" ? "Virtual capital" : "Real money via Alpaca"}</p>
                </div>
              </div>
              {config.mode === "PAPER" && (
                <button onClick={() => setShowModeSwitchConfirm(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/8 text-emerald-400/80 border border-emerald-500/15 hover:bg-emerald-500/15 transition-all">
                  Switch to Live
                </button>
              )}
            </div>
          </div>

          {showModeSwitchConfirm && (
            <div className="rounded-xl p-4 bg-red-500/[0.03] border border-red-500/10 space-y-3">
              <div className="flex gap-3">
                <Lock size={16} className="text-red-400/70 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300/80 text-sm font-medium">Not available yet</p>
                  <p className="text-white/20 text-xs mt-0.5">Complete 2 weeks of simulation and contact support.</p>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setShowModeSwitchConfirm(false)}>Got it</Button>
            </div>
          )}

          {config.mode === "PAPER" && (
            <div>
              <label className="text-xs text-white/25 block mb-2">Capital</label>
              <div className="flex flex-wrap gap-2">
                {BALANCE_OPTIONS.map(({ amount, label }) => (
                  <button key={amount} onClick={() => updateConfig({ paperBalance: amount })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      config.paperBalance === amount
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-white/[0.03] text-white/30 border border-white/[0.06] hover:border-white/[0.1]"
                    }`}
                  >
                    ${amount.toLocaleString()} {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-white/25 block mb-2">Risk Profile</label>
            <div className="grid grid-cols-3 gap-2">
              {RISK_PROFILES.map((rp) => {
                const isSelected = config.riskProfile === rp.id;
                const Icon = rp.icon;
                return (
                  <button
                    key={rp.id}
                    onClick={() => updateConfig({
                      riskProfile: rp.id,
                      maxPositionPct: rp.maxPositionPct,
                      maxDailyLossPct: rp.maxDailyLossPct,
                      maxOpenPositions: rp.maxOpenPositions,
                      weeklyTargetPct: rp.weeklyTargetPct,
                    })}
                    className={`p-3 rounded-xl border text-center transition-all duration-300 ${
                      isSelected
                        ? rp.color === "emerald" ? "border-emerald-500/30 bg-emerald-500/[0.05]"
                          : rp.color === "red" ? "border-red-500/30 bg-red-500/[0.05]"
                          : "border-amber-500/30 bg-amber-500/[0.05]"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
                    }`}
                  >
                    <Icon size={16} className={`mx-auto mb-1 ${
                      isSelected
                        ? rp.color === "emerald" ? "text-emerald-400" : rp.color === "red" ? "text-red-400" : "text-amber-400"
                        : "text-white/25"
                    }`} />
                    <p className={`text-xs font-medium ${isSelected ? "text-white/80" : "text-white/30"}`}>{rp.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/25 block mb-2">Weekly Target</label>
            <div className="flex flex-wrap gap-2">
              {TARGET_OPTIONS.map(({ pct, label }) => (
                <button key={pct} onClick={() => updateConfig({ weeklyTargetPct: pct })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    (config.weeklyTargetPct || 10) === pct
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-white/[0.03] text-white/30 border border-white/[0.06] hover:border-white/[0.1]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Max Position %", value: config.maxPositionPct, key: "maxPositionPct", options: [2, 3, 5, 8, 10], fmt: (v: number) => `${v}% per trade` },
              { label: "Daily Loss Limit", value: config.maxDailyLossPct, key: "maxDailyLossPct", options: [1, 2, 3, 5], fmt: (v: number) => `${v}% max/day` },
              { label: "Max Positions", value: config.maxOpenPositions, key: "maxOpenPositions", options: [3, 5, 8, 10], fmt: (v: number) => `${v} positions` },
            ].map(({ label, value, key, options, fmt }) => (
              <div key={key}>
                <label className="text-xs text-white/25 block mb-1">{label}</label>
                <select
                  value={value}
                  onChange={(e) => updateConfig({ [key]: Number(e.target.value) })}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/30"
                >
                  {options.map((v) => <option key={v} value={v}>{fmt(v)}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs text-white/25 block mb-1.5">Watchlist ({config.watchlist.length})</label>
            <div className="flex flex-wrap gap-1.5">
              {config.watchlist.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1 text-xs text-white/50">
                  <StockLogo ticker={t} size={14} /> {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Market Conditions ─── */}
      {marketSentiment && (() => {
        const s = marketSentiment.score;
        const sentColor = s <= 20 ? "text-red-400" : s <= 40 ? "text-orange-400" : s <= 60 ? "text-yellow-400" : s <= 80 ? "text-lime-400" : "text-emerald-400";
        const sentBorder = s <= 20 ? "border-red-500/15" : s <= 40 ? "border-orange-500/15" : s <= 60 ? "border-yellow-500/15" : s <= 80 ? "border-lime-500/15" : "border-emerald-500/15";
        const multiplier = s <= 20 ? 0.3 : s <= 35 ? 0.5 : s <= 50 ? 0.7 : s <= 65 ? 1.0 : s <= 80 ? 1.0 : 0.8;
        const maxBase = config?.maxOpenPositions || 10;
        const adjusted = Math.max(1, Math.floor(maxBase * multiplier));
        return (
          <div className={`glass-card p-5 space-y-3 animate-fade-slide-up-2 border ${sentBorder}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={14} className={sentColor} />
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Market Conditions</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-black ${sentColor}`}>{s}</span>
                <span className={`text-xs font-semibold ${sentColor}`}>{marketSentiment.rating}</span>
              </div>
            </div>
            {marketSentiment.brief && (
              <p className="text-sm text-white/50 leading-relaxed">{marketSentiment.brief}</p>
            )}
            <div className={`rounded-lg px-3 py-2 bg-white/[0.03] border border-white/[0.06]`}>
              <p className="text-[11px] text-white/30">
                <span className={`font-semibold ${sentColor}`}>Trade Impact:</span> KoshPilot will limit new entries to <span className="text-white/70 font-semibold">{adjusted}</span> of {maxBase} positions today ({(multiplier * 100).toFixed(0)}% capacity)
              </p>
            </div>
          </div>
        );
      })()}

      {/* ─── AI Briefing ─── */}
      <div className="glass-card p-5 space-y-3 animate-fade-slide-up-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-amber-400/70" />
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">AI Briefing</h3>
          </div>
          <button onClick={getBriefing} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-white/40 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white/60 transition-all">
            Get Briefing
          </button>
        </div>
        {briefing ? (
          <p className="text-sm text-white/50 leading-relaxed whitespace-pre-wrap">{briefing}</p>
        ) : (
          <p className="text-xs text-white/15">Get today&apos;s AI analysis of your watchlist</p>
        )}
      </div>

      {/* ─── Open Positions (Live) ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp size={14} className="text-amber-400/70" />
            Holdings ({openTrades.length})
          </h2>
          <div className="flex items-center gap-3">
            {Object.keys(liveQuotes).length > 0 && totalUnrealizedPnl !== 0 && (
              <AnimatedPrice
                value={totalUnrealizedPnl}
                prefix={totalUnrealizedPnl >= 0 ? "+$" : "-$"}
                decimals={2}
                className={`text-xs font-bold ${totalUnrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
              />
            )}
            {Object.keys(liveQuotes).length > 0 && (
              <div className="flex items-center gap-1.5">
                <Radio size={10} className="text-emerald-400/60" />
                <span className="text-[10px] text-white/20">Live</span>
              </div>
            )}
          </div>
        </div>
        {openTrades.length > 0 ? (
          <div className="space-y-2">
            {openTrades.map((trade) => (
              <LivePositionCard key={trade.id} trade={trade} quote={liveQuotes[trade.ticker]} />
            ))}
          </div>
        ) : (
          <div className="glass-card p-6 text-center">
            <Wallet size={24} className="mx-auto text-white/8 mb-2" />
            <p className="text-white/30 text-sm">No open positions</p>
            <p className="text-white/15 text-xs mt-1">
              {config?.enabled
                ? "Waiting for high-conviction setups from your watchlist"
                : "Tap Run Now to scan for opportunities"}
            </p>
            {!config?.enabled && (
              <button
                onClick={runNow}
                disabled={running}
                className="mt-3 px-5 py-2 rounded-xl text-xs font-semibold koshpilot-btn text-black inline-flex items-center gap-2"
              >
                <RefreshCw size={14} className={running ? "animate-spin" : ""} />
                {running ? "Scanning..." : "Run Now"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Trade History ─── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2">
          <Clock size={14} className="text-white/20" />
          History
        </h2>
        {trades.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <BarChart3 size={24} className="mx-auto text-white/8 mb-2" />
            <p className="text-white/30 text-sm">No completed trades yet</p>
            <p className="text-white/15 text-xs mt-1">
              Closed positions will appear here with realized P&L
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {trades.map((trade) => (
              <div key={trade.id} className="glass-card p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <StockLogo ticker={trade.ticker} size={32} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white/80 font-semibold text-sm">{trade.ticker}</span>
                      <span className="text-white/20 text-xs">{trade.qty} shares</span>
                      {trade.strategy && <Badge variant="gray">{trade.strategy}</Badge>}
                    </div>
                    <p className="text-xs text-white/15 mt-0.5">
                      ${trade.entryPrice?.toFixed(2) || "\u2014"} &rarr; ${trade.exitPrice?.toFixed(2) || "\u2014"}
                      {trade.exitReason && <span className="text-white/10"> &middot; {trade.exitReason}</span>}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${(trade.pnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(trade.pnl || 0) >= 0 ? "+" : ""}${(trade.pnl || 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-white/15">{trade.exitAt ? new Date(trade.exitAt).toLocaleDateString() : "\u2014"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </ProGate>
  );
}
