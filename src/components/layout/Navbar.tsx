"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Search, Bell, User, LogOut, Shield, Crown } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Logo from "@/components/ui/Logo";

export default function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const user = session?.user as any;
  const isPro = user?.role === "ADMIN" || user?.tier === "PRO";
  const isAdmin = user?.role === "ADMIN";

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 1) { setSuggestions([]); return; }
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data.results?.slice(0, 6) || []);
    } catch { setSuggestions([]); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchSuggestions]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const goToStock = (ticker: string) => {
    router.push(`/stock/${ticker.toUpperCase()}`);
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestions.length > 0) goToStock(suggestions[0].symbol);
    else if (query.trim()) goToStock(query.trim());
  };

  return (
    <nav className={`sticky top-0 z-40 backdrop-blur-xl border-b ${isPro ? "bg-black/85 border-amber-900/30" : "bg-black/80 border-gray-800"}`}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Logo size="md" showDomain isPro={isPro} />
          {isPro && (
            <Badge variant={isAdmin ? "indigo" : "gold"}>
              {isAdmin ? <><Shield size={10} className="mr-1" />Admin</> : <><Crown size={10} className="mr-1" />Pro</>}
            </Badge>
          )}
        </Link>

        <div ref={searchRef} className="flex-1 max-w-md relative hidden sm:block">
          <form onSubmit={handleSearch}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10" size={16} />
            <input
              type="text"
              placeholder="Search... Apple, AAPL, Cisco"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              className={`w-full bg-gray-900 border rounded-xl pl-10 pr-4 py-2 text-base sm:text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 ${isPro ? "border-amber-900/20 focus:ring-amber-500/50 focus:border-amber-500/50" : "border-gray-800 focus:ring-indigo-500 focus:border-indigo-500"}`}
            />
          </form>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50">
              {suggestions.map((s: any) => (
                <button
                  key={s.symbol}
                  onClick={() => goToStock(s.symbol)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors text-left"
                >
                  <span className="text-white font-bold text-xs bg-gray-800 px-2 py-0.5 rounded">{s.symbol}</span>
                  <span className="text-gray-400 text-sm truncate">{s.name}</span>
                  <span className="text-gray-600 text-xs ml-auto shrink-0">{s.exchangeShortName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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
