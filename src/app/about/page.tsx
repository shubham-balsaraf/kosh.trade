import Link from "next/link";
import type { Metadata } from "next";
import Logo from "@/components/ui/Logo";
import LandingNav from "@/components/ui/LandingNav";
import {
  TrendingUp, Brain, Zap, BarChart3, Shield, Bell,
  GitBranch, Link2, Globe, ArrowRight, Code2, Database,
  Cpu, LineChart, Lock, Server,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About — kosh.trade",
  description:
    "Learn about Kosh, the AI-powered stock analysis and autonomous trading platform built by Shubham Balsaraf.",
};

const techStack = [
  { icon: Code2, label: "Next.js & React", desc: "Full-stack TypeScript application", color: "text-blue-400" },
  { icon: Database, label: "PostgreSQL & Prisma", desc: "Type-safe database layer", color: "text-emerald-400" },
  { icon: Brain, label: "Claude AI", desc: "Market narratives & conviction analysis", color: "text-purple-400" },
  { icon: LineChart, label: "FMP & Finnhub", desc: "Real-time market data from 10+ endpoints", color: "text-amber-400" },
  { icon: Server, label: "Self-hosted", desc: "Runs on a Raspberry Pi with PM2 & cron", color: "text-cyan-400" },
  { icon: Lock, label: "Alpaca Integration", desc: "Paper & live trading via brokerage API", color: "text-rose-400" },
];

const timeline = [
  { phase: "Phase 1", title: "Fundamental Analysis", desc: "Deep-dive stock reports with valuation, growth, health metrics, and peer comparison.", done: true },
  { phase: "Phase 2", title: "Portfolio & AI Summaries", desc: "Track holdings, get Claude-powered portfolio analysis with concentration risks and rebalancing.", done: true },
  { phase: "Phase 3", title: "Signal Discovery", desc: "Market-wide signal scanning — insider trades, congressional activity, earnings, news, and technicals.", done: true },
  { phase: "Phase 4", title: "KoshPilot (Autonomous Trading)", desc: "Signal-first architecture that discovers opportunities, analyzes with AI, and executes trades autonomously.", done: true },
  { phase: "Phase 5", title: "Live Trading & Scale", desc: "Alpaca live trading, multi-user support, cron-based automation, and performance optimization.", done: true },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black">
      <LandingNav />

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="animate-float-1 absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl" />
          <div className="animate-float-2 absolute top-20 right-0 w-80 h-80 rounded-full bg-emerald-600/10 blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center relative">
          <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
            Built by an investor,
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
              for investors
            </span>
          </h1>
          <p className="text-lg text-gray-400 mt-6 max-w-2xl mx-auto leading-relaxed">
            Kosh started as a personal tool to remove emotion from investing decisions.
            It grew into a full-stack platform that combines deep fundamental analysis
            with autonomous, signal-driven trading.
          </p>
        </div>
      </div>

      {/* The Story */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <div className="glass-card p-8 md:p-10 border border-gray-800/50 rounded-2xl">
          <h2 className="text-2xl font-bold text-white mb-6">The Story</h2>
          <div className="space-y-4 text-gray-400 leading-relaxed">
            <p>
              Most trading losses don&apos;t come from bad analysis — they come from bad behavior.
              Panic sells, revenge trades, FOMO buys. The same patterns, repeated by the same
              creature driven by fear and greed.
            </p>
            <p>
              AI can&apos;t generate alpha or create a magic money tree. The odds are that everything
              is already priced in. But what AI <em className="text-white/80 not-italic">can</em> do is help you build strategies, test them,
              and execute them systematically — removing emotion from the equation.
            </p>
            <p>
              That&apos;s what Kosh does. It scans markets for signals across multiple data sources,
              synthesizes them into narratives using AI, and acts on them with discipline.
              No panic. No greed. Just consistency.
            </p>
            <p className="text-white/60 font-medium">
              AI makes you more disciplined, not smarter. And if you think about where most
              trading losses actually come from, that distinction matters more than people realise.
            </p>
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="border-y border-gray-900 bg-gray-950/50">
        <div className="max-w-5xl mx-auto px-4 py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-4">
            Tech Stack
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-lg mx-auto">
            End-to-end TypeScript. Self-hosted on a Raspberry Pi.
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {techStack.map(({ icon: Icon, label, desc, color }) => (
              <div
                key={label}
                className="group bg-gray-900/50 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all duration-300 hover:translate-y-[-2px]"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Icon size={20} className={color} />
                  <h3 className="text-sm font-bold text-white">{label}</h3>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Build Timeline */}
      <div className="max-w-3xl mx-auto px-4 py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
          Build Timeline
        </h2>
        <div className="space-y-6">
          {timeline.map(({ phase, title, desc, done }, i) => (
            <div key={phase} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full mt-1.5 ${done ? "bg-emerald-400" : "bg-gray-700"}`} />
                {i < timeline.length - 1 && (
                  <div className={`w-px flex-1 mt-1 ${done ? "bg-emerald-400/20" : "bg-gray-800"}`} />
                )}
              </div>
              <div className="pb-6">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                  {phase}
                </span>
                <h3 className="text-white font-semibold mt-0.5">{title}</h3>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Creator */}
      <div className="border-y border-gray-900 bg-gray-950/50">
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 mx-auto flex items-center justify-center text-2xl font-black text-white mb-6">
            SB
          </div>
          <h2 className="text-2xl font-bold text-white">Shubham Balsaraf</h2>
          <p className="text-gray-500 mt-2 max-w-md mx-auto leading-relaxed">
            Software engineer and investor. Built Kosh to systematize investing
            decisions and remove the emotional patterns that cost most traders money.
          </p>
          <div className="flex items-center justify-center gap-4 mt-6">
            <a
              href="https://github.com/shubham-balsaraf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium rounded-xl transition-all"
            >
              <GitBranch size={16} />
              GitHub
            </a>
            <a
              href="https://linkedin.com/in/shubhambalsaraf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium rounded-xl transition-all"
            >
              <Link2 size={16} />
              LinkedIn
            </a>
            <a
              href="https://github.com/shubham-balsaraf/kosh.trade"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium rounded-xl transition-all"
            >
              <Code2 size={16} />
              Source
            </a>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">
          Ready to invest smarter?
        </h2>
        <p className="text-gray-500 mb-8">Free to use. No credit card required.</p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-105"
        >
          Get Started
          <ArrowRight size={18} />
        </Link>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-900 py-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Logo size="sm" showDomain />
            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
              <Link href="/" className="hover:text-gray-400 transition-colors">Home</Link>
              <Link href="/about" className="hover:text-gray-400 transition-colors">About</Link>
              <Link href="/login" className="hover:text-gray-400 transition-colors">Sign In</Link>
              <Link href="/register" className="hover:text-gray-400 transition-colors">Register</Link>
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
