"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Crown, ChevronRight, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/useMediaQuery";
import StockLogo from "@/components/ui/StockLogo";

interface HistoryItem {
  id: string;
  ticker: string;
  companyName: string | null;
  sector: string | null;
  verdict: string | null;
  createdAt: string;
}

interface UsageInfo {
  isPro: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
}

const VERDICT_COLORS: Record<string, string> = {
  CONSIDER: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  MODERATE: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  AVOID: "bg-red-500/15 text-red-400 border-red-500/20",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AnalysisHistory({ currentTicker }: { currentTicker: string }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const mobile = useIsMobile();
  const pathname = usePathname();

  useEffect(() => {
    Promise.all([
      fetch("/api/history").then((r) => r.json()),
      fetch("/api/usage").then((r) => r.json()),
    ])
      .then(([historyData, usageData]) => {
        setHistory(historyData.history || []);
        setUsage(usageData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pathname]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-12 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <History size={14} className="text-gray-500" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Analysis History
          </span>
        </div>
        {mobile && (
          <ChevronDown
            size={14}
            className={`text-gray-500 transition-transform ${collapsed ? "" : "rotate-180"}`}
          />
        )}
      </button>

      {usage && !usage.isPro && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-500">
              {usage.used}/{usage.limit} stocks used
            </span>
            <span
              className={`text-[11px] font-semibold ${
                (usage.remaining ?? 0) <= 3 ? "text-amber-400" : "text-gray-400"
              }`}
            >
              {usage.remaining} left
            </span>
          </div>
          <div className="mt-1.5 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (usage.remaining ?? 0) <= 3 ? "bg-amber-500" : "bg-indigo-500"
              }`}
              style={{ width: `${Math.min(100, ((usage.used || 0) / (usage.limit || 15)) * 100)}%` }}
            />
          </div>
          {(usage.remaining ?? 0) <= 3 && (
            <Link
              href="/pricing"
              className="flex items-center gap-1 mt-2 text-[11px] text-amber-400 hover:text-amber-300 font-medium"
            >
              <Crown size={10} />
              Upgrade for unlimited
              <ChevronRight size={10} />
            </Link>
          )}
        </div>
      )}

      {!collapsed && (
        <div className={`space-y-1 ${mobile ? "max-h-48 overflow-y-auto" : "max-h-[60vh] overflow-y-auto"}`}>
          {history.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-4">No analyses yet</p>
          ) : (
            history.map((item) => {
              const isActive = item.ticker === currentTicker.toUpperCase();
              return (
                <Link
                  key={item.id}
                  href={`/stock/${item.ticker}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-sm ${
                    isActive
                      ? "bg-indigo-500/10 border border-indigo-500/20 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                >
                  <StockLogo ticker={item.ticker} size={24} className="rounded-md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs">{item.ticker}</span>
                      {item.verdict && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold border ${
                            VERDICT_COLORS[item.verdict] || "bg-gray-800 text-gray-400"
                          }`}
                        >
                          {item.verdict}
                        </span>
                      )}
                    </div>
                    {item.companyName && (
                      <p className="text-[10px] text-gray-600 truncate">{item.companyName}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-600 shrink-0">{timeAgo(item.createdAt)}</span>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
