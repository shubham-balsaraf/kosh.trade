import Link from "next/link";
import { TrendingUp, Shield, Zap, BarChart3, Brain, Bell } from "lucide-react";
import Logo from "@/components/ui/Logo";
import TickerStrip from "@/components/ui/TickerStrip";
import AnimatedCounter from "@/components/ui/AnimatedCounter";

const features = [
  {
    icon: TrendingUp,
    title: "Fundamental Analysis",
    desc: "Deep-dive reports with valuation, growth, health, and peer comparison — like having a Wall Street analyst on demand.",
    color: "emerald",
    iconClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderHover: "hover:border-emerald-500/30",
    glowClass: "group-hover:shadow-emerald-500/5",
  },
  {
    icon: Brain,
    title: "AI Portfolio Summary",
    desc: "Get Claude-powered analysis of your entire portfolio — concentration risks, sector tilts, and rebalancing suggestions.",
    color: "purple",
    iconClass: "text-purple-400",
    bgClass: "bg-purple-500/10",
    borderHover: "hover:border-purple-500/30",
    glowClass: "group-hover:shadow-purple-500/5",
  },
  {
    icon: BarChart3,
    title: "FCF & SBC Charts",
    desc: "Interactive free cash flow per share charts with quarterly/annual views. See FCF vs stock-based compensation side by side.",
    color: "blue",
    iconClass: "text-blue-400",
    bgClass: "bg-blue-500/10",
    borderHover: "hover:border-blue-500/30",
    glowClass: "group-hover:shadow-blue-500/5",
  },
  {
    icon: Bell,
    title: "Signal Alerts",
    desc: "Track insider transactions, analyst estimates, dark pool flow, and congressional trades. Get alerts when signals align.",
    color: "amber",
    iconClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderHover: "hover:border-amber-500/30",
    glowClass: "group-hover:shadow-amber-500/5",
  },
  {
    icon: Zap,
    title: "Auto-Invest",
    desc: "Connect your Alpaca account and let signal-based strategies invest for you — paper or live trading.",
    color: "cyan",
    iconClass: "text-cyan-400",
    bgClass: "bg-cyan-500/10",
    borderHover: "hover:border-cyan-500/30",
    glowClass: "group-hover:shadow-cyan-500/5",
  },
  {
    icon: Shield,
    title: "Dip Finder",
    desc: "Discover fundamentally strong stocks trading near 52-week lows. Filter by FCF, ROE, debt ratios, and more.",
    color: "rose",
    iconClass: "text-rose-400",
    bgClass: "bg-rose-500/10",
    borderHover: "hover:border-rose-500/30",
    glowClass: "group-hover:shadow-rose-500/5",
  },
];

const stats = [
  { value: 100, suffix: "+", label: "Data Endpoints" },
  { value: 10000, suffix: "+", label: "Stocks Covered" },
  { value: 5, suffix: "", label: "Signal Categories" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero */}
      <div className="relative overflow-hidden">
        {/* Floating gradient orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="animate-float-1 absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl" />
          <div className="animate-float-2 absolute top-20 right-0 w-80 h-80 rounded-full bg-emerald-600/10 blur-3xl" />
          <div className="animate-float-3 absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-blue-600/10 blur-3xl" />
        </div>

        {/* Animated SVG chart line background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <svg
            viewBox="0 0 1200 300"
            className="w-full max-w-5xl"
            fill="none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="heroChartGrad" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6366F1" />
                <stop offset="30%" stopColor="#10B981" />
                <stop offset="60%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <path
              d="M0 250 L100 220 L200 180 L300 200 L400 140 L500 160 L600 100 L700 120 L800 60 L900 80 L1000 30 L1100 50 L1200 20"
              stroke="url(#heroChartGrad)"
              strokeWidth="3"
              className="animate-draw-line"
            />
          </svg>
        </div>

        <div className="max-w-5xl mx-auto px-4 pt-24 pb-20 text-center relative">
          <div className="flex justify-center mb-4 animate-fade-in-up">
            <Logo size="xl" showDomain />
          </div>
          <p className="text-xl md:text-2xl text-gray-400 mt-4 max-w-2xl mx-auto animate-fade-in-up-delay-1">
            AI-powered fundamental analysis for long-term US stock investors
          </p>
          <div className="flex justify-center gap-4 mt-8 animate-fade-in-up-delay-2">
            <Link
              href="/register"
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-105"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold rounded-xl border border-gray-700 transition-all hover:scale-105"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Ticker Strip */}
      <TickerStrip />

      {/* Stats Section */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="grid grid-cols-3 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl md:text-4xl font-black text-white mb-1">
                <AnimatedCounter
                  target={stat.value}
                  suffix={stat.suffix}
                  duration={2000}
                />
              </div>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-12 animate-fade-in">
          Everything you need to invest smarter
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc, iconClass, bgClass, borderHover, glowClass }, idx) => (
            <div
              key={title}
              className={`group bg-gray-900/50 border border-gray-800 rounded-2xl p-6 ${borderHover} transition-all duration-300 shadow-lg shadow-transparent ${glowClass}`}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className={`w-10 h-10 ${bgClass} rounded-xl flex items-center justify-center mb-4`}>
                <Icon size={20} className={iconClass} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-600/5 via-transparent to-transparent" />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center relative">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Start analyzing stocks like a pro
          </h2>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">
            Join thousands of investors using AI-powered fundamental analysis to make better decisions.
          </p>
          <Link
            href="/register"
            className="inline-block px-10 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-105"
          >
            Create Free Account
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-900 py-8 text-center text-xs text-gray-600">
        <p>kosh.trade is for fundamental screening and financial education only. Not investment advice.</p>
        <p className="mt-1">Verify all data independently. Past performance does not guarantee future results.</p>
      </footer>
    </div>
  );
}
