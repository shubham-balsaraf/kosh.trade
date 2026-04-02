"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Home, Search, Briefcase, BarChart3, TrendingDown, Bell, Settings, CreditCard, Crown, Zap, HelpCircle, Navigation, Trophy, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import ProBadge from "@/components/ui/ProBadge";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Dashboard", proOnly: false },
  { href: "/search", icon: Search, label: "Search", proOnly: false },
  { href: "/portfolio", icon: Briefcase, label: "Portfolio", proOnly: false },
  { href: "/trading/auto", icon: Navigation, label: "KoshPilot", proOnly: true },
  { href: "/top-picks", icon: Trophy, label: "Top Picks", proOnly: true },
  { href: "/signals", icon: BarChart3, label: "Signals", proOnly: true },
  { href: "/dip-finder", icon: TrendingDown, label: "Dip Finder", proOnly: true },
  { href: "/alerts", icon: Bell, label: "Alerts", proOnly: false },
  { href: "/settings", icon: Settings, label: "Settings", proOnly: false },
  { href: "/support", icon: HelpCircle, label: "Support", proOnly: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isAdmin = user?.role === "ADMIN";
  const isPro = isAdmin || (user?.tier === "PRO" && !user?.banned);

  return (
    <aside className={cn(
      "hidden md:flex flex-col w-56 shrink-0 border-r bg-[#050507] min-h-[calc(100vh-3.5rem)] p-3 gap-0.5",
      isPro ? "border-amber-500/8" : "border-white/[0.04]"
    )}>
      {isPro && (
        <div className="mb-3 px-3 py-2.5 rounded-xl bg-amber-500/[0.04] border border-amber-500/10">
          <div className="flex items-center gap-2 text-amber-300/80 text-xs font-semibold">
            <Zap size={13} />
            Pro Active
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
              "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300",
              active && isPro
                ? "bg-amber-500/8 text-amber-300/90 border border-amber-500/12"
                : active
                  ? "bg-white/[0.05] text-white border border-white/[0.06]"
                  : "text-white/35 hover:text-white/60 hover:bg-white/[0.03]"
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

      {isAdmin && (
        <Link
          href="/admin"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300",
            pathname === "/admin" || pathname.startsWith("/admin/")
              ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/15"
              : "text-indigo-400/60 hover:text-indigo-300 hover:bg-indigo-500/[0.06]"
          )}
        >
          <ShieldCheck size={18} />
          <span className="flex-1">Admin Panel</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400/80 font-bold">ADM</span>
        </Link>
      )}

      <div className="mt-auto pt-3 border-t border-white/[0.04] space-y-0.5">
        <Link
          href="/pricing"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300",
            pathname === "/pricing"
              ? isPro
                ? "bg-amber-500/8 text-amber-300/90 border border-amber-500/12"
                : "bg-white/[0.05] text-white border border-white/[0.06]"
              : isPro
                ? "text-amber-400/40 hover:text-amber-300/80 hover:bg-amber-500/[0.04]"
                : "text-white/35 hover:text-white/60 hover:bg-white/[0.03]"
          )}
        >
          {isPro ? <Crown size={18} /> : <CreditCard size={18} />}
          {isPro ? "My Plan" : "Upgrade to Pro"}
        </Link>
      </div>
    </aside>
  );
}
