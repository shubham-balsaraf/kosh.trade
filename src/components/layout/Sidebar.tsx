"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Home, Search, Briefcase, BarChart3, TrendingDown, Bell, Settings, CreditCard, Crown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import ProBadge from "@/components/ui/ProBadge";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Dashboard", proOnly: false },
  { href: "/search", icon: Search, label: "Search", proOnly: false },
  { href: "/portfolio", icon: Briefcase, label: "Portfolio", proOnly: false },
  { href: "/signals", icon: BarChart3, label: "Signals", proOnly: true },
  { href: "/dip-finder", icon: TrendingDown, label: "Dip Finder", proOnly: true },
  { href: "/alerts", icon: Bell, label: "Alerts", proOnly: false },
  { href: "/settings", icon: Settings, label: "Settings", proOnly: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isPro = user?.role === "ADMIN" || user?.tier === "PRO";

  return (
    <aside className={cn(
      "hidden md:flex flex-col w-56 shrink-0 border-r bg-black min-h-[calc(100vh-4rem)] p-4 gap-1",
      isPro ? "border-amber-900/20" : "border-gray-800"
    )}>
      {isPro && (
        <div className="mb-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
            <Zap size={14} />
            Pro Features Active
          </div>
        </div>
      )}

      {navItems.map(({ href, icon: Icon, label, proOnly }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
              active && isPro
                ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                : active
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-900"
            )}
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            {proOnly && isPro && <ProBadge size="sm" />}
            {proOnly && !isPro && (
              <Crown size={12} className="text-gray-600" />
            )}
          </Link>
        );
      })}

      <div className="mt-auto pt-4 border-t border-gray-800/50">
        <Link
          href="/pricing"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
            pathname === "/pricing"
              ? isPro
                ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
              : isPro
                ? "text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/5"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-900"
          )}
        >
          {isPro ? <Crown size={18} /> : <CreditCard size={18} />}
          {isPro ? "My Plan" : "Upgrade to Pro"}
        </Link>
      </div>
    </aside>
  );
}
