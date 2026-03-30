"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Search, Bell, User, LogOut, Shield, Crown } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";

export default function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  const user = session?.user as any;
  const isPro = user?.role === "ADMIN" || user?.tier === "PRO";
  const isAdmin = user?.role === "ADMIN";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/stock/${query.trim().toUpperCase()}`);
      setQuery("");
    }
  };

  return (
    <nav className={`sticky top-0 z-40 backdrop-blur-xl border-b ${isPro ? "bg-black/85 border-amber-900/30" : "bg-black/80 border-gray-800"}`}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <span className={`text-xl font-black tracking-tight ${isPro ? "bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent" : "text-white"}`}>
            Kosh
          </span>
          {isPro && (
            <Badge variant={isAdmin ? "indigo" : "gold"}>
              {isAdmin ? <><Shield size={10} className="mr-1" />Admin</> : <><Crown size={10} className="mr-1" />Pro</>}
            </Badge>
          )}
        </Link>

        <form onSubmit={handleSearch} className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            placeholder="Search ticker... AAPL, MSFT, GOOGL"
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            className={`w-full bg-gray-900 border rounded-xl pl-10 pr-4 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 ${isPro ? "border-amber-900/20 focus:ring-amber-500/50 focus:border-amber-500/50" : "border-gray-800 focus:ring-indigo-500 focus:border-indigo-500"}`}
          />
        </form>

        <div className="flex items-center gap-2">
          {!isPro && (
            <Link href="/pricing" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold hover:from-amber-500/30 hover:to-yellow-500/30 transition-all">
              <Crown size={12} />
              Get Pro
            </Link>
          )}

          <Link href="/alerts" className="p-2 text-gray-400 hover:text-white transition-colors relative">
            <Bell size={20} />
          </Link>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${isPro ? "bg-gradient-to-br from-amber-500 to-yellow-600" : "bg-gradient-to-br from-indigo-500 to-purple-600"}`}
            >
              {user?.name?.[0]?.toUpperCase() || <User size={14} />}
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-xl py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-800">
                  <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  {isPro && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-amber-300">
                      <Crown size={9} /> {isAdmin ? "Admin" : "Pro"} Member
                    </span>
                  )}
                </div>
                <Link href="/settings" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800" onClick={() => setShowMenu(false)}>Settings</Link>
                {isPro ? (
                  <Link href="/pricing" className="block px-4 py-2 text-sm text-amber-300 hover:bg-gray-800" onClick={() => setShowMenu(false)}>My Plan</Link>
                ) : (
                  <Link href="/pricing" className="block px-4 py-2 text-sm text-amber-400 hover:bg-gray-800 flex items-center gap-1.5" onClick={() => setShowMenu(false)}>
                    <Crown size={12} /> Upgrade to Pro
                  </Link>
                )}
                <button onClick={() => signOut({ callbackUrl: "/login" })} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 flex items-center gap-2">
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
