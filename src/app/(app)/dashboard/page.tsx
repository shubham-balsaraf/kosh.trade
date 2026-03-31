import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Search, TrendingUp, Briefcase, BarChart3, Crown, Zap, Activity, Brain, ArrowRight } from "lucide-react";
import FearGreedGauge from "@/components/market/FearGreedGauge";
import StockLogo from "@/components/ui/StockLogo";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const userId = user?.id;
  const isPro = user?.role === "ADMIN" || user?.tier === "PRO";

  const recentSearches = userId
    ? await prisma.searchHistory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        distinct: ["ticker"],
        take: 20,
      })
    : [];

  return (
    <div className="space-y-6">
      {isPro ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-950/40 via-yellow-950/30 to-amber-950/40 border border-amber-500/20 p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Crown size={20} className="text-amber-400" />
              <span className="text-xs font-semibold text-amber-400 tracking-wide uppercase">Pro Member</span>
            </div>
            <h1 className="text-2xl font-bold text-white">
              Welcome back, {session?.user?.name?.split(" ")[0] || "Investor"}
            </h1>
            <p className="text-amber-200/50 text-sm mt-1">
              All premium features are unlocked
            </p>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {session?.user?.name?.split(" ")[0] || "Investor"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Your fundamental analysis feed
          </p>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/search", icon: Search, label: "Analyse Stock", color: "text-indigo-400" },
          { href: "/portfolio", icon: Briefcase, label: "Portfolio", color: "text-emerald-400" },
          { href: "/signals", icon: BarChart3, label: "Signals", color: "text-amber-400" },
          { href: "/dip-finder", icon: TrendingUp, label: "Dip Finder", color: "text-blue-400" },
        ].map(({ href, icon: Icon, label, color }) => (
          <Link key={href} href={href}>
            <Card hover className="flex items-center gap-3 !p-3">
              <div className={`p-2 rounded-xl bg-gray-800 ${color}`}>
                <Icon size={18} />
              </div>
              <span className="text-sm font-medium text-gray-300">{label}</span>
            </Card>
          </Link>
        ))}
      </div>

      {/* Market Sentiment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <FearGreedGauge />
        </div>
        <div className="md:col-span-2 flex items-center">
          <Card className="w-full !bg-gray-900/30">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-400">How to Read This</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-red-400 font-bold">0-20</span>
                <p className="text-gray-500">Extreme Fear — potential buying opportunity</p>
              </div>
              <div>
                <span className="text-orange-400 font-bold">21-40</span>
                <p className="text-gray-500">Fear — market is cautious</p>
              </div>
              <div>
                <span className="text-yellow-400 font-bold">41-60</span>
                <p className="text-gray-500">Neutral — balanced sentiment</p>
              </div>
              <div>
                <span className="text-lime-400 font-bold">61-80</span>
                <p className="text-gray-500">Greed — market is optimistic</p>
              </div>
              <div>
                <span className="text-emerald-400 font-bold">81-100</span>
                <p className="text-gray-500">Extreme Greed — caution advised</p>
              </div>
              <div>
                <span className="text-gray-400 font-bold">S&P 500</span>
                <p className="text-gray-500">Based on momentum, trend, breadth & volatility</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {isPro ? (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Zap size={18} className="text-amber-400" />
            Pro Toolkit
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { href: "/trading", icon: Activity, label: "Live Trading", desc: "Execute real trades via Alpaca", color: "from-emerald-500/15 to-emerald-600/5 border-emerald-500/20", iconColor: "text-emerald-400" },
              { href: "/signals", icon: BarChart3, label: "Options Flow", desc: "Dark pool & congressional data", color: "from-blue-500/15 to-blue-600/5 border-blue-500/20", iconColor: "text-blue-400" },
              { href: "/portfolio", icon: Brain, label: "AI Unlimited", desc: "Unlimited AI portfolio summaries", color: "from-purple-500/15 to-purple-600/5 border-purple-500/20", iconColor: "text-purple-400" },
            ].map(({ href, icon: Icon, label, desc, color, iconColor }) => (
              <Link key={href} href={href}>
                <Card hover className={`!bg-gradient-to-br ${color} !border space-y-2`}>
                  <div className="flex items-center gap-2">
                    <Icon size={18} className={iconColor} />
                    <span className="text-sm font-semibold text-white">{label}</span>
                  </div>
                  <p className="text-xs text-gray-400">{desc}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <Link href="/pricing">
          <Card hover className="relative overflow-hidden !bg-gradient-to-r from-amber-950/30 via-gray-900 to-amber-950/30 !border-amber-500/15">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="p-2.5 sm:p-3 rounded-xl bg-amber-500/10 shrink-0">
                  <Crown size={20} className="text-amber-400 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white">Unlock Pro Features</h3>
                  <p className="text-xs text-gray-400 mt-0.5 truncate sm:whitespace-normal">
                    Options flow, live trading, unlimited AI, and more for $10/mo
                  </p>
                </div>
              </div>
              <ArrowRight size={18} className="text-amber-400 shrink-0" />
            </div>
          </Card>
        </Link>
      )}

      {/* Recent analyses feed */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Recent Analyses</h2>
        {recentSearches.length === 0 ? (
          <Card className="text-center py-12">
            <Search size={40} className="mx-auto text-gray-700 mb-3" />
            <p className="text-gray-500">No analyses yet</p>
            <p className="text-gray-600 text-sm mt-1">
              Search for a stock to get started
            </p>
            <Link
              href="/search"
              className="inline-block mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Analyse Your First Stock
            </Link>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentSearches.map((item: any) => {
              const verdictColors: Record<string, "green" | "yellow" | "red"> = {
                CONSIDER: "green",
                MODERATE: "yellow",
                AVOID: "red",
              };
              return (
                <Link key={item.id} href={`/stock/${item.ticker}`}>
                  <Card hover className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <StockLogo ticker={item.ticker} size={36} />
                        <div className="min-w-0">
                          <span className="text-lg font-bold text-white">
                            {item.ticker}
                          </span>
                          {item.companyName && (
                            <p className="text-xs text-gray-500 truncate">
                              {item.companyName}
                            </p>
                          )}
                        </div>
                      </div>
                      {item.verdict && (
                        <Badge variant={verdictColors[item.verdict] || "gray"}>
                          {item.verdict}
                        </Badge>
                      )}
                    </div>
                    {item.sector && (
                      <Badge variant="gray">{item.sector}</Badge>
                    )}
                    <p className="text-[11px] text-gray-600">
                      {new Date(item.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
