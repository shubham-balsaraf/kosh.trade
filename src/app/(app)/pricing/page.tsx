"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  Check,
  Crown,
  Shield,
  X,
  BarChart3,
  Activity,
  Brain,
  Bell,
  TrendingDown,
  Zap,
  ChevronDown,
  Infinity,
} from "lucide-react";

const featureCategories = [
  {
    name: "Data & Analysis",
    icon: BarChart3,
    features: [
      {
        label: "Fundamental analysis reports",
        desc: "Full financial breakdown for any US-listed stock",
        free: true,
        pro: true,
      },
      {
        label: "FCF & SBC charts",
        desc: "Free cash flow per share growth and stock-based compensation trends",
        free: true,
        pro: true,
      },
      {
        label: "Margin & price history charts",
        desc: "Interactive gross/net margin and historical price charts",
        free: true,
        pro: true,
      },
      {
        label: "Earnings calendar & transcripts",
        desc: "Next earnings date and full transcript access",
        free: true,
        pro: true,
      },
      {
        label: "Priority data refresh",
        desc: "Data refreshes more frequently with lower cache times",
        free: false,
        pro: true,
      },
    ],
  },
  {
    name: "Signals & Intelligence",
    icon: Activity,
    features: [
      {
        label: "Insider trade tracking",
        desc: "See when executives buy or sell their own stock",
        free: true,
        pro: true,
      },
      {
        label: "Analyst consensus ratings",
        desc: "Wall Street price targets and buy/hold/sell ratings",
        free: true,
        pro: true,
      },
      {
        label: "Macro regime indicator",
        desc: "Economic cycle classification using FRED data",
        free: true,
        pro: true,
      },
      {
        label: "Options flow data",
        desc: "Real-time unusual options activity that can signal big moves",
        free: false,
        pro: true,
      },
      {
        label: "Dark pool activity",
        desc: "Institutional-level trades hidden from public exchanges",
        free: false,
        pro: true,
      },
      {
        label: "Congressional trade tracking",
        desc: "Follow what members of Congress are buying and selling",
        free: false,
        pro: true,
      },
    ],
  },
  {
    name: "Trading",
    icon: TrendingDown,
    features: [
      {
        label: "Paper trading",
        desc: "Practice strategies with virtual money, zero risk",
        free: true,
        pro: true,
      },
      {
        label: "Live trading via Alpaca",
        desc: "Execute real trades directly from Kosh with your brokerage",
        free: false,
        pro: true,
      },
      {
        label: "Auto-invest strategies",
        desc: "Allocate capital automatically based on our analysis engine",
        free: false,
        pro: true,
      },
      {
        label: "Advanced dip finder criteria",
        desc: "Custom screener filters to find undervalued opportunities",
        free: false,
        pro: true,
      },
    ],
  },
  {
    name: "AI Features",
    icon: Brain,
    features: [
      {
        label: "AI portfolio summary",
        desc: "Claude-powered analysis of your entire portfolio",
        free: "3/mo",
        pro: true,
      },
      {
        label: "AI earnings transcript summary",
        desc: "Key takeaways from earnings calls distilled by AI",
        free: "3/mo",
        pro: true,
      },
      {
        label: "Unlimited AI summaries",
        desc: "No monthly cap on AI-generated insights",
        free: false,
        pro: true,
      },
    ],
  },
  {
    name: "Alerts & Monitoring",
    icon: Bell,
    features: [
      {
        label: "Price & signal alerts",
        desc: "Get notified when stocks hit your target levels",
        free: "5 alerts",
        pro: true,
      },
      {
        label: "Unlimited signal alerts",
        desc: "No cap on how many alerts you can set",
        free: false,
        pro: true,
      },
    ],
  },
];

const faqs = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your Settings page or the Stripe customer portal. Your Pro access continues until the end of your billing period.",
  },
  {
    q: "Is there a free trial?",
    a: "Not yet, but the Free tier gives you full access to fundamental analysis, charts, paper trading, and basic signals -- no card required.",
  },
  {
    q: "Where does my payment go?",
    a: "Payments are processed securely by Stripe. We never see or store your card details.",
  },
  {
    q: "What happens to my data if I downgrade?",
    a: "All your analyses, portfolio, and search history are preserved. You just lose access to Pro-only features until you re-subscribe.",
  },
  {
    q: "Do I need an Alpaca account for live trading?",
    a: "Yes. Connect your Alpaca brokerage account in Settings to enable live trading. Paper trading works without one.",
  },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check size={16} className="text-emerald-400" />;
  }
  if (value === false) {
    return <X size={14} className="text-gray-700" />;
  }
  return <span className="text-xs text-gray-400 font-medium">{value}</span>;
}

export default function PricingPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isPro = user?.role === "ADMIN" || user?.tier === "PRO";
  const isAdmin = user?.role === "ADMIN";
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-black text-white">
          {isPro ? "Your Pro Plan" : "Upgrade to Pro"}
        </h1>
        <p className="text-gray-400 text-sm max-w-lg mx-auto">
          {isPro
            ? "You have full access to every feature Kosh offers."
            : "Unlock institutional-grade signals, live trading, unlimited AI, and more."}
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Free tier */}
        <Card className="space-y-5 relative">
          <div>
            <h2 className="text-lg font-bold text-white">Free</h2>
            <p className="text-3xl font-black text-white mt-2">
              $0<span className="text-sm text-gray-500 font-normal">/mo</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Everything you need to start analysing stocks
            </p>
          </div>
          <ul className="space-y-2.5">
            {[
              "Fundamental analysis reports",
              "FCF & SBC interactive charts",
              "Insider & analyst signals",
              "Paper trading simulator",
              "3 AI summaries per month",
              "5 price alerts",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-gray-400">
                <Check size={15} className="text-gray-500 mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <button className="w-full py-2.5 bg-gray-800 text-gray-400 rounded-xl font-semibold text-sm cursor-default">
            {isPro ? "Included" : "Current Plan"}
          </button>
        </Card>

        {/* Pro tier */}
        <div className="relative">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-amber-500/30 via-yellow-500/10 to-amber-500/5 blur-sm" />
          <Card className="relative space-y-5 !border-amber-500/30">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge variant="gold" className="!px-3 !py-1">
                <Zap size={10} className="mr-1" /> Most Popular
              </Badge>
            </div>
            <div className="pt-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Pro</h2>
                <Crown size={18} className="text-amber-400" />
              </div>
              <p className="text-3xl font-black text-white mt-2">
                $10<span className="text-sm text-gray-500 font-normal">/mo</span>
              </p>
              <p className="text-xs text-amber-300/60 mt-1">
                Full access to every Kosh feature
              </p>
            </div>
            <ul className="space-y-2.5">
              {[
                { label: "Everything in Free", icon: Check },
                { label: "Options flow & dark pool data", icon: Activity },
                { label: "Congressional trade tracking", icon: Shield },
                { label: "Live trading via Alpaca", icon: TrendingDown },
                { label: "Auto-invest strategies", icon: Zap },
                { label: "Unlimited AI summaries", icon: Infinity },
                { label: "Unlimited signal alerts", icon: Bell },
                { label: "Priority data refresh", icon: BarChart3 },
              ].map(({ label, icon: Icon }) => (
                <li key={label} className="flex items-start gap-2.5 text-sm text-gray-200">
                  <Icon size={15} className="text-amber-400 mt-0.5 shrink-0" />
                  {label}
                </li>
              ))}
            </ul>
            {isPro ? (
              <div className="w-full py-2.5 bg-gradient-to-r from-amber-600/20 to-yellow-600/20 text-amber-300 rounded-xl font-semibold text-sm text-center flex items-center justify-center gap-2 border border-amber-500/20">
                {isAdmin ? (
                  <><Shield size={14} /> Admin Access</>
                ) : (
                  <><Crown size={14} /> Active</>
                )}
              </div>
            ) : (
              <Button onClick={handleUpgrade} loading={loading} className="w-full !bg-gradient-to-r !from-amber-500 !to-yellow-500 !text-black !font-bold hover:!from-amber-400 hover:!to-yellow-400">
                <Crown size={14} className="mr-1.5" />
                Upgrade to Pro
              </Button>
            )}
          </Card>
        </div>
      </div>

      {/* Detailed feature comparison */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white text-center mb-6">
          Feature Comparison
        </h2>

        <div className="hidden sm:grid grid-cols-[1fr_80px_80px] gap-0 items-center px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <span>Feature</span>
          <span className="text-center">Free</span>
          <span className="text-center text-amber-400">Pro</span>
        </div>

        {featureCategories.map((cat) => (
          <div key={cat.name}>
            <div className="flex items-center gap-2 px-4 py-3 mt-4">
              <cat.icon size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-white">{cat.name}</h3>
            </div>
            <div className="rounded-xl border border-gray-800 overflow-hidden divide-y divide-gray-800/50">
              {cat.features.map((feat) => (
                <div
                  key={feat.label}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_80px_80px] gap-2 sm:gap-0 items-center px-4 py-3 hover:bg-gray-900/50 transition-colors"
                >
                  <div>
                    <p className="text-sm text-gray-200">{feat.label}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{feat.desc}</p>
                  </div>
                  <div className="flex sm:justify-center items-center gap-2 sm:gap-0">
                    <span className="text-xs text-gray-600 sm:hidden">Free: </span>
                    <FeatureValue value={feat.free} />
                  </div>
                  <div className="flex sm:justify-center items-center gap-2 sm:gap-0">
                    <span className="text-xs text-gray-600 sm:hidden">Pro: </span>
                    <FeatureValue value={feat.pro} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Value callout */}
      {!isPro && (
        <div className="text-center">
          <Card className="inline-block !bg-gradient-to-r from-amber-950/30 via-gray-900 to-amber-950/30 !border-amber-500/15 max-w-md">
            <div className="flex items-center gap-4 text-left">
              <div className="p-3 rounded-xl bg-amber-500/10 shrink-0">
                <Zap size={24} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  Make smarter decisions, faster
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Pro users get institutional-grade data that hedge funds pay thousands for -- for just $10/mo.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* FAQ */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-white text-center mb-4">
          Frequently Asked Questions
        </h2>
        <div className="max-w-2xl mx-auto space-y-2">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-800 overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-900/50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-200">
                  {faq.q}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-gray-500 transition-transform duration-200 shrink-0 ml-3 ${openFaq === i ? "rotate-180" : ""}`}
                />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA for free users */}
      {!isPro && (
        <div className="text-center pb-8">
          <Button
            onClick={handleUpgrade}
            loading={loading}
            className="!bg-gradient-to-r !from-amber-500 !to-yellow-500 !text-black !font-bold hover:!from-amber-400 hover:!to-yellow-400 !px-8 !py-3 !text-base"
          >
            <Crown size={16} className="mr-2" />
            Start Pro Today -- $10/mo
          </Button>
          <p className="text-xs text-gray-600 mt-3">
            Cancel anytime. No questions asked.
          </p>
        </div>
      )}
    </div>
  );
}
