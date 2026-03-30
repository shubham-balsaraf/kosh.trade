import Link from "next/link";
import { TrendingUp, Shield, Zap, BarChart3, Brain, Bell, ArrowRight, ChevronRight } from "lucide-react";
import Logo from "@/components/ui/Logo";
import TickerStrip from "@/components/ui/TickerStrip";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import LandingNav from "@/components/ui/LandingNav";

const features = [
  {
    icon: TrendingUp,
    title: "Fundamental Analysis",
    desc: "Deep-dive reports with valuation, growth, health, and peer comparison — like having a Wall Street analyst on demand.",
    iconClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderHover: "hover:border-emerald-500/30",
    glowClass: "group-hover:shadow-emerald-500/5",
  },
  {
    icon: Brain,
    title: "AI Portfolio Summary",
    desc: "Get Claude-powered analysis of your entire portfolio — concentration risks, sector tilts, and rebalancing suggestions.",
    iconClass: "text-purple-400",
    bgClass: "bg-purple-500/10",
    borderHover: "hover:border-purple-500/30",
    glowClass: "group-hover:shadow-purple-500/5",
  },
  {
    icon: BarChart3,
    title: "FCF & SBC Charts",
    desc: "Interactive free cash flow per share charts with quarterly/annual views. Click-to-anchor with live % change tracking.",
    iconClass: "text-blue-400",
    bgClass: "bg-blue-500/10",
    borderHover: "hover:border-blue-500/30",
    glowClass: "group-hover:shadow-blue-500/5",
  },
  {
    icon: Bell,
    title: "Signal Alerts",
    desc: "Track insider transactions, analyst estimates, dark pool flow, and congressional trades. Get alerts when signals align.",
    iconClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderHover: "hover:border-amber-500/30",
    glowClass: "group-hover:shadow-amber-500/5",
  },
  {
    icon: Zap,
    title: "Auto-Invest",
    desc: "Connect your Alpaca account and let signal-based strategies invest for you — paper or live trading.",
    iconClass: "text-cyan-400",
    bgClass: "bg-cyan-500/10",
    borderHover: "hover:border-cyan-500/30",
    glowClass: "group-hover:shadow-cyan-500/5",
  },
  {
    icon: Shield,
    title: "Dip Finder",
    desc: "Discover fundamentally strong stocks trading near 52-week lows. Filter by FCF, ROE, debt ratios, and more.",
    iconClass: "text-rose-400",
    bgClass: "bg-rose-500/10",
    borderHover: "hover:border-rose-500/30",
    glowClass: "group-hover:shadow-rose-500/5",
  },
];

const stats = [
  { value: 100, suffix: "+", label: "Data Endpoints", iconClass: "text-emerald-400" },
  { value: 10000, suffix: "+", label: "Stocks Covered", iconClass: "text-blue-400" },
  { value: 5, suffix: "", label: "Signal Categories", iconClass: "text-amber-400" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      <LandingNav />

      {/* Hero */}
      <div className="relative overflow-hidden">
        {/* Floating gradient orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="animate-float-1 absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl" />
          <div className="animate-float-2 absolute top-20 right-0 w-80 h-80 rounded-full bg-emerald-600/10 blur-3xl" />
          <div className="animate-float-3 absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="animate-float-2 absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-purple-600/8 blur-3xl" />
        </div>

        {/* Animated SVG chart lines */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-15">
          <svg viewBox="0 0 1200 400" className="w-full max-w-6xl" fill="none" preserveAspectRatio="none">
            <defs>
              <linearGradient id="heroLine1" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6366F1" />
                <stop offset="50%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
              <linearGradient id="heroLine2" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#EC4899" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="heroFill" x1="0" y1="100" x2="0" y2="400" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6366F1" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 320 L80 300 L160 280 L240 290 L320 240 L400 260 L480 200 L560 220 L640 160 L720 180 L800 120 L880 140 L960 80 L1040 100 L1120 60 L1200 40"
              stroke="url(#heroLine1)"
              strokeWidth="2.5"
              className="animate-draw-line"
            />
            <path
              d="M0 320 L80 300 L160 280 L240 290 L320 240 L400 260 L480 200 L560 220 L640 160 L720 180 L800 120 L880 140 L960 80 L1040 100 L1120 60 L1200 40 L1200 400 L0 400 Z"
              fill="url(#heroFill)"
              className="animate-fade-in"
            />
            <path
              d="M0 350 L100 340 L200 310 L300 330 L400 290 L500 310 L600 260 L700 280 L800 230 L900 250 L1000 200 L1100 220 L1200 180"
              stroke="url(#heroLine2)"
              strokeWidth="1.5"
              className="animate-draw-line"
              style={{ animationDelay: "0.8s" }}
            />
          </svg>
        </div>

        <div className="max-w-5xl mx-auto px-4 pt-20 pb-24 text-center relative">
          <div className="animate-fade-in-up">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Free to use — No credit card required
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight animate-fade-in-up-delay-1">
            Invest smarter with
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
              AI-powered analysis
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 mt-6 max-w-2xl mx-auto animate-fade-in-up-delay-2">
            Deep fundamental reports, interactive charts, portfolio AI summaries, and signal-based alerts — everything long-term investors need.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10 animate-fade-in-up-delay-3">
            <Link
              href="/register"
              className="group px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-105 flex items-center justify-center gap-2"
            >
              Get Started Free
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 bg-gray-800/80 hover:bg-gray-700 text-gray-200 font-semibold rounded-xl border border-gray-700 transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              Sign In
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* Ticker Strip */}
      <TickerStrip />

      {/* Stats Section */}
      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="grid grid-cols-3 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl md:text-5xl font-black text-white mb-2">
                <AnimatedCounter
                  target={stat.value}
                  suffix={stat.suffix}
                  duration={2000}
                />
              </div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-4 pb-24">
        <div className="text-center mb-14">
          <h2 className="text-2xl md:text-4xl font-bold text-white">
            Everything you need to invest smarter
          </h2>
          <p className="text-gray-500 mt-3 max-w-lg mx-auto">
            Professional-grade tools powered by AI, available for free.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc, iconClass, bgClass, borderHover, glowClass }) => (
            <div
              key={title}
              className={`group bg-gray-900/50 border border-gray-800 rounded-2xl p-6 ${borderHover} transition-all duration-300 shadow-lg shadow-transparent ${glowClass} hover:translate-y-[-2px]`}
            >
              <div className={`w-12 h-12 ${bgClass} rounded-xl flex items-center justify-center mb-4`}>
                <Icon size={22} className={iconClass} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="border-y border-gray-900 bg-gray-950/50">
        <div className="max-w-4xl mx-auto px-4 py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-14">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { step: "01", title: "Search any stock", desc: "Type a company name or ticker — search works with names like \"Cisco\" not just \"CSCO\".", color: "text-blue-400" },
              { step: "02", title: "Analyze fundamentals", desc: "Get interactive charts, valuation metrics, FCF trends, margin history, and earnings data.", color: "text-emerald-400" },
              { step: "03", title: "Track & act", desc: "Build portfolios, get AI summaries, set signal alerts, and auto-invest based on your strategy.", color: "text-purple-400" },
            ].map(({ step, title, desc, color }) => (
              <div key={step} className="text-center">
                <div className={`text-5xl font-black ${color} opacity-30 mb-3`}>{step}</div>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="animate-float-3 absolute top-10 left-1/4 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl" />
          <div className="animate-float-1 absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-emerald-600/8 blur-3xl" />
        </div>
        <div className="max-w-3xl mx-auto px-4 py-24 text-center relative">
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
            Ready to analyze like a pro?
          </h2>
          <p className="text-gray-400 mb-10 max-w-lg mx-auto text-lg">
            Join investors using AI-powered fundamental analysis to make better, data-driven decisions.
          </p>
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-105 text-lg"
          >
            Create Free Account
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-900 py-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Logo size="sm" showDomain />
            <div className="flex gap-6 text-sm text-gray-600">
              <Link href="/login" className="hover:text-gray-400 transition-colors">Sign In</Link>
              <Link href="/register" className="hover:text-gray-400 transition-colors">Register</Link>
              <Link href="/pricing" className="hover:text-gray-400 transition-colors">Pricing</Link>
            </div>
          </div>
          <div className="text-center mt-6 text-xs text-gray-700">
            <p>kosh.trade is for fundamental screening and financial education only. Not investment advice.</p>
            <p className="mt-1">Verify all data independently. Past performance does not guarantee future results.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
