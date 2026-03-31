"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import StockLogo from "@/components/ui/StockLogo";
import {
  Navigation, Power, PowerOff, TrendingUp, DollarSign,
  BarChart3, Target, Clock, Activity, RefreshCw, Settings, Zap,
  Search, Brain, ShieldCheck, ArrowRight, ArrowLeft, Sparkles,
  Play, X, Plus, ChevronRight, AlertTriangle, RotateCcw,
  Wallet, Lock, ChevronDown, ChevronUp, Plane,
} from "lucide-react";

interface TradingConfig {
  enabled: boolean;
  mode: string;
  paperBalance: number;
  maxPositionPct: number;
  maxDailyLossPct: number;
  maxOpenPositions: number;
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
  {
    icon: Search,
    title: "Scans the Market",
    description: "Every hour, the AI scans 10+ stocks for technical signals — RSI, MACD, Bollinger Bands, VWAP, and more.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: Brain,
    title: "AI Analysis",
    description: "Claude AI scores each opportunity with a conviction rating (0-100%) based on technical and fundamental context.",
    color: "text-amber-300",
    bg: "bg-amber-400/10",
  },
  {
    icon: Zap,
    title: "Auto Executes",
    description: "When a high-conviction setup is found, it automatically places trades — with stop-losses and take-profits.",
    color: "text-amber-500",
    bg: "bg-amber-600/10",
  },
  {
    icon: ShieldCheck,
    title: "Risk Protection",
    description: "Built-in guardrails: max position sizing, daily loss caps, PDT compliance, and portfolio-level limits.",
    color: "text-amber-200",
    bg: "bg-amber-300/10",
  },
];

const BALANCE_OPTIONS = [
  { amount: 1000, label: "Starter", emoji: "🚀" },
  { amount: 5000, label: "Standard", emoji: "📈" },
  { amount: 10000, label: "Pro", emoji: "💎" },
  { amount: 25000, label: "Whale", emoji: "🐋" },
];

function OnboardingFlow({ onComplete }: { onComplete: (config: TradingConfig) => void }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"PAPER" | "LIVE">("PAPER");
  const [paperBalance, setPaperBalance] = useState(10000);
  const [watchlist, setWatchlist] = useState<string[]>([...DEFAULT_WATCHLIST]);
  const [tickerInput, setTickerInput] = useState("");
  const [maxPositionPct, setMaxPositionPct] = useState(5);
  const [maxDailyLossPct, setMaxDailyLossPct] = useState(3);
  const [maxOpenPositions, setMaxOpenPositions] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const addTicker = () => {
    const t = tickerInput.trim().toUpperCase();
    if (t && !watchlist.includes(t)) {
      setWatchlist([...watchlist, t]);
    }
    setTickerInput("");
  };

  const removeTicker = (ticker: string) => {
    setWatchlist(watchlist.filter((t) => t !== ticker));
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/trading/auto", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          mode,
          paperBalance,
          watchlist,
          maxPositionPct,
          maxDailyLossPct,
          maxOpenPositions,
        }),
      });
      const config = await res.json();
      onComplete(config);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2 justify-center animate-fade-slide-up">
        {[0, 1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => { if (s < step) setStep(s); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                s === step
                  ? "bg-amber-500 text-black scale-110 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                  : s < step
                    ? "bg-amber-500/20 text-amber-400 cursor-pointer"
                    : "bg-gray-800 text-gray-600"
              }`}
            >
              {s < step ? "\u2713" : s + 1}
            </button>
            {s < 2 && (
              <div className={`w-12 h-0.5 transition-all ${s < step ? "bg-amber-500/40" : "bg-gray-800"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: How It Works */}
      {step === 0 && (
        <div className="space-y-6">
          <div className="text-center space-y-3 animate-fade-slide-up">
            <div className="w-20 h-20 rounded-2xl gold-gradient-bg border border-amber-500/20 flex items-center justify-center mx-auto koshpilot-glow">
              <Navigation size={36} className="text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold gold-gradient-text">KoshPilot</h1>
            <p className="text-amber-400/80 text-sm font-medium">Your AI co-pilot for the markets</p>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              An AI-powered trading assistant that scans, analyzes, and executes trades for you — completely hands-free.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {HOW_IT_WORKS.map((item, i) => (
              <Card key={item.title} className={`!p-4 space-y-2 animate-fade-slide-up-${i + 1}`}>
                <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center`}>
                  <item.icon size={20} className={item.color} />
                </div>
                <h3 className="text-white font-semibold text-sm">{item.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{item.description}</p>
              </Card>
            ))}
          </div>

          <Card className="!p-4 gold-gradient-bg border-amber-500/20 animate-fade-slide-up-4">
            <div className="flex gap-3">
              <Sparkles size={18} className="text-amber-400 shrink-0 mt-0.5 koshpilot-pulse" />
              <div>
                <p className="text-amber-300 text-sm font-medium">Recommended: Start with Simulation Mode</p>
                <p className="text-amber-400/60 text-xs mt-1">
                  Run KoshPilot with virtual money for 2-4 weeks to see how it performs before going live.
                </p>
              </div>
            </div>
          </Card>

          <button
            onClick={() => setStep(1)}
            className="w-full py-3 rounded-xl font-semibold text-black koshpilot-btn flex items-center justify-center gap-2"
          >
            Get Started <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Step 1: Choose Flight Mode */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center space-y-2 animate-fade-slide-up">
            <h2 className="text-xl font-bold text-white">Choose Your Flight Mode</h2>
            <p className="text-gray-400 text-sm">You can switch between modes anytime from settings.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-slide-up-1">
            <button
              onClick={() => setMode("PAPER")}
              className={`text-left p-5 rounded-2xl border-2 transition-all ${
                mode === "PAPER"
                  ? "border-amber-500 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                  : "border-gray-800 bg-gray-900/50 hover:border-gray-700"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Plane size={20} className="text-amber-400" />
                </div>
                {mode === "PAPER" && <Badge variant="yellow">Recommended</Badge>}
              </div>
              <h3 className="text-white font-bold mb-1">Simulation Flight</h3>
              <p className="text-gray-500 text-xs leading-relaxed">
                Practice with virtual capital. Zero risk. See real market performance without putting money at stake.
              </p>
              <ul className="mt-3 space-y-1.5">
                {["No real capital at risk", "Real market data & signals", "Track performance over time"].map((item) => (
                  <li key={item} className="text-xs text-gray-400 flex items-center gap-2">
                    <ChevronRight size={12} className="text-amber-500" /> {item}
                  </li>
                ))}
              </ul>
            </button>

            <button
              onClick={() => setMode("LIVE")}
              className={`text-left p-5 rounded-2xl border-2 transition-all ${
                mode === "LIVE"
                  ? "border-emerald-500 bg-emerald-500/5"
                  : "border-gray-800 bg-gray-900/50 hover:border-gray-700"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign size={20} className="text-emerald-400" />
                </div>
                {mode === "LIVE" && <Badge variant="green">Advanced</Badge>}
              </div>
              <h3 className="text-white font-bold mb-1">Live Trading</h3>
              <p className="text-gray-500 text-xs leading-relaxed">
                Trade with real money through your Alpaca brokerage account. Requires API keys configured.
              </p>
              <ul className="mt-3 space-y-1.5">
                {["Real money execution", "Alpaca API required", "Start small, scale up"].map((item) => (
                  <li key={item} className="text-xs text-gray-400 flex items-center gap-2">
                    <ChevronRight size={12} className="text-emerald-500" /> {item}
                  </li>
                ))}
              </ul>
            </button>
          </div>

          {mode === "LIVE" && (
            <Card className="!p-4 bg-red-500/5 border-red-500/20 animate-fade-slide-up">
              <div className="flex gap-3">
                <Lock size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 text-sm font-medium">Live Trading is not enabled for your profile yet</p>
                  <p className="text-red-400/60 text-xs mt-1">
                    Complete at least 2 weeks of simulation trading first. Contact support to request live trading access.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {mode === "PAPER" && (
            <Card className="space-y-3 animate-fade-slide-up-2">
              <h3 className="text-sm font-semibold text-amber-400/80">Starting Capital</h3>
              <p className="text-xs text-gray-500">How much virtual capital should KoshPilot trade with?</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BALANCE_OPTIONS.map(({ amount, label, emoji }) => (
                  <button
                    key={amount}
                    onClick={() => setPaperBalance(amount)}
                    className={`py-3 rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                      paperBalance === amount
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                        : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <span className="text-lg">{emoji}</span>
                    <span>${amount.toLocaleString()}</span>
                    <span className="text-[10px] text-gray-500">{label}</span>
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Or enter a custom amount</label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={paperBalance || ""}
                  onChange={(e) => setPaperBalance(Number(e.target.value))}
                  min={100}
                  max={1000000}
                />
              </div>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(0)}>
              <ArrowLeft size={16} /> Back
            </Button>
            <button
              className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                mode === "LIVE"
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "koshpilot-btn text-black"
              }`}
              onClick={() => { if (mode !== "LIVE") setStep(2); }}
              disabled={mode === "LIVE"}
            >
              {mode === "LIVE" ? "Not Available" : <>Continue <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center space-y-2 animate-fade-slide-up">
            <h2 className="text-xl font-bold text-white">Configure Your Co-Pilot</h2>
            <p className="text-gray-400 text-sm">Set your preferences. You can always change these later.</p>
          </div>

          <Card className="space-y-3 animate-fade-slide-up-1">
            <h3 className="text-sm font-semibold text-gray-400">
              Watchlist ({watchlist.length} stocks)
            </h3>
            <div className="flex flex-wrap gap-2">
              {watchlist.map((ticker) => (
                <span
                  key={ticker}
                  className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <StockLogo ticker={ticker} size={16} />
                  {ticker}
                  <button
                    onClick={() => removeTicker(ticker)}
                    className="text-gray-500 hover:text-red-400 transition-colors ml-0.5"
                  >
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
          </Card>

          <Card className="space-y-4 animate-fade-slide-up-2">
            <h3 className="text-sm font-semibold text-gray-400">Risk Management</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Max Position Size</label>
                <select
                  value={maxPositionPct}
                  onChange={(e) => setMaxPositionPct(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white"
                >
                  {[2, 3, 5, 8, 10].map((v) => (
                    <option key={v} value={v}>{v}% per trade</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-600 mt-1">Max % of portfolio per trade</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Daily Loss Limit</label>
                <select
                  value={maxDailyLossPct}
                  onChange={(e) => setMaxDailyLossPct(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white"
                >
                  {[1, 2, 3, 5].map((v) => (
                    <option key={v} value={v}>{v}% max loss/day</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-600 mt-1">KoshPilot stops if daily loss hits limit</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Max Open Positions</label>
                <select
                  value={maxOpenPositions}
                  onChange={(e) => setMaxOpenPositions(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white"
                >
                  {[3, 5, 8, 10].map((v) => (
                    <option key={v} value={v}>{v} positions</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-600 mt-1">Max simultaneous open trades</p>
              </div>
            </div>
          </Card>

          <Card className="!p-4 gold-gradient-bg border-amber-500/20 animate-fade-slide-up-3">
            <div className="flex items-start gap-3">
              <Navigation size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-gray-400 space-y-1">
                <p>
                  <span className="text-amber-300 font-medium">Mode:</span>{" "}
                  Simulation Flight (virtual capital)
                </p>
                <p>
                  <span className="text-amber-300 font-medium">Starting Capital:</span>{" "}
                  ${paperBalance.toLocaleString()}
                </p>
                <p>
                  <span className="text-amber-300 font-medium">Watching:</span>{" "}
                  {watchlist.length} stocks
                </p>
                <p>
                  <span className="text-amber-300 font-medium">Risk:</span>{" "}
                  {maxPositionPct}% max position, {maxDailyLossPct}% daily loss cap, {maxOpenPositions} max positions
                </p>
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Back
            </Button>
            <button
              className="flex-1 py-3 rounded-xl font-semibold koshpilot-btn text-black flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={handleFinish}
              disabled={submitting || watchlist.length === 0}
            >
              {submitting ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <><Navigation size={16} /> Launch KoshPilot</>
              )}
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

  const fetchData = useCallback(async () => {
    try {
      const configRes = await fetch("/api/trading/auto?action=config");
      const configData = await configRes.json();

      if (configData.setup === false) {
        setNeedsSetup(true);
        setLoading(false);
        return;
      }

      setConfig(configData);
      setNeedsSetup(false);

      const [statsRes, tradesRes, openRes] = await Promise.all([
        fetch("/api/trading/auto?action=stats"),
        fetch("/api/trading/auto?action=trades&status=CLOSED"),
        fetch("/api/trading/auto?action=trades&status=OPEN"),
      ]);
      const [statsData, tradesData, openData] = await Promise.all([
        statsRes.json(),
        tradesRes.json(),
        openRes.json(),
      ]);
      setStats(statsData);
      setTrades(tradesData.trades || []);
      setOpenTrades(openData.trades || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOnboardingComplete = (newConfig: TradingConfig) => {
    setConfig(newConfig);
    setNeedsSetup(false);
    fetchData();
  };

  const toggleEnabled = async () => {
    if (!config) return;
    setToggling(true);
    try {
      const res = await fetch("/api/trading/auto", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !config.enabled }),
      });
      const updated = await res.json();
      setConfig(updated);
    } catch {}
    setToggling(false);
  };

  const runNow = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/trading/auto", { method: "POST" });
      const data = await res.json();
      setRunResult(data);
      await fetchData();
    } catch (e: any) {
      setRunResult({ error: e.message || "Failed to run trading cycle" });
    }
    setRunning(false);
  };

  const getBriefing = async () => {
    setBriefing("Loading AI analysis...");
    try {
      const res = await fetch("/api/trading/auto?action=briefing", { method: "POST" });
      const data = await res.json();
      setBriefing(data.briefing || "No briefing available right now.");
    } catch {
      setBriefing("Failed to load briefing. Try again.");
    }
  };

  const updateConfig = async (updates: Partial<TradingConfig>) => {
    try {
      const res = await fetch("/api/trading/auto", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const updated = await res.json();
      setConfig(updated);
    } catch {}
  };

  const resetSetup = async () => {
    if (!confirm("This will reset your KoshPilot setup. You'll go through the setup wizard again. Continue?")) return;
    setResetting(true);
    try {
      await fetch("/api/trading/auto", { method: "DELETE" });
      setConfig(null);
      setNeedsSetup(true);
      setStats(null);
      setTrades([]);
      setOpenTrades([]);
      setRunResult(null);
      setBriefing(null);
    } catch {}
    setResetting(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-20 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  const equity = (config?.paperBalance || 10000) + (stats?.totalPnl || 0);
  const pnlPct = config?.paperBalance ? ((stats?.totalPnl || 0) / config.paperBalance * 100) : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 animate-fade-slide-up">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl transition-all ${
            config?.enabled
              ? "gold-gradient-bg border border-amber-500/20 koshpilot-glow"
              : "bg-gray-800"
          }`}>
            <Navigation size={24} className={config?.enabled ? "text-amber-400" : "text-gray-500"} />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className={config?.enabled ? "gold-gradient-text" : "text-white"}>KoshPilot</span>
              {config?.enabled && (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                </span>
              )}
            </h1>
            <p className="text-gray-500 text-sm flex items-center gap-2 flex-wrap">
              Your AI co-pilot for the markets
              <Badge variant={config?.mode === "PAPER" ? "yellow" : "green"}>
                {config?.mode === "PAPER" ? "Sandbox" : "LIVE"}
              </Badge>
              {!config?.enabled && <Badge variant="gray">Paused</Badge>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={config?.enabled ? "danger" : "primary"}
            onClick={toggleEnabled}
            loading={toggling}
          >
            {config?.enabled ? <><PowerOff size={14} /> Disable</> : <><Power size={14} /> Enable</>}
          </Button>
          <button
            onClick={runNow}
            disabled={!config?.enabled || running}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
              !config?.enabled || running
                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                : "koshpilot-btn text-black"
            }`}
          >
            <RefreshCw size={14} className={running ? "animate-spin" : ""} />
            {running ? "Scanning..." : "Run Now"}
          </button>
          <Button size="sm" variant="secondary" onClick={() => setShowSettings(!showSettings)}>
            <Settings size={14} />
          </Button>
        </div>
      </div>

      {/* How It Works - collapsible for returning users */}
      <div className="animate-fade-slide-up-1">
        <button
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          className="flex items-center gap-2 text-sm text-amber-400/70 hover:text-amber-400 transition-colors"
        >
          {showHowItWorks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          How KoshPilot Works
        </button>
        {showHowItWorks && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            {HOW_IT_WORKS.map((item, i) => (
              <Card key={item.title} className={`!p-3 space-y-1.5 animate-fade-slide-up-${i + 1}`}>
                <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}>
                  <item.icon size={16} className={item.color} />
                </div>
                <h4 className="text-white font-semibold text-xs">{item.title}</h4>
                <p className="text-gray-500 text-[10px] leading-relaxed">{item.description}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-fade-slide-up-2">
        <Card className="!p-4 text-center md:col-span-1 gold-gradient-bg border-amber-500/10 koshpilot-border">
          <Wallet size={18} className="mx-auto text-amber-400 mb-1" />
          <p className="text-xl font-bold text-white">
            ${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-amber-400/60">
            {config?.mode === "PAPER" ? "Simulation Balance" : "Portfolio"}
          </p>
          {config?.mode === "PAPER" && (stats?.totalPnl || 0) !== 0 && (
            <p className={`text-[10px] mt-0.5 ${pnlPct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}% from ${(config?.paperBalance || 10000).toLocaleString()}
            </p>
          )}
        </Card>
        <Card className="!p-4 text-center">
          <DollarSign size={18} className="mx-auto text-gray-500 mb-1" />
          <p className={`text-xl font-bold ${(stats?.totalPnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {(stats?.totalPnl || 0) >= 0 ? "+" : ""}${(stats?.totalPnl || 0).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500">Total P&L</p>
        </Card>
        <Card className="!p-4 text-center">
          <Target size={18} className="mx-auto text-gray-500 mb-1" />
          <p className="text-xl font-bold text-white">{stats?.winRate || 0}%</p>
          <p className="text-xs text-gray-500">Hit Rate</p>
        </Card>
        <Card className="!p-4 text-center">
          <BarChart3 size={18} className="mx-auto text-gray-500 mb-1" />
          <p className="text-xl font-bold text-white">{stats?.totalTrades || 0}</p>
          <p className="text-xs text-gray-500">Total Trades</p>
        </Card>
        <Card className="!p-4 text-center">
          <Activity size={18} className="mx-auto text-gray-500 mb-1" />
          <p className="text-xl font-bold text-amber-400">{stats?.openPositions || 0}</p>
          <p className="text-xs text-gray-500">Open Positions</p>
        </Card>
      </div>

      {/* Mission Report (Run Result) */}
      {runResult && (
        <Card className={`!p-4 animate-fade-slide-up ${
          runResult.status === "ERROR" ? "bg-red-500/5 border-red-500/20"
            : runResult.status === "SKIPPED" ? "bg-amber-500/5 border-amber-500/20"
              : "gold-gradient-bg border-amber-500/20"
        }`}>
          <div className="flex items-start gap-3">
            {runResult.status === "ERROR" ? (
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
            ) : runResult.status === "SKIPPED" ? (
              <Clock size={18} className="text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <Navigation size={18} className="text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="text-sm flex-1">
              {runResult.status === "ERROR" ? (
                <p className="text-red-300">{runResult.reason || runResult.error}</p>
              ) : runResult.status === "SKIPPED" ? (
                <p className="text-amber-300">{runResult.reason}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-amber-300 font-medium">Mission Report</p>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="flex items-center gap-1.5 bg-gray-800/50 rounded-lg px-2.5 py-1.5">
                      <Search size={12} className="text-amber-400" />
                      <span className="text-white font-medium">{runResult.scanned || 0}</span>
                      <span className="text-gray-500">scanned</span>
                    </span>
                    <span className="flex items-center gap-1.5 bg-gray-800/50 rounded-lg px-2.5 py-1.5">
                      <Brain size={12} className="text-amber-400" />
                      <span className="text-white font-medium">{runResult.signalsFound || 0}</span>
                      <span className="text-gray-500">signals</span>
                    </span>
                    <span className="flex items-center gap-1.5 bg-gray-800/50 rounded-lg px-2.5 py-1.5">
                      <TrendingUp size={12} className="text-emerald-400" />
                      <span className="text-white font-medium">{runResult.tradesExecuted || 0}</span>
                      <span className="text-gray-500">trades</span>
                    </span>
                    {(runResult.exitsExecuted || 0) > 0 && (
                      <span className="flex items-center gap-1.5 bg-gray-800/50 rounded-lg px-2.5 py-1.5">
                        <DollarSign size={12} className="text-gray-400" />
                        <span className="text-white font-medium">{runResult.exitsExecuted}</span>
                        <span className="text-gray-500">exits</span>
                      </span>
                    )}
                  </div>
                  {runResult.details && runResult.details.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {runResult.details.slice(0, 5).map((d: any, i: number) => (
                        <div key={i} className="text-xs text-gray-400 flex items-center gap-2">
                          <Badge variant={d.action === "BUY" ? "green" : d.action === "SELL" ? "red" : "gray"}>
                            {d.action}
                          </Badge>
                          <span className="text-white font-medium">{d.ticker}</span>
                          {d.qty && <span>{d.qty} shares @ ${d.price?.toFixed(2)}</span>}
                          {d.reason && <span className="text-gray-600">- {d.reason}</span>}
                        </div>
                      ))}
                      {runResult.details.length > 5 && (
                        <p className="text-gray-600 text-xs">+ {runResult.details.length - 5} more actions</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => setRunResult(null)} className="ml-auto text-gray-600 hover:text-gray-400 shrink-0">
              <X size={14} />
            </button>
          </div>
        </Card>
      )}

      {/* Not enabled prompt */}
      {!config?.enabled && (
        <Card className="!p-5 gold-gradient-bg border-amber-500/20 text-center space-y-3">
          <Navigation size={40} className="mx-auto text-amber-400 koshpilot-pulse" />
          <div>
            <p className="text-white font-semibold">KoshPilot is on standby</p>
            <p className="text-gray-400 text-sm mt-1">
              Click <span className="text-amber-400 font-medium">Enable</span> above to launch your AI co-pilot.
              It will scan your watchlist for opportunities during market hours.
            </p>
          </div>
          <button onClick={toggleEnabled} className="px-6 py-3 rounded-xl font-semibold koshpilot-btn text-black inline-flex items-center gap-2">
            {toggling ? <RefreshCw size={16} className="animate-spin" /> : <><Power size={16} /> Launch KoshPilot</>}
          </button>
        </Card>
      )}

      {/* Settings Panel */}
      {showSettings && config && (
        <Card className="space-y-4 animate-fade-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-400/80">KoshPilot Settings</h3>
            <Button size="sm" variant="secondary" onClick={resetSetup} loading={resetting}>
              <RotateCcw size={12} /> Re-run Setup
            </Button>
          </div>

          {/* Mode Switch Card */}
          <Card className={`!p-4 ${
            config.mode === "PAPER"
              ? "bg-amber-500/5 border-amber-500/15"
              : "bg-emerald-500/5 border-emerald-500/15"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {config.mode === "PAPER" ? (
                  <Plane size={20} className="text-amber-400" />
                ) : (
                  <DollarSign size={20} className="text-emerald-400" />
                )}
                <div>
                  <p className="text-white text-sm font-semibold">
                    {config.mode === "PAPER" ? "Simulation Mode" : "Live Trading"}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {config.mode === "PAPER"
                      ? "Trading with virtual capital — no real money at risk"
                      : "Trading with real money via Alpaca"}
                  </p>
                </div>
              </div>
              {config.mode === "PAPER" && (
                <button
                  onClick={() => setShowModeSwitchConfirm(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                >
                  Switch to Live
                </button>
              )}
            </div>
          </Card>

          {/* Mode Switch Confirmation */}
          {showModeSwitchConfirm && (
            <Card className="!p-4 bg-red-500/5 border-red-500/20 space-y-3">
              <div className="flex gap-3">
                <Lock size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 text-sm font-medium">Live Trading is not enabled for your profile yet</p>
                  <p className="text-red-400/60 text-xs mt-1">
                    Complete at least 2 weeks of simulation trading and contact support to request live trading access.
                    When enabled, you&apos;ll need to connect your Alpaca brokerage API keys.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setShowModeSwitchConfirm(false)}>
                Got it
              </Button>
            </Card>
          )}

          {config.mode === "PAPER" && (
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Simulation Capital</label>
              <div className="flex flex-wrap gap-2">
                {BALANCE_OPTIONS.map(({ amount, label }) => (
                  <button
                    key={amount}
                    onClick={() => updateConfig({ paperBalance: amount })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      config.paperBalance === amount
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    ${amount.toLocaleString()} {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Max Position %</label>
              <select
                value={config.maxPositionPct}
                onChange={(e) => updateConfig({ maxPositionPct: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
              >
                {[2, 3, 5, 8, 10].map((v) => (
                  <option key={v} value={v}>{v}% per trade</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Max Daily Loss %</label>
              <select
                value={config.maxDailyLossPct}
                onChange={(e) => updateConfig({ maxDailyLossPct: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
              >
                {[1, 2, 3, 5].map((v) => (
                  <option key={v} value={v}>{v}% max loss/day</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Max Open Positions</label>
              <select
                value={config.maxOpenPositions}
                onChange={(e) => updateConfig({ maxOpenPositions: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
              >
                {[3, 5, 8, 10].map((v) => (
                  <option key={v} value={v}>{v} positions</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Watchlist ({config.watchlist.length} stocks)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {config.watchlist.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 bg-gray-800 rounded px-2 py-1 text-xs text-gray-300">
                  <StockLogo ticker={t} size={14} /> {t}
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* AI Briefing */}
      <Card className="space-y-3 animate-fade-slide-up-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-gray-400">AI Pre-Market Briefing</h3>
          </div>
          <Button size="sm" variant="secondary" onClick={getBriefing}>
            Get Briefing
          </Button>
        </div>
        {briefing ? (
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{briefing}</p>
        ) : (
          <p className="text-xs text-gray-600">Click to get today&apos;s AI analysis of your watchlist</p>
        )}
      </Card>

      {/* Open Positions */}
      {openTrades.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <TrendingUp size={18} className="text-amber-400" />
            Open Positions ({openTrades.length})
          </h2>
          <div className="space-y-2">
            {openTrades.map((trade) => (
              <Card key={trade.id} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <StockLogo ticker={trade.ticker} size={32} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{trade.ticker}</span>
                      <Badge variant="green">{trade.qty} shares</Badge>
                      {trade.strategy && <Badge variant="gray">{trade.strategy}</Badge>}
                    </div>
                    <p className="text-xs text-gray-500">
                      Entry ${trade.entryPrice?.toFixed(2) || "\u2014"} |
                      Stop ${trade.stopLoss?.toFixed(2) || "\u2014"} |
                      Target ${trade.takeProfit?.toFixed(2) || "\u2014"}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {trade.aiConfidence && (
                    <p className="text-xs text-gray-500">AI: {trade.aiConfidence.toFixed(0)}%</p>
                  )}
                  <p className="text-xs text-gray-600">
                    {trade.entryAt ? new Date(trade.entryAt).toLocaleDateString() : "\u2014"}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Trade History */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Clock size={18} className="text-gray-400" />
          Trade History
        </h2>
        {trades.length === 0 ? (
          <Card className="text-center py-8">
            <BarChart3 size={32} className="mx-auto text-gray-700 mb-2" />
            <p className="text-gray-500 text-sm">No completed trades yet</p>
            <p className="text-gray-600 text-xs mt-1">
              {config?.enabled
                ? "KoshPilot will start trading when it finds high-conviction setups during market hours"
                : "Enable KoshPilot to start scanning for trades"}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {trades.map((trade) => (
              <Card key={trade.id} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <StockLogo ticker={trade.ticker} size={28} className="rounded-md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm">{trade.ticker}</span>
                      <span className="text-xs text-gray-500">{trade.qty} shares</span>
                      {trade.strategy && <Badge variant="gray">{trade.strategy}</Badge>}
                    </div>
                    <p className="text-xs text-gray-600">
                      ${trade.entryPrice?.toFixed(2) || "\u2014"} &rarr; ${trade.exitPrice?.toFixed(2) || "\u2014"}
                      {trade.exitReason && ` \u00b7 ${trade.exitReason}`}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${(trade.pnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(trade.pnl || 0) >= 0 ? "+" : ""}${(trade.pnl || 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-600">
                    {trade.exitAt ? new Date(trade.exitAt).toLocaleDateString() : "\u2014"}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
