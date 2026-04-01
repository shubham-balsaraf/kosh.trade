"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import StockLogo from "@/components/ui/StockLogo";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart3, TrendingUp, TrendingDown, Globe, Users, Target,
  ChevronDown, ChevronUp, Radar, Search, Brain, Activity,
  Zap, Shield, ArrowUpRight, ArrowDownRight, Flame, Mountain, Gem, Clock,
  CheckCircle2, Loader2, BarChart2, Gauge, Waves, LineChart,
  Newspaper, AlertTriangle, Sparkles, ExternalLink,
  Building2, FileText, GitMerge, Landmark, Scale, Coins,
} from "lucide-react";

const STRATEGY_INFO: Record<string, { label: string; technical: string; simple: string; icon: typeof Zap; color: string }> = {
  MOMENTUM: {
    label: "Momentum",
    technical: "Buys when price is above SMA20 & SMA50 with a golden cross confirmed. Targets stocks with strong trend alignment, bullish MACD, and healthy volume confirmation.",
    simple: "Think of it like surfing — this strategy catches stocks that are already riding a big wave up and hops on before the wave is done. If everyone's buying, there's probably a good reason.",
    icon: TrendingUp,
    color: "blue",
  },
  MEAN_REVERSION: {
    label: "Mean Reversion",
    technical: "Triggers when RSI drops below 35, indicating oversold conditions. Expects a snap-back toward the moving average — a contrarian play on short-term mispricing with tight stop-losses.",
    simple: "This is the \"buy the dip\" strategy, but smarter. When a good stock gets beaten down too hard and too fast, it usually bounces back. This catches that bounce before everyone else notices.",
    icon: Waves,
    color: "purple",
  },
  SWING: {
    label: "Swing",
    technical: "Uses a composite of RSI, MACD, Bollinger Bands, volume, and trend indicators when no single strategy dominates. Flexible multi-day holds between support and resistance zones.",
    simple: "The all-rounder. When the market isn't screaming a clear direction, this strategy reads the room and makes calculated plays on stocks that are bouncing between predictable price levels.",
    icon: LineChart,
    color: "amber",
  },
};

function StrategyTooltip({ strategy, children }: { strategy: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const info = STRATEGY_INFO[strategy];
  if (!info) return <>{children}</>;

  const Icon = info.icon;
  const borderCls = info.color === "blue" ? "border-blue-500/30" : info.color === "purple" ? "border-purple-500/30" : "border-amber-500/30";
  const iconCls = info.color === "blue" ? "text-blue-400" : info.color === "purple" ? "text-purple-400" : "text-amber-400";
  const titleCls = info.color === "blue" ? "text-blue-300" : info.color === "purple" ? "text-purple-300" : "text-amber-300";

  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className={`absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 p-3.5 rounded-xl border bg-[#0d0f14] shadow-2xl shadow-black/60 ${borderCls} animate-fade-slide-up`}>
          <div className="flex items-center gap-2 mb-2.5">
            <Icon size={14} className={iconCls} />
            <span className={`font-bold text-xs ${titleCls}`}>{info.label} Strategy</span>
          </div>
          <p className="text-[10px] leading-relaxed text-white/50 font-medium">{info.technical}</p>
          <div className={`mt-2.5 pt-2.5 border-t ${borderCls}`}>
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/20">in plain english</span>
            <p className="text-[10.5px] leading-relaxed text-white/60 mt-1 italic">{info.simple}</p>
          </div>
          <div className={`absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 rotate-45 border-b border-r bg-[#0d0f14] ${borderCls} -mt-1`} />
        </div>
      )}
    </div>
  );
}

interface ScanStep {
  icon: typeof Zap;
  text: string;
  done: boolean;
  active: boolean;
}

function ScanLoadingAnimation({ type }: { type: "market" | "picks" | "intelligence" }) {
  const [steps, setSteps] = useState<ScanStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const marketSteps = [
    { icon: Search, text: "Scanning 20 stocks across Tech, Finance, Healthcare, Energy..." },
    { icon: BarChart2, text: "Computing RSI, MACD, and Bollinger Bands for each..." },
    { icon: TrendingUp, text: "Analyzing trend alignment — SMA 20, SMA 50, EMA 9..." },
    { icon: Activity, text: "Measuring volume spikes and VWAP deviation..." },
    { icon: Gauge, text: "Scoring momentum and support/resistance levels..." },
    { icon: Radar, text: "Discovering opportunities from news, congress, insiders..." },
    { icon: Brain, text: "Ranking and filtering the strongest signals..." },
  ];

  const picksSteps = [
    { icon: Newspaper, text: "Scanning news, press releases, insider trades, analyst grades..." },
    { icon: Landmark, text: "Pulling Senate/House trades, M&A deals, 8-K filings..." },
    { icon: Building2, text: "Checking institutional 13F moves and sector performance..." },
    { icon: Radar, text: "Identifying signal-driven stocks from 12+ sources..." },
    { icon: BarChart2, text: "Running 8 technical indicators on every discovered stock..." },
    { icon: Zap, text: "Classifying Sprint picks — momentum, oversold bounces, catalysts..." },
    { icon: TrendingUp, text: "Finding Marathon picks — golden crosses, steady uptrends..." },
    { icon: Gem, text: "Spotting Legacy picks — deep value, accumulation zones..." },
    { icon: Brain, text: "Ranking picks by signal strength and technical conviction..." },
  ];

  const intelligenceSteps = [
    { icon: Newspaper, text: "Reading live market news, press releases, and crypto headlines..." },
    { icon: Users, text: "Checking insider purchases and whale activity..." },
    { icon: Landmark, text: "Scanning Senate & House trades — political money flow..." },
    { icon: Scale, text: "Pulling analyst upgrades/downgrades and price targets..." },
    { icon: BarChart2, text: "Analyzing top gainers, losers, and most active stocks..." },
    { icon: Globe, text: "Reading sector performance and industry rotation..." },
    { icon: GitMerge, text: "Checking M&A deals, 8-K filings, and institutional 13F moves..." },
    { icon: Clock, text: "Reviewing upcoming earnings and catalyst events..." },
    { icon: Brain, text: "AI cross-referencing 12+ signal sources for narratives..." },
    { icon: Sparkles, text: "Identifying affected stocks and running technical snapshots..." },
    { icon: Target, text: "Generating trade implications for each narrative..." },
  ];

  const allSteps = type === "market" ? marketSteps : type === "picks" ? picksSteps : intelligenceSteps;

  useEffect(() => {
    setSteps(allSteps.map((s) => ({ ...s, done: false, active: false })));
    setCurrentStep(0);

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next > allSteps.length) {
          clearInterval(interval);
          return prev;
        }
        return next;
      });
    }, 600);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    setSteps(allSteps.map((s, i) => ({
      ...s,
      done: i < currentStep,
      active: i === currentStep,
    })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const pulseClass = type === "market" ? "text-purple-400" : type === "picks" ? "text-orange-400" : "text-cyan-400";

  return (
    <div className="py-6 px-4">
      <div className="flex items-center justify-center gap-3 mb-6">
        <Loader2 size={18} className={`${pulseClass} animate-spin`} />
        <span className={`text-sm font-semibold ${pulseClass}`}>
          {type === "market" ? "Scanning Market" : type === "picks" ? "Finding Best Picks" : "Analyzing Signals"}
        </span>
      </div>

      <div className="space-y-2 max-w-md mx-auto">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-500 ${
                step.done
                  ? "opacity-100 bg-white/[0.02]"
                  : step.active
                  ? "opacity-100 bg-white/[0.04] border border-white/[0.06]"
                  : "opacity-0 translate-y-2"
              }`}
              style={{ transitionDelay: `${i * 50}ms` }}
            >
              {step.done ? (
                <CheckCircle2 size={15} className="text-emerald-400/70 shrink-0" />
              ) : step.active ? (
                <Icon size={15} className={`${pulseClass} shrink-0 animate-pulse`} />
              ) : (
                <div className="w-[15px] h-[15px] shrink-0" />
              )}
              <span className={`text-xs leading-snug ${
                step.done ? "text-white/30" : step.active ? "text-white/60" : "text-white/15"
              }`}>
                {step.text}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center mt-6 gap-1">
        {allSteps.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i < currentStep ? "w-6 bg-emerald-400/50" : i === currentStep ? `w-6 ${type === "market" ? "bg-purple-400/50" : type === "picks" ? "bg-orange-400/50" : "bg-cyan-400/50"} animate-pulse` : "w-2 bg-white/[0.06]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

interface MarketNarrative {
  id: string;
  headline: string;
  narrative: string;
  sector: string;
  sentiment: "bullish" | "bearish" | "mixed";
  impact: number;
  affectedTickers: string[];
  triggerTickers: string[];
  timeframe: "immediate" | "short-term" | "medium-term" | "structural";
  tradeImplication: string;
}

interface TickerTechnical {
  price: number;
  action: string;
  score: number;
  confidence: number;
  strategy: string;
  rsi: number;
  changePercent: number;
  volumeRatio: number;
}

const SENTIMENT_STYLE = {
  bullish: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", icon: TrendingUp, label: "Bullish" },
  bearish: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", icon: TrendingDown, label: "Bearish" },
  mixed: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", icon: AlertTriangle, label: "Mixed" },
} as const;

const TIMEFRAME_LABEL: Record<string, string> = {
  immediate: "Hours – Days",
  "short-term": "Days – Weeks",
  "medium-term": "Weeks – Months",
  structural: "Months – Years",
};

function NarrativeCard({ narrative, technicals }: { narrative: MarketNarrative; technicals: Record<string, TickerTechnical> }) {
  const [expanded, setExpanded] = useState(false);
  const style = SENTIMENT_STYLE[narrative.sentiment];
  const SentIcon = style.icon;
  const impactBars = Math.min(5, Math.ceil(narrative.impact / 2));

  return (
    <div
      className={`rounded-xl border transition-all duration-300 cursor-pointer ${
        expanded ? `${style.border} bg-white/[0.03]` : "border-white/[0.04] bg-white/[0.015] hover:border-white/[0.08]"
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`shrink-0 w-9 h-9 rounded-lg ${style.bg} flex items-center justify-center`}>
            <SentIcon size={16} className={style.text} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-bold text-white/90 leading-snug">{narrative.headline}</h3>
            <div className="flex items-center flex-wrap gap-2 mt-1.5">
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${style.bg} ${style.text} border ${style.border}`}>
                {style.label}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-white/[0.04] text-white/30 border border-white/[0.06]">
                {narrative.sector}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-white/[0.04] text-white/25 border border-white/[0.06]">
                {TIMEFRAME_LABEL[narrative.timeframe] || narrative.timeframe}
              </span>
              <div className="flex items-center gap-0.5 ml-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`w-1 h-3 rounded-sm ${i < impactBars ? style.text.replace("text-", "bg-") + "/60" : "bg-white/[0.06]"}`} />
                ))}
              </div>
            </div>
          </div>
          <div className="shrink-0">
            {expanded ? <ChevronUp size={14} className="text-white/20" /> : <ChevronDown size={14} className="text-white/20" />}
          </div>
        </div>

        {/* Stock bubbles — always visible */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {narrative.affectedTickers.map((ticker) => {
            const tech = technicals[ticker];
            const isBuy = tech?.action === "BUY" || tech?.action === "STRONG_BUY";
            const isSell = tech?.action === "SELL" || tech?.action === "STRONG_SELL";
            const isTrigger = narrative.triggerTickers.includes(ticker);
            return (
              <div
                key={ticker}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                  isTrigger
                    ? "bg-purple-500/10 border-purple-500/20 text-purple-300/80"
                    : isBuy
                    ? "bg-emerald-500/[0.06] border-emerald-500/15 text-emerald-400/70"
                    : isSell
                    ? "bg-red-500/[0.06] border-red-500/15 text-red-400/70"
                    : "bg-white/[0.03] border-white/[0.06] text-white/40"
                }`}
              >
                <StockLogo ticker={ticker} size={14} />
                <span>{ticker}</span>
                {tech && (
                  <span className={`text-[8px] font-mono ${tech.changePercent >= 0 ? "text-emerald-400/50" : "text-red-400/50"}`}>
                    {tech.changePercent >= 0 ? "+" : ""}{tech.changePercent.toFixed(1)}%
                  </span>
                )}
                {isTrigger && <Sparkles size={8} className="text-purple-400/60" />}
              </div>
            );
          })}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-white/[0.04] space-y-3 animate-fade-slide-up">
          <p className="mt-3 text-[12px] text-white/45 leading-relaxed">{narrative.narrative}</p>

          {narrative.tradeImplication && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/[0.04] border border-blue-500/10">
              <Target size={12} className="text-blue-400/70 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-300/60 leading-relaxed">{narrative.tradeImplication}</p>
            </div>
          )}

          {/* Technical snapshots for affected tickers */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
            {narrative.affectedTickers.map((ticker) => {
              const tech = technicals[ticker];
              if (!tech) return null;
              const isBuy = tech.action === "BUY" || tech.action === "STRONG_BUY";
              const isSell = tech.action === "SELL" || tech.action === "STRONG_SELL";
              return (
                <div key={ticker} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <StockLogo ticker={ticker} size={14} />
                    <span className="text-[10px] font-bold text-white/60">{ticker}</span>
                    <span className={`text-[8px] px-1 py-px rounded font-semibold ml-auto ${
                      isBuy ? "bg-emerald-500/10 text-emerald-400/70" : isSell ? "bg-red-500/10 text-red-400/70" : "bg-white/[0.04] text-white/30"
                    }`}>{tech.action}</span>
                  </div>
                  <div className="text-[9px] text-white/25 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Price</span>
                      <span className="text-white/40 font-mono">${tech.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>RSI</span>
                      <span className={`font-mono ${tech.rsi < 30 || tech.rsi > 70 ? "text-amber-400/60" : "text-white/35"}`}>{tech.rsi.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Score</span>
                      <span className={`font-mono ${tech.score > 0 ? "text-emerald-400/50" : tech.score < 0 ? "text-red-400/50" : "text-white/30"}`}>{tech.score.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Volume</span>
                      <span className={`font-mono ${tech.volumeRatio > 2 ? "text-amber-400/60" : "text-white/35"}`}>{tech.volumeRatio.toFixed(1)}x</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface SignalIndicator {
  name: string;
  score: number;
  reason: string;
}

interface TechnicalSignal {
  ticker: string;
  price: number;
  action: string;
  score: number;
  confidence: number;
  strategy: string;
  stopLoss: number;
  takeProfit: number;
  indicators: SignalIndicator[];
  raw?: {
    rsi: number;
    macd: { macd: number; signal: number; histogram: number };
    bollinger: { upper: number; middle: number; lower: number; percentB: number };
    sma20: number;
    sma50: number;
    ema9: number;
    volumeRatio: number;
    atr: number;
    vwap: number;
    weekReturn: number;
    monthReturn: number;
    changePercent: number;
  };
  discoveryInfo?: { source: string; reason: string; urgency: number } | null;
}

interface HorizonInfo {
  horizon: "sprint" | "marathon" | "legacy";
  reason: string;
  score: number;
}

interface BestPick {
  ticker: string;
  price: number;
  action: string;
  score: number;
  confidence: number;
  strategy: string;
  stopLoss: number;
  takeProfit: number;
  indicators: SignalIndicator[];
  horizons: HorizonInfo[];
  discoveryInfo: { source: string; reason: string } | null;
  raw: {
    rsi: number;
    weekReturn: number;
    monthReturn: number;
    volumeRatio: number;
    changePercent: number;
  };
}

const HORIZON_META = {
  sprint: { label: "Sprint", sub: "< 1 Year", icon: Zap, color: "amber", gradient: "from-amber-500/10 to-orange-500/5", border: "border-amber-500/20" },
  marathon: { label: "Marathon", sub: "1 – 3 Years", icon: TrendingUp, color: "blue", gradient: "from-blue-500/10 to-cyan-500/5", border: "border-blue-500/20" },
  legacy: { label: "Legacy", sub: "3 – 10 Years", icon: Gem, color: "emerald", gradient: "from-emerald-500/10 to-teal-500/5", border: "border-emerald-500/20" },
} as const;

function PickCard({ pick, horizon }: { pick: BestPick; horizon: "sprint" | "marathon" | "legacy" }) {
  const [expanded, setExpanded] = useState(false);
  const meta = HORIZON_META[horizon];
  const horizonInfo = pick.horizons.find((h) => h.horizon === horizon);
  const otherHorizons = pick.horizons.filter((h) => h.horizon !== horizon);

  return (
    <div
      className={`rounded-xl border transition-all duration-300 cursor-pointer ${
        expanded ? `${meta.border} bg-white/[0.03]` : "border-white/[0.04] bg-white/[0.015] hover:border-white/[0.08]"
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-3 sm:p-4 flex items-center gap-3">
        <StockLogo ticker={pick.ticker} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/90 font-bold text-sm">{pick.ticker}</span>
            <Badge variant={pick.action === "STRONG_BUY" ? "green" : "green"}>
              {pick.action}
            </Badge>
            {pick.horizons.map((h) => {
              const m = HORIZON_META[h.horizon];
              const HIcon = m.icon;
              const colorClasses = h.horizon === "sprint"
                ? "bg-amber-500/10 text-amber-400/80 border-amber-500/20"
                : h.horizon === "marathon"
                ? "bg-blue-500/10 text-blue-400/80 border-blue-500/20"
                : "bg-emerald-500/10 text-emerald-400/80 border-emerald-500/20";
              return (
                <span key={h.horizon} className={`text-[9px] px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-1 border ${colorClasses}`}>
                  <HIcon size={9} />
                  {m.label}
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-white/25">
            <span className="text-white/50">${pick.price.toFixed(2)}</span>
            <span>Score: <span className="text-emerald-400/70">{pick.score.toFixed(1)}</span></span>
            <span>Conf: <span className="text-white/50">{pick.confidence}%</span></span>
            <StrategyTooltip strategy={pick.strategy}>
              <span className="text-white/20 cursor-help border-b border-dotted border-white/10">{pick.strategy}</span>
            </StrategyTooltip>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, j) => (
              <div
                key={j}
                className={`w-1.5 h-4 rounded-sm ${
                  j < Math.ceil(Math.abs(pick.score) / 10) ? "bg-emerald-400/60" : "bg-white/[0.06]"
                }`}
              />
            ))}
          </div>
          {expanded ? <ChevronUp size={14} className="text-white/20" /> : <ChevronDown size={14} className="text-white/20" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 sm:px-4 pb-4 pt-0 border-t border-white/[0.04] space-y-3 animate-fade-slide-up">
          {horizonInfo && (
            <div className={`mt-3 p-3 rounded-lg bg-gradient-to-r ${meta.gradient} border ${meta.border}`}>
              <div className="flex items-center gap-2 mb-1">
                <meta.icon size={13} className={
                  horizon === "sprint" ? "text-amber-400/80" : horizon === "marathon" ? "text-blue-400/80" : "text-emerald-400/80"
                } />
                <span className={`text-[11px] font-semibold ${
                  horizon === "sprint" ? "text-amber-400/80" : horizon === "marathon" ? "text-blue-400/80" : "text-emerald-400/80"
                }`}>Why {meta.label} ({meta.sub})</span>
              </div>
              <p className="text-[11px] text-white/40 leading-relaxed capitalize">{horizonInfo.reason}</p>
            </div>
          )}

          {otherHorizons.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {otherHorizons.map((h) => {
                const ohClasses = h.horizon === "sprint"
                  ? "bg-amber-500/[0.04] border-amber-500/10 text-amber-400/70"
                  : h.horizon === "marathon"
                  ? "bg-blue-500/[0.04] border-blue-500/10 text-blue-400/70"
                  : "bg-emerald-500/[0.04] border-emerald-500/10 text-emerald-400/70";
                const m = HORIZON_META[h.horizon];
                return (
                  <div key={h.horizon} className={`text-[10px] px-2.5 py-1.5 rounded-lg border ${ohClasses}`}>
                    <span className="font-medium">Also {m.label}:</span>{" "}
                    <span className="text-white/30 capitalize">{h.reason}</span>
                  </div>
                );
              })}
            </div>
          )}

          {pick.discoveryInfo && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-purple-500/[0.04] border border-purple-500/10">
              <Radar size={12} className="text-purple-400/70 shrink-0 mt-0.5" />
              <p className="text-[10px] text-purple-300/60 leading-relaxed">{pick.discoveryInfo.reason}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] text-white/25 uppercase tracking-wider font-semibold">Signal Breakdown</p>
            {pick.indicators.map((ind) => {
              const pct = Math.min(100, Math.abs(ind.score));
              return (
                <div key={ind.name} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30 w-20 shrink-0 text-right font-medium">{ind.name}</span>
                    <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          ind.score > 20 ? "bg-emerald-400/60" : ind.score > 0 ? "bg-emerald-400/30" : ind.score > -20 ? "bg-red-400/30" : "bg-red-400/60"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-[10px] w-8 text-right font-mono ${ind.score > 0 ? "text-emerald-400/50" : ind.score < 0 ? "text-red-400/50" : "text-white/20"}`}>
                      {ind.score > 0 ? "+" : ""}{ind.score.toFixed(0)}
                    </span>
                  </div>
                  <div className="ml-[88px] text-[9px] text-white/15">{ind.reason}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-5 gap-2 pt-1 border-t border-white/[0.04]">
            {[
              { label: "RSI", value: pick.raw.rsi.toFixed(0), warn: pick.raw.rsi < 30 || pick.raw.rsi > 70 },
              { label: "Volume", value: `${pick.raw.volumeRatio.toFixed(1)}x`, warn: pick.raw.volumeRatio > 2 },
              { label: "Day", value: `${pick.raw.changePercent >= 0 ? "+" : ""}${pick.raw.changePercent.toFixed(1)}%`, warn: Math.abs(pick.raw.changePercent) > 3 },
              { label: "Week", value: `${pick.raw.weekReturn >= 0 ? "+" : ""}${pick.raw.weekReturn.toFixed(1)}%`, warn: Math.abs(pick.raw.weekReturn) > 5 },
              { label: "Month", value: `${pick.raw.monthReturn >= 0 ? "+" : ""}${pick.raw.monthReturn.toFixed(1)}%`, warn: Math.abs(pick.raw.monthReturn) > 10 },
            ].map(({ label, value, warn }) => (
              <div key={label} className="text-center p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="text-[8px] text-white/20 uppercase">{label}</div>
                <div className={`text-[11px] font-semibold ${warn ? "text-amber-400/80" : "text-white/50"}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 text-[11px] pt-1 border-t border-white/[0.04]">
            <div className="flex items-center gap-1.5">
              <Shield size={11} className="text-red-400/50" />
              <span className="text-red-400/50">SL ${pick.stopLoss.toFixed(2)}</span>
            </div>
            <span className="text-white/15">→</span>
            <div className="flex items-center gap-1.5">
              <Target size={11} className="text-emerald-400/50" />
              <span className="text-emerald-400/50">TP ${pick.takeProfit.toFixed(2)}</span>
            </div>
            <span className="text-white/20">R:R {((pick.takeProfit - pick.price) / Math.max(0.01, pick.price - pick.stopLoss)).toFixed(1)}x</span>
          </div>
        </div>
      )}
    </div>
  );
}

function HorizonSection({ title, subtitle, icon: Icon, color, gradient, border, picks, horizon }: {
  title: string;
  subtitle: string;
  icon: typeof Zap;
  color: string;
  gradient: string;
  border: string;
  picks: BestPick[];
  horizon: "sprint" | "marathon" | "legacy";
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? picks : picks.slice(0, 5);

  if (picks.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${gradient} border ${border}`}>
        <Icon size={20} className={
          horizon === "sprint" ? "text-amber-400/80" : horizon === "marathon" ? "text-blue-400/80" : "text-emerald-400/80"
        } />
        <div>
          <h3 className={`text-sm font-bold ${
            horizon === "sprint" ? "text-amber-300/90" : horizon === "marathon" ? "text-blue-300/90" : "text-emerald-300/90"
          }`}>{title}</h3>
          <p className="text-[10px] text-white/25">{subtitle}</p>
        </div>
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${
          horizon === "sprint" ? "text-amber-400/60 bg-amber-500/10"
          : horizon === "marathon" ? "text-blue-400/60 bg-blue-500/10"
          : "text-emerald-400/60 bg-emerald-500/10"
        }`}>
          {picks.length} pick{picks.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {shown.map((pick) => (
          <PickCard key={pick.ticker} pick={pick} horizon={horizon} />
        ))}
      </div>
      {picks.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-white/25 hover:text-white/50 transition-colors flex items-center gap-1 mx-auto"
        >
          {showAll ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {picks.length}</>}
        </button>
      )}
    </div>
  );
}

function SignalBreakdownCard({ signal, defaultExpanded = false }: { signal: TechnicalSignal; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isPositive = signal.score > 0;
  const isBuy = signal.action === "BUY" || signal.action === "STRONG_BUY";
  const isSell = signal.action === "SELL" || signal.action === "STRONG_SELL";

  return (
    <div
      className={`rounded-xl border transition-all duration-300 cursor-pointer ${
        expanded ? "border-white/[0.08] bg-white/[0.03]" : "border-white/[0.04] bg-white/[0.015] hover:border-white/[0.08]"
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-3 sm:p-4 flex items-center gap-3">
        <StockLogo ticker={signal.ticker} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/90 font-bold text-sm">{signal.ticker}</span>
            <Badge variant={isBuy ? "green" : signal.action === "HOLD" ? "gold" : isSell ? "red" : "gray"}>
              {signal.action}
            </Badge>
            <StrategyTooltip strategy={signal.strategy}>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium cursor-help ${
                signal.strategy === "MOMENTUM"
                  ? "bg-blue-500/10 text-blue-400/80 border border-blue-500/20"
                  : signal.strategy === "MEAN_REVERSION"
                  ? "bg-purple-500/10 text-purple-400/80 border border-purple-500/20"
                  : "bg-amber-500/10 text-amber-400/80 border border-amber-500/20"
              }`}>
                {signal.strategy}
              </span>
            </StrategyTooltip>
            {signal.discoveryInfo && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-500/10 text-purple-400/80 border border-purple-500/20">
                {signal.discoveryInfo.source}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-white/25">
            <span className="text-white/50">${signal.price.toFixed(2)}</span>
            <span>Score: <span className={isPositive ? "text-emerald-400/70" : "text-red-400/70"}>{signal.score.toFixed(1)}</span></span>
            <span>Conf: <span className="text-white/50">{signal.confidence}%</span></span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, j) => (
              <div
                key={j}
                className={`w-1.5 h-4 rounded-sm ${
                  j < Math.ceil(Math.abs(signal.score) / 10)
                    ? isPositive ? "bg-emerald-400/60" : "bg-red-400/60"
                    : "bg-white/[0.06]"
                }`}
              />
            ))}
          </div>
          {expanded ? <ChevronUp size={14} className="text-white/20" /> : <ChevronDown size={14} className="text-white/20" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 sm:px-4 pb-4 pt-0 border-t border-white/[0.04] space-y-4 animate-fade-slide-up">
          {signal.discoveryInfo && (
            <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-purple-500/[0.04] border border-purple-500/10">
              <Radar size={12} className="text-purple-400/70 shrink-0 mt-0.5" />
              <p className="text-[10px] text-purple-300/60 leading-relaxed">{signal.discoveryInfo.reason}</p>
            </div>
          )}

          <div className="mt-3 space-y-2">
            <p className="text-[10px] text-white/25 uppercase tracking-wider font-semibold">Signal Breakdown</p>
            {signal.indicators.map((ind) => {
              const pct = Math.min(100, Math.abs(ind.score));
              return (
                <div key={ind.name} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-white/35 w-20 shrink-0 text-right font-medium">{ind.name}</span>
                    <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          ind.score > 20 ? "bg-emerald-400/60" : ind.score > 0 ? "bg-emerald-400/30" : ind.score > -20 ? "bg-red-400/30" : "bg-red-400/60"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-[11px] w-10 text-right font-mono ${ind.score > 0 ? "text-emerald-400/60" : ind.score < 0 ? "text-red-400/60" : "text-white/20"}`}>
                      {ind.score > 0 ? "+" : ""}{ind.score.toFixed(0)}
                    </span>
                  </div>
                  <div className="ml-[88px] text-[10px] text-white/20">{ind.reason}</div>
                </div>
              );
            })}
          </div>

          {signal.raw && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/[0.04]">
              {[
                { label: "RSI", value: signal.raw.rsi.toFixed(0), warn: signal.raw.rsi < 30 || signal.raw.rsi > 70 },
                { label: "MACD", value: signal.raw.macd.histogram.toFixed(2), warn: false },
                { label: "Vol Ratio", value: `${signal.raw.volumeRatio.toFixed(1)}x`, warn: signal.raw.volumeRatio > 2 },
                { label: "ATR", value: `$${signal.raw.atr.toFixed(2)}`, warn: false },
                { label: "SMA 20", value: `$${signal.raw.sma20.toFixed(2)}`, warn: false },
                { label: "SMA 50", value: `$${signal.raw.sma50.toFixed(2)}`, warn: false },
                { label: "Week", value: `${signal.raw.weekReturn >= 0 ? "+" : ""}${signal.raw.weekReturn.toFixed(1)}%`, warn: Math.abs(signal.raw.weekReturn) > 5 },
                { label: "Month", value: `${signal.raw.monthReturn >= 0 ? "+" : ""}${signal.raw.monthReturn.toFixed(1)}%`, warn: Math.abs(signal.raw.monthReturn) > 10 },
              ].map(({ label, value, warn }) => (
                <div key={label} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[9px] text-white/20 uppercase">{label}</div>
                  <div className={`text-xs font-semibold mt-0.5 ${warn ? "text-amber-400/80" : "text-white/60"}`}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {signal.stopLoss > 0 && signal.takeProfit > 0 && (
            <div className="flex items-center gap-4 text-[11px] pt-2 border-t border-white/[0.04]">
              <div className="flex items-center gap-1.5">
                <Shield size={11} className="text-red-400/50" />
                <span className="text-red-400/50">SL ${signal.stopLoss.toFixed(2)}</span>
              </div>
              <span className="text-white/15">→</span>
              <div className="flex items-center gap-1.5">
                <Target size={11} className="text-emerald-400/50" />
                <span className="text-emerald-400/50">TP ${signal.takeProfit.toFixed(2)}</span>
              </div>
              <span className="text-white/20">R:R {((signal.takeProfit - signal.price) / Math.max(0.01, signal.price - signal.stopLoss)).toFixed(1)}x</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Session cache helpers ───────────────────────────── */
const CACHE_KEYS = {
  market: "kosh:signals:market",
  bestPicks: "kosh:signals:bestPicks",
  intel: "kosh:signals:intel",
  deepDive: "kosh:signals:deepDive",
} as const;

function saveToSession(key: string, data: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(data)); } catch {}
}
function loadFromSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function SignalsPage() {
  const [ticker, setTicker] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [macroLoading, setMacroLoading] = useState(true);
  const [macro, setMacro] = useState<any>(null);
  const [marketSignals, setMarketSignals] = useState<TechnicalSignal[]>([]);
  const [marketDiscovered, setMarketDiscovered] = useState<any[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketScanned, setMarketScanned] = useState(0);
  const [filterAction, setFilterAction] = useState<"all" | "buy" | "sell">("all");
  const [showAll, setShowAll] = useState(false);

  const [bestPicks, setBestPicks] = useState<{ sprint: BestPick[]; marathon: BestPick[]; legacy: BestPick[] } | null>(null);
  const [bestPicksLoading, setBestPicksLoading] = useState(false);
  const [bestPicksStats, setBestPicksStats] = useState<{ scanned: number; totalBuySignals: number; totalPicks: number; signalDerived?: number } | null>(null);

  const [narratives, setNarratives] = useState<MarketNarrative[]>([]);
  const [tickerTechnicals, setTickerTechnicals] = useState<Record<string, TickerTechnical>>({});
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelStats, setIntelStats] = useState<{ totalSignals: number; totalTickers: number; signalCounts: Record<string, number> } | null>(null);

  // Hydrate from session cache on mount
  useEffect(() => {
    const cached = {
      market: loadFromSession<any>(CACHE_KEYS.market),
      bestPicks: loadFromSession<any>(CACHE_KEYS.bestPicks),
      intel: loadFromSession<any>(CACHE_KEYS.intel),
      deepDive: loadFromSession<any>(CACHE_KEYS.deepDive),
    };
    if (cached.market) {
      setMarketSignals(cached.market.signals || []);
      setMarketDiscovered(cached.market.discovered || []);
      setMarketScanned(cached.market.scanned || 0);
    }
    if (cached.bestPicks) {
      setBestPicks({ sprint: cached.bestPicks.sprint || [], marathon: cached.bestPicks.marathon || [], legacy: cached.bestPicks.legacy || [] });
      setBestPicksStats(cached.bestPicks.stats || null);
    }
    if (cached.intel) {
      setNarratives(cached.intel.narratives || []);
      setTickerTechnicals(cached.intel.tickerTechnicals || {});
      setIntelStats(cached.intel.stats || null);
    }
    if (cached.deepDive) {
      setData(cached.deepDive.data || null);
      if (cached.deepDive.ticker) setTicker(cached.deepDive.ticker);
    }
  }, []);

  useEffect(() => {
    fetch("/api/signals")
      .then((r) => r.json())
      .then((d) => setMacro(d.macro))
      .catch(() => {})
      .finally(() => setMacroLoading(false));
  }, []);

  const loadSignals = async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/signals?ticker=${encodeURIComponent(ticker.trim().toUpperCase())}`);
      const json = await res.json();
      setData(json);
      saveToSession(CACHE_KEYS.deepDive, { data: json, ticker: ticker.trim().toUpperCase() });
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  const runMarketScan = async () => {
    setMarketLoading(true);
    try {
      const res = await fetch("/api/signals?mode=market-scan");
      const json = await res.json();
      setMarketSignals(json.signals || []);
      setMarketDiscovered(json.discovered || []);
      setMarketScanned(json.scanned || 0);
      saveToSession(CACHE_KEYS.market, { signals: json.signals, discovered: json.discovered, scanned: json.scanned });
    } catch {
      setMarketSignals([]);
    }
    setMarketLoading(false);
  };

  const runBestPicks = async () => {
    setBestPicksLoading(true);
    try {
      const res = await fetch("/api/signals?mode=best-picks");
      const json = await res.json();
      if (json.error) {
        console.error("[BestPicks] API error:", json.error);
        setBestPicks(null);
      } else {
        const picks = { sprint: json.sprint || [], marathon: json.marathon || [], legacy: json.legacy || [] };
        const stats = { scanned: json.scanned || 0, totalBuySignals: json.totalBuySignals || 0, totalPicks: json.totalPicks || 0, signalDerived: json.signalDerived || 0 };
        setBestPicks(picks);
        setBestPicksStats(stats);
        saveToSession(CACHE_KEYS.bestPicks, { ...picks, stats });
      }
    } catch (e) {
      console.error("[BestPicks] Fetch failed:", e);
      setBestPicks(null);
    }
    setBestPicksLoading(false);
  };

  const runSignalIntelligence = async () => {
    setIntelLoading(true);
    try {
      const res = await fetch("/api/signals?mode=signal-intelligence");
      const json = await res.json();
      if (json.error) {
        console.error("[Intelligence] API error:", json.error);
      } else {
        const narrs = json.narratives || [];
        const techs = json.tickerTechnicals || {};
        const stats = {
          totalSignals: json.totalSignals || 0,
          totalTickers: json.totalTickers || 0,
          signalCounts: json.signalCounts || {},
        };
        setNarratives(narrs);
        setTickerTechnicals(techs);
        setIntelStats(stats);
        saveToSession(CACHE_KEYS.intel, { narratives: narrs, tickerTechnicals: techs, stats });
      }
    } catch (e) {
      console.error("[Intelligence] Fetch failed:", e);
      setNarratives([]);
    }
    setIntelLoading(false);
  };

  const regimeColors: Record<string, "green" | "yellow" | "red" | "blue"> = {
    EXPANSION: "green",
    PEAK: "yellow",
    CONTRACTION: "red",
    TROUGH: "blue",
  };

  const filteredMarket = filterAction === "all"
    ? marketSignals
    : filterAction === "buy"
    ? marketSignals.filter((s) => s.action === "BUY" || s.action === "STRONG_BUY")
    : marketSignals.filter((s) => s.action === "SELL" || s.action === "STRONG_SELL");
  const shownMarket = showAll ? filteredMarket : filteredMarket.slice(0, 10);
  const buyCount = marketSignals.filter((s) => s.action === "BUY" || s.action === "STRONG_BUY").length;
  const sellCount = marketSignals.filter((s) => s.action === "SELL" || s.action === "STRONG_SELL").length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Signals Dashboard</h1>

      {/* Macro regime */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Globe size={18} className="text-amber-400" />
          <h2 className="text-sm font-semibold text-amber-300/80">Macro Indicators</h2>
        </div>
        {macroLoading ? (
          <div className="skeleton h-20 w-full" />
        ) : macro ? (
          <div className="space-y-3">
            <Badge variant={regimeColors[macro.regime] || "gray"} className="text-base px-4 py-1">
              {macro.regime}
            </Badge>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
              {[
                { label: "GDP Growth", value: macro.gdpGrowth != null ? `${macro.gdpGrowth.toFixed(1)}%` : "N/A" },
                { label: "Unemployment", value: macro.unemployment != null ? `${macro.unemployment.toFixed(1)}%` : "N/A" },
                { label: "Fed Funds", value: macro.fedFunds != null ? `${macro.fedFunds.toFixed(2)}%` : "N/A" },
                { label: "Yield Curve", value: macro.yieldCurve != null ? `${macro.yieldCurve.toFixed(2)}%` : "N/A" },
                { label: "CPI YoY", value: macro.cpiYoY != null ? `${macro.cpiYoY.toFixed(1)}%` : "N/A" },
              ].map(({ label, value }) => (
                <div key={label} className="text-center p-2 bg-gray-900/50 rounded-xl">
                  <div className="text-[10px] text-gray-500 uppercase">{label}</div>
                  <div className="text-sm font-bold text-white mt-0.5">{value}</div>
                </div>
              ))}
            </div>
            {macro.signals?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {macro.signals.map((s: string, i: number) => (
                  <Badge key={i} variant="gray">{s}</Badge>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">Macro data unavailable</p>
        )}
      </Card>

      {/* Signal Intelligence — narratives from real signals */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-cyan-400" />
            <h2 className="text-sm font-semibold text-cyan-300/80">Signal Intelligence</h2>
            {intelStats && (
              <span className="text-[10px] text-white/20 ml-2">
                {intelStats.totalSignals} signals · {intelStats.totalTickers} stocks identified
              </span>
            )}
          </div>
          <Button onClick={runSignalIntelligence} loading={intelLoading} className="text-xs">
            <Sparkles size={14} className="mr-1" /> Analyze Signals
          </Button>
        </div>

        {intelLoading && <ScanLoadingAnimation type="intelligence" />}

        {!intelLoading && narratives.length > 0 && (
          <div className="space-y-4">
            {intelStats && (
              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  { icon: Newspaper, val: intelStats.signalCounts.news || 0, label: "news", cls: "text-blue-400/70" },
                  { icon: Users, val: intelStats.signalCounts.insider || 0, label: "insider", cls: "text-emerald-400/70" },
                  { icon: Landmark, val: intelStats.signalCounts.congress || 0, label: "congress", cls: "text-amber-400/70" },
                  { icon: Scale, val: intelStats.signalCounts.grades || 0, label: "grades", cls: "text-cyan-400/70" },
                  { icon: BarChart2, val: intelStats.signalCounts.screener || 0, label: "movers", cls: "text-purple-400/70" },
                  { icon: GitMerge, val: intelStats.signalCounts.mergers || 0, label: "M&A", cls: "text-orange-400/70" },
                  { icon: Building2, val: intelStats.signalCounts.institutional || 0, label: "13F", cls: "text-indigo-400/70" },
                  { icon: FileText, val: intelStats.signalCounts.press || 0, label: "press", cls: "text-teal-400/70" },
                  { icon: Clock, val: intelStats.signalCounts.earnings || 0, label: "earnings", cls: "text-pink-400/70" },
                  { icon: Coins, val: intelStats.signalCounts.crypto || 0, label: "crypto", cls: "text-yellow-400/70" },
                ].filter(({ val }) => val > 0).map(({ icon: Ic, val, label, cls }) => (
                  <span key={label} className="flex items-center gap-1.5 bg-white/[0.03] rounded-lg px-3 py-1.5 text-xs">
                    <Ic size={12} className={cls} />
                    <span className="text-white/80 font-semibold">{val}</span>
                    <span className="text-white/25">{label}</span>
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {narratives.map((narrative) => (
                <NarrativeCard key={narrative.id} narrative={narrative} technicals={tickerTechnicals} />
              ))}
            </div>
          </div>
        )}

        {!intelLoading && narratives.length === 0 && (
          <div className="text-center py-8 text-white/20 text-sm">
            <Brain size={24} className="mx-auto mb-2 text-cyan-400/30" />
            <p>Click &quot;Analyze Signals&quot; to read live market signals</p>
            <p className="text-[10px] text-white/15 mt-1">
              Scans news, insider trades, congressional activity, screener movers &amp; earnings — then AI builds actionable narratives
            </p>
          </div>
        )}
      </Card>

      {/* Best Picks — signal-driven */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-orange-400" />
            <h2 className="text-sm font-semibold text-orange-300/80">Best Buys Right Now</h2>
            {bestPicksStats && (
              <span className="text-[10px] text-white/20 ml-2">
                {bestPicksStats.scanned} scanned · {bestPicksStats.totalPicks} picks
              </span>
            )}
          </div>
          <Button onClick={runBestPicks} loading={bestPicksLoading} className="text-xs">
            <Search size={14} className="mr-1" /> Find Best Picks
          </Button>
        </div>

        {bestPicksLoading && <ScanLoadingAnimation type="picks" />}

        {!bestPicksLoading && bestPicks && (bestPicks.sprint.length > 0 || bestPicks.marathon.length > 0 || bestPicks.legacy.length > 0) ? (
          <div className="space-y-6">
            {bestPicksStats && (
              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  ...(bestPicksStats.signalDerived ? [{ icon: Radar, val: bestPicksStats.signalDerived, label: "from signals", cls: "text-purple-400/70" }] : []),
                  { icon: Search, val: bestPicksStats.scanned, label: "scanned", cls: "text-orange-400/70" },
                  { icon: Brain, val: bestPicksStats.totalBuySignals, label: "buy signals", cls: "text-emerald-400/70" },
                  { icon: Zap, val: bestPicks.sprint.length, label: "sprint", cls: "text-amber-400/70" },
                  { icon: TrendingUp, val: bestPicks.marathon.length, label: "marathon", cls: "text-blue-400/70" },
                  { icon: Gem, val: bestPicks.legacy.length, label: "legacy", cls: "text-emerald-400/70" },
                ].map(({ icon: Ic, val, label, cls }) => (
                  <span key={label} className="flex items-center gap-1.5 bg-white/[0.03] rounded-lg px-3 py-1.5 text-xs">
                    <Ic size={12} className={cls} />
                    <span className="text-white/80 font-semibold">{val}</span>
                    <span className="text-white/25">{label}</span>
                  </span>
                ))}
              </div>
            )}

            <HorizonSection
              title="Sprint Picks"
              subtitle="Short-term opportunities — hold period under 1 year. Momentum plays, oversold bounces, and catalyst-driven moves."
              icon={Zap}
              color="amber"
              gradient="from-amber-500/10 to-orange-500/5"
              border="border-amber-500/20"
              picks={bestPicks.sprint}
              horizon="sprint"
            />

            <HorizonSection
              title="Marathon Picks"
              subtitle="Medium-term growth — hold period 1 to 3 years. Strong uptrends, golden crosses, and steady compounders."
              icon={TrendingUp}
              color="blue"
              gradient="from-blue-500/10 to-cyan-500/5"
              border="border-blue-500/20"
              picks={bestPicks.marathon}
              horizon="marathon"
            />

            <HorizonSection
              title="Legacy Picks"
              subtitle="Long-term value — hold period 3 to 10 years. Beaten-down quality names, accumulation zones, and deep discounts."
              icon={Gem}
              color="emerald"
              gradient="from-emerald-500/10 to-teal-500/5"
              border="border-emerald-500/20"
              picks={bestPicks.legacy}
              horizon="legacy"
            />
          </div>
        ) : !bestPicksLoading ? (
          <div className="text-center py-8 text-white/20 text-sm">
            <Flame size={24} className="mx-auto mb-2 text-orange-400/30" />
            <p>Click &quot;Find Best Picks&quot; to discover stocks from live signals</p>
            <p className="text-[10px] text-white/15 mt-1">Signal-first: reads news, insider buys, congress trades → derives which stocks to analyze → categorizes by holding period</p>
          </div>
        ) : null}
      </Card>

      {/* Market-wide scanner */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radar size={18} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-purple-300/80">Market Scanner</h2>
            {marketScanned > 0 && (
              <span className="text-[10px] text-white/20 ml-2">{marketScanned} stocks scanned</span>
            )}
          </div>
          <Button onClick={runMarketScan} loading={marketLoading} className="text-xs">
            <Search size={14} className="mr-1" /> Scan Market
          </Button>
        </div>

        {marketLoading && <ScanLoadingAnimation type="market" />}

        {!marketLoading && marketSignals.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { icon: Brain, val: marketSignals.length, label: "signals", color: "text-purple-400/70" },
                { icon: TrendingUp, val: buyCount, label: "buy", color: "text-emerald-400/70" },
                { icon: TrendingDown, val: sellCount, label: "sell", color: "text-red-400/70" },
                { icon: Radar, val: marketDiscovered.length, label: "discovered", color: "text-purple-400/70" },
              ].map(({ icon: Icon, val, label, color }) => (
                <span key={label} className="flex items-center gap-1.5 bg-white/[0.03] rounded-lg px-3 py-1.5 text-xs">
                  <Icon size={12} className={color} />
                  <span className="text-white/80 font-semibold">{val}</span>
                  <span className="text-white/25">{label}</span>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-1 mb-2">
              {([
                { id: "all" as const, label: "All", count: marketSignals.length },
                { id: "buy" as const, label: "Buy Signals", count: buyCount },
                { id: "sell" as const, label: "Sell Signals", count: sellCount },
              ]).map(({ id, label, count }) => (
                <button
                  key={id}
                  onClick={() => setFilterAction(id)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                    filterAction === id
                      ? id === "buy" ? "bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20"
                        : id === "sell" ? "bg-red-500/10 text-red-400/80 border border-red-500/20"
                        : "bg-purple-500/10 text-purple-400/80 border border-purple-500/20"
                      : "bg-white/[0.03] text-white/25 border border-white/[0.04] hover:border-white/[0.08]"
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {shownMarket.map((signal, i) => (
                <SignalBreakdownCard key={signal.ticker} signal={signal} defaultExpanded={i === 0} />
              ))}
            </div>

            {filteredMarket.length > 10 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-xs text-white/25 hover:text-purple-400/60 transition-colors flex items-center gap-1 mx-auto"
              >
                {showAll ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {filteredMarket.length} signals</>}
              </button>
            )}

            {marketDiscovered.length > 0 && (
              <div className="pt-3 border-t border-white/[0.04]">
                <p className="text-[10px] text-white/20 uppercase tracking-wider font-semibold mb-2">
                  Discovered Opportunities ({marketDiscovered.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {marketDiscovered.slice(0, 12).map((d: any) => (
                    <div key={d.ticker} className="flex items-center gap-2 bg-white/[0.02] border border-purple-500/10 rounded-lg px-3 py-2">
                      <StockLogo ticker={d.ticker} size={20} />
                      <div>
                        <span className="text-white/80 font-semibold text-xs">{d.ticker}</span>
                        <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          d.source === "news" ? "bg-blue-500/10 text-blue-400/70"
                          : d.source === "congress" ? "bg-amber-500/10 text-amber-400/70"
                          : d.source === "insider" ? "bg-emerald-500/10 text-emerald-400/70"
                          : d.source === "screener" ? "bg-purple-500/10 text-purple-400/70"
                          : "bg-white/[0.04] text-white/30"
                        }`}>{d.source}</span>
                      </div>
                      <div className="ml-auto flex items-center gap-0.5">
                        {Array.from({ length: 3 }).map((_, k) => (
                          <div key={k} className={`w-1 h-2.5 rounded-sm ${k < d.urgency ? "bg-purple-400/60" : "bg-white/[0.06]"}`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!marketLoading && marketSignals.length === 0 && (
          <div className="text-center py-8 text-white/20 text-sm">
            <Radar size={24} className="mx-auto mb-2 text-purple-400/30" />
            <p>Click &quot;Scan Market&quot; to analyze top stocks and crypto across 8 technical indicators</p>
          </div>
        )}
      </Card>

      {/* Stock-specific signals */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={18} className="text-rose-400" />
          <h2 className="text-sm font-semibold text-rose-300/80">Stock Deep Dive</h2>
        </div>
        <div className="flex gap-3 mb-4">
          <Input
            placeholder="Enter ticker... AAPL"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && loadSignals()}
          />
          <Button onClick={loadSignals} loading={loading}>Analyze</Button>
        </div>

        {data && (
          <div className="space-y-4">
            {/* Technical Analysis */}
            {data.technicals && (
              <SignalBreakdownCard signal={data.technicals} defaultExpanded={true} />
            )}

            {/* Analyst Recommendations */}
            {data.analyst?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target size={16} className="text-blue-400" />
                  <h3 className="text-sm font-semibold text-blue-300/80">Analyst Recommendations</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-800">
                        <th className="text-left py-2">Period</th>
                        <th className="text-right py-2">Buy</th>
                        <th className="text-right py-2">Hold</th>
                        <th className="text-right py-2">Sell</th>
                        <th className="text-right py-2">Strong Buy</th>
                        <th className="text-right py-2">Strong Sell</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.analyst.slice(0, 4).map((r: any, i: number) => (
                        <tr key={r.period} className={i % 2 === 0 ? "bg-gray-900/50" : ""}>
                          <td className="py-2 text-white font-medium">{r.period}</td>
                          <td className="py-2 text-right text-emerald-400">{r.buy}</td>
                          <td className="py-2 text-right text-gray-400">{r.hold}</td>
                          <td className="py-2 text-right text-red-400">{r.sell}</td>
                          <td className="py-2 text-right text-emerald-300">{r.strongBuy}</td>
                          <td className="py-2 text-right text-red-300">{r.strongSell}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Price Target */}
            {data.priceTarget && (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-gray-900/50 rounded-xl">
                  <div className="text-[10px] text-gray-500 uppercase">Low Target</div>
                  <div className="text-lg font-bold text-red-400">{formatCurrency(data.priceTarget.targetLow || 0)}</div>
                </div>
                <div className="text-center p-3 bg-gray-900/50 rounded-xl">
                  <div className="text-[10px] text-gray-500 uppercase">Mean Target</div>
                  <div className="text-lg font-bold text-white">{formatCurrency(data.priceTarget.targetMean || 0)}</div>
                </div>
                <div className="text-center p-3 bg-gray-900/50 rounded-xl">
                  <div className="text-[10px] text-gray-500 uppercase">High Target</div>
                  <div className="text-lg font-bold text-emerald-400">{formatCurrency(data.priceTarget.targetHigh || 0)}</div>
                </div>
              </div>
            )}

            {/* Insider Transactions */}
            {data.insider?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users size={16} className="text-emerald-400" />
                  <h3 className="text-sm font-semibold text-emerald-300/80">Insider Transactions</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-800">
                        <th className="text-left py-2">Date</th>
                        <th className="text-left py-2">Name</th>
                        <th className="text-left py-2">Type</th>
                        <th className="text-right py-2">Shares</th>
                        <th className="text-right py-2">Price</th>
                        <th className="text-right py-2">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.insider.map((t: any, i: number) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-gray-900/50" : ""}>
                          <td className="py-2 text-gray-400 text-xs">{t.transactionDate || t.filingDate}</td>
                          <td className="py-2 text-white text-xs truncate max-w-[120px]">{t.reportingName}</td>
                          <td className="py-2">
                            <Badge variant={t.acquistionOrDisposition === "A" || t.transactionType?.includes("Purchase") ? "green" : "red"}>
                              {t.acquistionOrDisposition === "A" ? "Buy" : "Sell"}
                            </Badge>
                          </td>
                          <td className="py-2 text-right text-gray-300">{Math.abs(t.securitiesTransacted || 0).toLocaleString()}</td>
                          <td className="py-2 text-right text-gray-400">{t.price ? formatCurrency(t.price) : "—"}</td>
                          <td className="py-2 text-right text-white font-medium">
                            {t.securitiesTransacted && t.price ? formatCurrency(Math.abs(t.securitiesTransacted * t.price), true) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
