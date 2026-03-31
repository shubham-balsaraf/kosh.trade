"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import StockLogo from "@/components/ui/StockLogo";
import {
  Navigation, Power, PowerOff, TrendingUp, TrendingDown, DollarSign,
  BarChart3, Target, Clock, Activity, RefreshCw, Settings, Zap,
  Search, Brain, ShieldCheck, ArrowRight, ArrowLeft, Sparkles,
  X, Plus, ChevronRight, AlertTriangle, RotateCcw,
  Wallet, Lock, ChevronDown, ChevronUp, Plane, Eye, Radio,
} from "lucide-react";

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

interface RunResult {
  status?: string;
  reason?: string;
  scanned?: number;
  signalsFound?: number;
  tradesExecuted?: number;
  exitsExecuted?: number;
  details?: any[];
  error?: string;
}

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD", "NFLX", "JPM"];

const HOW_IT_WORKS = [
  { icon: Search, title: "Scans Markets", desc: "Scans 10+ stocks for RSI, MACD, Bollinger, VWAP signals every hour" },
  { icon: Brain, title: "AI Analysis", desc: "Claude AI scores each opportunity with conviction rating (0-100%)" },
  { icon: Zap, title: "Auto Executes", desc: "Places trades automatically with stop-losses and take-profits" },
  { icon: ShieldCheck, title: "Risk Shield", desc: "Position limits, daily loss caps, PDT compliance built in" },
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
  { id: "CONSERVATIVE", label: "Conservative", icon: ShieldCheck, desc: "Fewer trades, higher conviction signals only. Wider stop-losses, longer holds.", color: "emerald" },
  { id: "MODERATE", label: "Moderate", icon: Target, desc: "Balanced approach. Standard thresholds and position sizing.", color: "amber" },
  { id: "AGGRESSIVE", label: "Aggressive", icon: Zap, desc: "More trades, lower thresholds. Tighter stops, bigger positions.", color: "red" },
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

      {/* Step 0: Hero */}
      {step === 0 && (
        <div className="space-y-8">
          <div className="relative mesh-bg rounded-3xl p-8 sm:p-12 text-center overflow-hidden animate-scale-in">
            <div className="orb orb-gold-1 top-[-100px] right-[-50px]" />
            <div className="orb orb-gold-2 bottom-[-60px] left-[-40px]" />

            <div className="relative z-10 space-y-5">
              <div className="w-20 h-20 rounded-3xl glass-card-gold flex items-center justify-center mx-auto koshpilot-glow">
                <Navigation size={32} className="text-amber-400" />
              </div>
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight gold-gradient-text pb-1">KoshPilot</h1>
                <p className="text-white/40 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
                  Your AI co-pilot that scans, analyzes, and executes trades — completely hands-free.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 glass-card px-4 py-2">
                <Sparkles size={14} className="text-amber-400 koshpilot-pulse" />
                <span className="text-xs text-white/50">Powered by Claude AI</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {HOW_IT_WORKS.map((item, i) => (
              <div
                key={item.title}
                className={`glass-card p-4 space-y-3 animate-fade-slide-up-${i + 1}`}
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/8 border border-amber-500/10 flex items-center justify-center">
                  <item.icon size={16} className="text-amber-400/80" />
                </div>
                <div>
                  <h3 className="text-white/90 font-semibold text-sm">{item.title}</h3>
                  <p className="text-white/30 text-xs leading-relaxed mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card-gold p-4 flex gap-3 items-start animate-fade-slide-up-4">
            <Sparkles size={16} className="text-amber-400/80 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300/90 text-sm font-medium">Start with Simulation Mode</p>
              <p className="text-white/25 text-xs mt-0.5">Trade with virtual capital for 2-4 weeks before going live.</p>
            </div>
          </div>

          <button onClick={() => setStep(1)} className="w-full py-3.5 rounded-2xl font-semibold text-black koshpilot-btn flex items-center justify-center gap-2 text-sm">
            Get Started <ArrowRight size={16} />
          </button>
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
                  onClick={() => setRiskProfile(rp.id)}
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

export default function AutoTradingPage() {
  const [config, setConfig] = useState<TradingConfig | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
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
    const interval = setInterval(fetchLiveQuotes, 15000);
    return () => clearInterval(interval);
  }, [openTickers, fetchLiveQuotes]);

  const totalUnrealizedPnl = useMemo(() => {
    return openTrades.reduce((sum, trade) => {
      const q = liveQuotes[trade.ticker];
      if (!q || !trade.entryPrice) return sum;
      return sum + (q.price - trade.entryPrice) * trade.qty;
    }, 0);
  }, [openTrades, liveQuotes]);

  const fetchData = useCallback(async () => {
    try {
      const configRes = await fetch("/api/trading/auto?action=config");
      const configData = await configRes.json();
      if (configData.setup === false) { setNeedsSetup(true); setLoading(false); return; }
      setConfig(configData);
      setNeedsSetup(false);
      const [statsRes, tradesRes, openRes] = await Promise.all([
        fetch("/api/trading/auto?action=stats"),
        fetch("/api/trading/auto?action=trades&status=CLOSED"),
        fetch("/api/trading/auto?action=trades&status=OPEN"),
      ]);
      const [statsData, tradesData, openData] = await Promise.all([statsRes.json(), tradesRes.json(), openRes.json()]);
      setStats(statsData);
      setTrades(tradesData.trades || []);
      setOpenTrades(openData.trades || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
      const res = await fetch("/api/trading/auto", { method: "POST" });
      setRunResult(await res.json());
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

  const equity = (config?.paperBalance || 10000) + (stats?.totalPnl || 0);
  const pnlPct = config?.paperBalance ? ((stats?.totalPnl || 0) / config.paperBalance * 100) : 0;

  return (
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
                  : "bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-400"
              }`}
            >
              {toggling ? <RefreshCw size={14} className="animate-spin" /> : config?.enabled ? <><PowerOff size={14} /> Disable</> : <><Power size={14} /> Enable</>}
            </button>
            <button
              onClick={runNow}
              disabled={!config?.enabled || running}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-300 ${
                !config?.enabled || running ? "bg-white/[0.03] text-white/15 cursor-not-allowed" : "koshpilot-btn text-black"
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

      {/* ─── Portfolio Stats ─── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-fade-slide-up-1">
        <div className="stat-card-gold p-5 text-center md:col-span-1">
          <Wallet size={16} className="mx-auto text-amber-400/70 mb-2" />
          <p className="stat-value text-white">
            ${equity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="stat-label mt-1">{config?.mode === "PAPER" ? "Simulation" : "Portfolio"}</p>
          {config?.mode === "PAPER" && (stats?.totalPnl || 0) !== 0 && (
            <p className={`text-[10px] mt-1 font-medium ${pnlPct >= 0 ? "text-emerald-400/80" : "text-red-400/80"}`}>
              {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
            </p>
          )}
        </div>
        <div className="stat-card p-5 text-center">
          <DollarSign size={16} className="mx-auto text-white/20 mb-2" />
          <p className={`stat-value ${(stats?.totalPnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {(stats?.totalPnl || 0) >= 0 ? "+" : ""}${Math.abs(stats?.totalPnl || 0).toFixed(0)}
          </p>
          <p className="stat-label mt-1">P&L</p>
        </div>
        <div className="stat-card p-5 text-center">
          <Target size={16} className="mx-auto text-white/20 mb-2" />
          <p className="stat-value text-white">{stats?.winRate || 0}%</p>
          <p className="stat-label mt-1">Hit Rate</p>
        </div>
        <div className="stat-card p-5 text-center">
          <BarChart3 size={16} className="mx-auto text-white/20 mb-2" />
          <p className="stat-value text-white">{stats?.totalTrades || 0}</p>
          <p className="stat-label mt-1">Trades</p>
        </div>
        <div className="stat-card p-5 text-center">
          <Activity size={16} className="mx-auto text-white/20 mb-2" />
          <p className="stat-value text-amber-400">{stats?.openPositions || 0}</p>
          <p className="stat-label mt-1">Open</p>
        </div>
      </div>

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

      {/* ─── Mission Report ─── */}
      {runResult && (
        <div className={`glass-card p-5 animate-scale-in ${
          runResult.status === "ERROR" ? "border-red-500/15" : runResult.status === "SKIPPED" ? "border-amber-500/15" : "border-amber-500/15"
        }`}>
          <div className="flex items-start gap-3">
            {runResult.status === "ERROR" ? (
              <AlertTriangle size={16} className="text-red-400/80 shrink-0 mt-0.5" />
            ) : runResult.status === "SKIPPED" ? (
              <Clock size={16} className="text-amber-400/80 shrink-0 mt-0.5" />
            ) : (
              <Navigation size={16} className="text-amber-400/80 shrink-0 mt-0.5" />
            )}
            <div className="text-sm flex-1">
              {runResult.status === "ERROR" ? (
                <p className="text-red-300/80 text-xs">{runResult.reason || runResult.error}</p>
              ) : runResult.status === "SKIPPED" ? (
                <p className="text-amber-300/80 text-xs">{runResult.reason}</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-amber-300/90 font-semibold text-xs uppercase tracking-wider">Mission Report</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { icon: Search, val: runResult.scanned || 0, label: "scanned", color: "text-amber-400/70" },
                      { icon: Brain, val: runResult.signalsFound || 0, label: "signals", color: "text-amber-400/70" },
                      { icon: TrendingUp, val: runResult.tradesExecuted || 0, label: "trades", color: "text-emerald-400/70" },
                      ...(runResult.exitsExecuted ? [{ icon: DollarSign, val: runResult.exitsExecuted, label: "exits", color: "text-white/40" }] : []),
                    ].map(({ icon: Icon, val, label, color }) => (
                      <span key={label} className="flex items-center gap-1.5 bg-white/[0.03] rounded-lg px-3 py-1.5 text-xs">
                        <Icon size={12} className={color} />
                        <span className="text-white/80 font-semibold">{val}</span>
                        <span className="text-white/25">{label}</span>
                      </span>
                    ))}
                  </div>
                  {runResult.details && runResult.details.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {runResult.details.slice(0, 5).map((d: any, i: number) => (
                        <div key={i} className="text-xs text-white/30 flex items-center gap-2">
                          <Badge variant={d.action === "BUY" ? "green" : d.action === "SELL" ? "red" : "gray"}>
                            {d.action}
                          </Badge>
                          <span className="text-white/70 font-medium">{d.ticker}</span>
                          {d.qty && <span>{d.qty} @ ${d.price?.toFixed(2)}</span>}
                          {d.reason && <span className="text-white/15">- {d.reason}</span>}
                        </div>
                      ))}
                      {runResult.details.length > 5 && <p className="text-white/15 text-xs">+ {runResult.details.length - 5} more</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => setRunResult(null)} className="text-white/15 hover:text-white/40 shrink-0 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ─── Standby CTA ─── */}
      {!config?.enabled && (
        <div className="relative mesh-bg rounded-3xl p-8 text-center overflow-hidden animate-fade-slide-up">
          <div className="orb orb-gold-1 top-[-80px] left-[20%]" />
          <div className="relative z-10 space-y-4">
            <Navigation size={36} className="mx-auto text-amber-400/60 koshpilot-pulse" />
            <div>
              <p className="text-white/80 font-semibold">KoshPilot is on standby</p>
              <p className="text-white/25 text-sm mt-1">Enable to start scanning for opportunities during market hours.</p>
            </div>
            <button onClick={toggleEnabled} className="px-8 py-3 rounded-2xl font-semibold koshpilot-btn text-black inline-flex items-center gap-2 text-sm">
              {toggling ? <RefreshCw size={16} className="animate-spin" /> : <><Power size={16} /> Launch KoshPilot</>}
            </button>
          </div>
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
                    onClick={() => updateConfig({ riskProfile: rp.id })}
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
      {openTrades.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={14} className="text-amber-400/70" />
              Open Positions ({openTrades.length})
            </h2>
            <div className="flex items-center gap-3">
              {Object.keys(liveQuotes).length > 0 && totalUnrealizedPnl !== 0 && (
                <span className={`text-xs font-bold ${totalUnrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {totalUnrealizedPnl >= 0 ? "+" : ""}${totalUnrealizedPnl.toFixed(2)} total
                </span>
              )}
              {Object.keys(liveQuotes).length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Radio size={10} className="text-emerald-400/60" />
                  <span className="text-[10px] text-white/20">Live</span>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {openTrades.map((trade) => (
              <LivePositionCard key={trade.id} trade={trade} quote={liveQuotes[trade.ticker]} />
            ))}
          </div>
        </div>
      )}

      {/* ─── Trade History ─── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2">
          <Clock size={14} className="text-white/20" />
          History
        </h2>
        {trades.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <BarChart3 size={28} className="mx-auto text-white/8 mb-3" />
            <p className="text-white/30 text-sm">No completed trades yet</p>
            <p className="text-white/15 text-xs mt-1">
              {config?.enabled ? "Waiting for high-conviction setups" : "Enable KoshPilot to start"}
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
  );
}
