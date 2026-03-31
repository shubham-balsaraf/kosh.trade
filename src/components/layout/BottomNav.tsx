"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Home, Search, Navigation, BarChart3, MoreHorizontal, Briefcase, TrendingDown, Bell, Settings, HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const mainItems = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/trading/auto", icon: Navigation, label: "KoshPilot" },
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
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div className="absolute bottom-20 left-4 right-4 bg-[#0a0a0f]/95 backdrop-blur-2xl border border-white/[0.06] rounded-2xl p-2 z-50 safe-area-pb" onClick={(e) => e.stopPropagation()}>
            {moreItems.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setShowMore(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                    active && isPro ? "bg-amber-500/8 text-amber-300/90" : active ? "bg-white/[0.05] text-white" : "text-white/35 hover:text-white/60 hover:bg-white/[0.04]"
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
        "fixed bottom-0 left-0 right-0 z-40 backdrop-blur-2xl border-t md:hidden safe-area-pb",
        isPro ? "bg-[#050507]/95 border-amber-500/8" : "bg-[#050507]/95 border-white/[0.04]"
      )}>
        <div className="flex justify-around items-center h-14">
          {mainItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1 px-3 min-w-[48px] min-h-[44px] justify-center transition-all duration-300",
                  active && isPro ? "text-amber-300/90" : active ? "text-white" : "text-white/25"
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-1 px-3 min-w-[48px] min-h-[44px] justify-center transition-all duration-300",
              showMore ? "text-white" : moreActive && isPro ? "text-amber-300/90" : moreActive ? "text-white" : "text-white/25"
            )}
          >
            {showMore ? <X size={20} strokeWidth={2} /> : <MoreHorizontal size={20} strokeWidth={moreActive ? 2.5 : 1.5} />}
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
