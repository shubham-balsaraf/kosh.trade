"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import StockLogo from "@/components/ui/StockLogo";
import {
  Bot, Power, PowerOff, TrendingUp, TrendingDown, DollarSign,
  BarChart3, Target, Clock, Activity, RefreshCw, Settings, Zap,
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

export default function AutoTradingPage() {
  const [config, setConfig] = useState<TradingConfig | null>(null);
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
      const [configRes, statsRes, tradesRes, openRes] = await Promise.all([
        fetch("/api/trading/auto?action=config"),
        fetch("/api/trading/auto?action=stats"),
        fetch("/api/trading/auto?action=trades&status=CLOSED"),
        fetch("/api/trading/auto?action=trades&status=OPEN"),
      ]);
      const [configData, statsData, tradesData, openData] = await Promise.all([
        configRes.json(),
        statsRes.json(),
        tradesRes.json(),
        openRes.json(),
      ]);
      setConfig(configData);
      setStats(statsData);
      setTrades(tradesData.trades || []);
      setOpenTrades(openData.trades || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
          <p className="text-xs text-gray-600">Click to get today's AI analysis of your watchlist</p>
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
                      Entry ${trade.entryPrice?.toFixed(2) || "—"} |
                      Stop ${trade.stopLoss?.toFixed(2) || "—"} |
                      Target ${trade.takeProfit?.toFixed(2) || "—"}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {trade.aiConfidence && (
                    <p className="text-xs text-gray-500">AI: {trade.aiConfidence.toFixed(0)}%</p>
                  )}
                  <p className="text-xs text-gray-600">
                    {trade.entryAt ? new Date(trade.entryAt).toLocaleDateString() : "—"}
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
                      ${trade.entryPrice?.toFixed(2) || "—"} → ${trade.exitPrice?.toFixed(2) || "—"}
                      {trade.exitReason && ` · ${trade.exitReason}`}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${(trade.pnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(trade.pnl || 0) >= 0 ? "+" : ""}${(trade.pnl || 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-600">
                    {trade.exitAt ? new Date(trade.exitAt).toLocaleDateString() : "—"}
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
