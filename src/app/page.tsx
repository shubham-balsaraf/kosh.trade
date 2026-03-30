import Link from "next/link";
import { TrendingUp, Shield, Zap, BarChart3, Brain, Bell } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center relative">
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight">
            Kosh
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mt-4 max-w-2xl mx-auto">
            AI-powered fundamental analysis for long-term US stock investors
          </p>
          <div className="flex justify-center gap-4 mt-8">
            <Link
              href="/register"
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold rounded-xl border border-gray-700 transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-4 py-16 grid md:grid-cols-3 gap-6">
        {[
          { icon: TrendingUp, title: "Fundamental Analysis", desc: "Deep-dive reports with valuation, growth, health, and peer comparison — like having a Wall Street analyst on demand." },
          { icon: Brain, title: "AI Portfolio Summary", desc: "Get Claude-powered analysis of your entire portfolio — concentration risks, sector tilts, and rebalancing suggestions." },
          { icon: BarChart3, title: "FCF & SBC Charts", desc: "Interactive free cash flow per share charts with quarterly/annual views. See FCF vs stock-based compensation side by side." },
          { icon: Bell, title: "Signal Alerts", desc: "Track insider transactions, analyst estimates, dark pool flow, and congressional trades. Get alerts when signals align." },
          { icon: Zap, title: "Auto-Invest", desc: "Connect your Alpaca account and let signal-based strategies invest for you — paper or live trading." },
          { icon: Shield, title: "Dip Finder", desc: "Discover fundamentally strong stocks trading near 52-week lows. Filter by FCF, ROE, debt ratios, and more." },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-4">
              <Icon size={20} className="text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-900 py-8 text-center text-xs text-gray-600">
        <p>Kosh is for fundamental screening and financial education only. Not investment advice.</p>
        <p className="mt-1">Verify all data independently. Past performance does not guarantee future results.</p>
      </footer>
    </div>
  );
}
