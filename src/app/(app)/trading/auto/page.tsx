"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import StockLogo from "@/components/ui/StockLogo";
import {
  Bot, Power, PowerOff, TrendingUp, DollarSign,
  BarChart3, Target, Clock, Activity, RefreshCw, Settings, Zap,
  Search, Brain, ShieldCheck, ArrowRight, ArrowLeft, Sparkles,
  Play, X, Plus, ChevronRight,
} from "lucide-react";

interface TradingConfig {
  enabled: boolean;
  mode: string;
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

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD", "NFLX", "JPM"];

const HOW_IT_WORKS = [
  {
    icon: Search,
    title: "Scans the Market",
    description: "Every hour, the AI scans 10+ stocks for technical signals — RSI, MACD, Bollinger Bands, VWAP, and more.",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    icon: Brain,
    title: "AI Analysis",
    description: "Claude AI scores each opportunity with a conviction rating (0-100%) based on technical and fundamental context.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: Zap,
    title: "Auto Executes",
    description: "When a high-conviction setup is found, it automatically places trades via Alpaca — with stop-losses and take-profits.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: ShieldCheck,
    title: "Risk Protection",
    description: "Built-in guardrails: max position sizing, daily loss caps, PDT compliance, and portfolio-level limits.",
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
];

function OnboardingFlow({ onComplete }: { onComplete: (config: TradingConfig) => void }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"PAPER" | "LIVE">("PAPER");
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
      {/* Progress indicator */}
      <div className="flex items-center gap-2 justify-center">
        {[0, 1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => { if (s < step) setStep(s); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                s === step
                  ? "bg-indigo-500 text-white scale-110"
                  : s < step
                    ? "bg-emerald-500/20 text-emerald-400 cursor-pointer"
                    : "bg-gray-800 text-gray-600"
              }`}
            >
              {s < step ? "✓" : s + 1}
            </button>
            {s < 2 && (
              <div className={`w-12 h-0.5 ${s < step ? "bg-emerald-500/40" : "bg-gray-800"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: How It Works */}
      {step === 0 && (
        <div className="space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto">
              <Bot size={32} className="text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Meet Your AutoTrader</h1>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              An AI-powered trading assistant that scans, analyzes, and executes trades for you — completely hands-free.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {HOW_IT_WORKS.map((item) => (
              <Card key={item.title} className="!p-4 space-y-2">
                <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center`}>
                  <item.icon size={20} className={item.color} />
                </div>
                <h3 className="text-white font-semibold text-sm">{item.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{item.description}</p>
              </Card>
            ))}
          </div>

          <Card className="!p-4 bg-amber-500/5 border-amber-500/20">
            <div className="flex gap-3">
              <Sparkles size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 text-sm font-medium">Recommended: Start with Paper Trading</p>
                <p className="text-amber-400/60 text-xs mt-1">
                  Run the bot with virtual money for 2-4 weeks to see how it performs before going live.
                </p>
              </div>
            </div>
          </Card>

          <Button className="w-full" onClick={() => setStep(1)}>
            Get Started <ArrowRight size={16} />
          </Button>
        </div>
      )}

      {/* Step 1: Choose Mode */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-white">Choose Trading Mode</h2>
            <p className="text-gray-400 text-sm">You can switch between modes anytime from settings.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setMode("PAPER")}
              className={`text-left p-5 rounded-2xl border-2 transition-all ${
                mode === "PAPER"
                  ? "border-emerald-500 bg-emerald-500/5"
                  : "border-gray-800 bg-gray-900/50 hover:border-gray-700"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Play size={20} className="text-emerald-400" />
                </div>
                {mode === "PAPER" && (
                  <Badge variant="green">Recommended</Badge>
                )}
              </div>
              <h3 className="text-white font-bold mb-1">Paper Trading</h3>
              <p className="text-gray-500 text-xs leading-relaxed">
                Practice with virtual money. Zero risk. See real market performance without putting capital at stake.
              </p>
              <ul className="mt-3 space-y-1.5">
                {["No real money at risk", "Real market data & signals", "Track performance over time"].map((item) => (
                  <li key={item} className="text-xs text-gray-400 flex items-center gap-2">
                    <ChevronRight size={12} className="text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </button>

            <button
              onClick={() => setMode("LIVE")}
              className={`text-left p-5 rounded-2xl border-2 transition-all ${
                mode === "LIVE"
                  ? "border-amber-500 bg-amber-500/5"
                  : "border-gray-800 bg-gray-900/50 hover:border-gray-700"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <DollarSign size={20} className="text-amber-400" />
                </div>
                {mode === "LIVE" && (
                  <Badge variant="yellow">Advanced</Badge>
                )}
              </div>
              <h3 className="text-white font-bold mb-1">Live Trading</h3>
              <p className="text-gray-500 text-xs leading-relaxed">
                Trade with real money through your Alpaca brokerage account. Requires API keys configured.
              </p>
              <ul className="mt-3 space-y-1.5">
                {["Real money execution", "Alpaca API required", "Start small, scale up"].map((item) => (
                  <li key={item} className="text-xs text-gray-400 flex items-center gap-2">
                    <ChevronRight size={12} className="text-amber-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </button>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(0)}>
              <ArrowLeft size={16} /> Back
            </Button>
            <Button className="flex-1" onClick={() => setStep(2)}>
              Continue <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-white">Configure Your Bot</h2>
            <p className="text-gray-400 text-sm">Set your preferences. You can always change these later.</p>
          </div>

          {/* Watchlist */}
          <Card className="space-y-3">
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

          {/* Risk Settings */}
          <Card className="space-y-4">
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
                <p className="text-[10px] text-gray-600 mt-1">Bot stops if daily loss hits limit</p>
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

          {/* Summary */}
          <Card className="!p-4 bg-indigo-500/5 border-indigo-500/20">
            <div className="flex items-start gap-3">
              <Bot size={18} className="text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-xs text-gray-400 space-y-1">
                <p>
                  <span className="text-white font-medium">Mode:</span>{" "}
                  {mode === "PAPER" ? "Paper Trading (virtual money)" : "Live Trading (real money)"}
                </p>
                <p>
                  <span className="text-white font-medium">Watching:</span>{" "}
                  {watchlist.length} stocks
                </p>
                <p>
                  <span className="text-white font-medium">Risk:</span>{" "}
                  {maxPositionPct}% max position, {maxDailyLossPct}% daily loss cap, {maxOpenPositions} max positions
                </p>
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Back
            </Button>
            <Button
              className="flex-1"
              onClick={handleFinish}
              loading={submitting}
              disabled={watchlist.length === 0}
            >
              <Zap size={16} /> Start AutoTrader
            </Button>
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
  const [toggling, setToggling] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);

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
    try {
      await fetch("/api/trading/auto", { method: "POST" });
      await fetchData();
    } catch {}
    setRunning(false);
  };

  const getBriefing = async () => {
    try {
      const res = await fetch("/api/trading/auto?action=briefing", { method: "POST" });
      const data = await res.json();
      setBriefing(data.briefing);
    } catch {}
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

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${config?.enabled ? "bg-emerald-500/10" : "bg-gray-800"}`}>
            <Bot size={24} className={config?.enabled ? "text-emerald-400" : "text-gray-500"} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              AutoTrader
              {config?.enabled && (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
              )}
            </h1>
            <p className="text-gray-500 text-sm">
              AI-powered autonomous swing trading
              {config?.mode && (
                <Badge variant={config.mode === "PAPER" ? "green" : "yellow"} className="ml-2">
                  {config.mode}
                </Badge>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={config?.enabled ? "danger" : "primary"}
            onClick={toggleEnabled}
            loading={toggling}
          >
            {config?.enabled ? <><PowerOff size={14} /> Disable</> : <><Power size={14} /> Enable</>}
          </Button>
          <Button size="sm" variant="secondary" onClick={runNow} loading={running} disabled={!config?.enabled}>
            <RefreshCw size={14} /> Run Now
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowSettings(!showSettings)}>
            <Settings size={14} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="!p-4 text-center">
            <DollarSign size={18} className="mx-auto text-gray-500 mb-1" />
            <p className={`text-xl font-bold ${stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">Total P&L</p>
          </Card>
          <Card className="!p-4 text-center">
            <Target size={18} className="mx-auto text-gray-500 mb-1" />
            <p className="text-xl font-bold text-white">{stats.winRate}%</p>
            <p className="text-xs text-gray-500">Win Rate</p>
          </Card>
          <Card className="!p-4 text-center">
            <BarChart3 size={18} className="mx-auto text-gray-500 mb-1" />
            <p className="text-xl font-bold text-white">{stats.totalTrades}</p>
            <p className="text-xs text-gray-500">Total Trades</p>
          </Card>
          <Card className="!p-4 text-center">
            <Activity size={18} className="mx-auto text-gray-500 mb-1" />
            <p className="text-xl font-bold text-indigo-400">{stats.openPositions}</p>
            <p className="text-xs text-gray-500">Open Positions</p>
          </Card>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && config && (
        <Card className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400">AutoTrader Settings</h3>
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
            <p className="text-xs text-gray-600">
              {config.watchlist.join(", ")}
            </p>
          </div>
        </Card>
      )}

      {/* AI Briefing */}
      <Card className="space-y-3">
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
            <TrendingUp size={18} className="text-emerald-400" />
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
              {config?.enabled ? "The bot will start trading when it finds good setups" : "Enable the AutoTrader to start"}
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
