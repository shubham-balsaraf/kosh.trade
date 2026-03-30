"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Home, Search, Briefcase, BarChart3, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/portfolio", icon: Briefcase, label: "Portfolio" },
  { href: "/signals", icon: BarChart3, label: "Signals" },
  { href: "/settings", icon: User, label: "Profile" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isPro = user?.role === "ADMIN" || user?.tier === "PRO";

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t md:hidden safe-area-pb",
      isPro ? "bg-black/95 border-amber-900/30" : "bg-black/90 border-gray-800"
    )}>
      <div className="flex justify-around items-center h-16">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 py-1 px-3 transition-colors",
                active && isPro ? "text-amber-300" : active ? "text-white" : "text-gray-500"
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px]">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
