"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Home, Search, Bot, BarChart3, MoreHorizontal, Briefcase, TrendingDown, Bell, Settings, HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const mainItems = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/trading/auto", icon: Bot, label: "AutoTrader" },
  { href: "/signals", icon: BarChart3, label: "Signals" },
];

const moreItems = [
  { href: "/portfolio", icon: Briefcase, label: "Portfolio" },
  { href: "/dip-finder", icon: TrendingDown, label: "Dip Finder" },
  { href: "/alerts", icon: Bell, label: "Alerts" },
  { href: "/settings", icon: Settings, label: "Settings" },
  { href: "/support", icon: HelpCircle, label: "Support" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showMore, setShowMore] = useState(false);
  const user = session?.user as any;
  const isPro = user?.role === "ADMIN" || user?.tier === "PRO";

  const moreActive = moreItems.some(({ href }) => pathname === href || pathname.startsWith(href + "/"));

  return (
    <>
      {showMore && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute bottom-20 left-4 right-4 bg-gray-900 border border-gray-800 rounded-2xl p-2 z-50 safe-area-pb" onClick={(e) => e.stopPropagation()}>
            {moreItems.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setShowMore(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                    active && isPro ? "bg-amber-500/10 text-amber-300" : active ? "bg-indigo-500/10 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
                  )}
                >
                  <Icon size={20} />
                  <span className="text-sm font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t md:hidden safe-area-pb",
        isPro ? "bg-black/95 border-amber-900/30" : "bg-black/90 border-gray-800"
      )}>
        <div className="flex justify-around items-center h-16">
          {mainItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 py-1 px-3 min-w-[48px] min-h-[44px] justify-center transition-colors",
                  active && isPro ? "text-amber-300" : active ? "text-white" : "text-gray-500"
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px]">{label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              "flex flex-col items-center gap-1 py-1 px-3 min-w-[48px] min-h-[44px] justify-center transition-colors",
              showMore ? "text-white" : moreActive && isPro ? "text-amber-300" : moreActive ? "text-white" : "text-gray-500"
            )}
          >
            {showMore ? <X size={22} strokeWidth={2} /> : <MoreHorizontal size={22} strokeWidth={moreActive ? 2.5 : 1.5} />}
            <span className="text-[10px]">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
