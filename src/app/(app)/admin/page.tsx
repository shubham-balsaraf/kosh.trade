"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import {
  ShieldCheck, Users, Crown, Search, ToggleLeft, ToggleRight,
  RefreshCw, UserCheck, UserX, Loader2, Mail, Calendar, Activity,
  Ban, ShieldOff,
} from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  role: string;
  image: string | null;
  bannedUntil: string | null;
  createdAt: string;
  _count: { autoTrades: number; searchHistory: number };
}

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user as any;
  const isAdmin = user?.role === "ADMIN";

  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [proUsers, setProUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [gateEnabled, setGateEnabled] = useState(false);
  const [gateLoading, setGateLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin");
      if (!res.ok) {
        router.push("/dashboard");
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
      setTotalUsers(data.totalUsers || 0);
      setProUsers(data.proUsers || 0);
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin?action=settings");
      if (res.ok) {
        const data = await res.json();
        setGateEnabled(data.proGateEnabled ?? false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (session && !isAdmin) {
      router.push("/dashboard");
      return;
    }
    if (isAdmin) {
      fetchUsers();
      fetchSettings();
    }
  }, [session, isAdmin, router, fetchUsers, fetchSettings]);

  const toggleTier = async (userId: string, currentTier: string) => {
    setUpdating(userId);
    try {
      const newTier = currentTier === "PRO" ? "FREE" : "PRO";
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-tier", userId, tier: newTier }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, tier: newTier } : u))
        );
        setProUsers((prev) => (newTier === "PRO" ? prev + 1 : prev - 1));
      }
    } catch {} finally {
      setUpdating(null);
    }
  };

  const toggleRestrict = async (userId: string, isRestricted: boolean) => {
    setUpdating(userId);
    try {
      const action = isRestricted ? "unrestrict-user" : "restrict-user";
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? { ...u, tier: data.tier, bannedUntil: data.bannedUntil }
              : u
          )
        );
      }
    } catch {} finally {
      setUpdating(null);
    }
  };

  const toggleGate = async () => {
    setGateLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-gate", enabled: !gateEnabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setGateEnabled(data.proGateEnabled);
      }
    } catch {} finally {
      setGateLoading(false);
    }
  };

  const filtered = users.filter((u) => {
    const q = filter.toLowerCase();
    return (
      !q ||
      u.email?.toLowerCase().includes(q) ||
      u.name?.toLowerCase().includes(q) ||
      u.tier.toLowerCase().includes(q)
    );
  });

  if (!isAdmin) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="relative mesh-bg rounded-3xl p-6 overflow-hidden">
        <div className="orb orb-gold-1 top-[-120px] right-[-80px]" />
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <ShieldCheck size={24} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Admin Panel</h1>
              <p className="text-xs text-white/30">God mode. Manage users, tiers, and feature access.</p>
            </div>
          </div>
          <button
            onClick={() => { setLoading(true); fetchUsers(); fetchSettings(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/70 text-xs transition-all"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <Users size={18} className="mx-auto text-white/15 mb-1" />
          <p className="text-2xl font-bold text-white">{totalUsers}</p>
          <p className="text-[10px] text-white/25 uppercase tracking-wider">Total Users</p>
        </Card>
        <Card className="p-4 text-center">
          <Crown size={18} className="mx-auto text-amber-400/40 mb-1" />
          <p className="text-2xl font-bold text-amber-300">{proUsers}</p>
          <p className="text-[10px] text-white/25 uppercase tracking-wider">Pro Users</p>
        </Card>
        <Card className="p-4 text-center">
          <UserX size={18} className="mx-auto text-white/15 mb-1" />
          <p className="text-2xl font-bold text-white">{totalUsers - proUsers}</p>
          <p className="text-[10px] text-white/25 uppercase tracking-wider">Free Users</p>
        </Card>
        <Card className="p-4 text-center">
          <Activity size={18} className="mx-auto text-white/15 mb-1" />
          <p className="text-2xl font-bold text-white">{users.reduce((s, u) => s + u._count.autoTrades, 0)}</p>
          <p className="text-[10px] text-white/25 uppercase tracking-wider">Total Trades</p>
        </Card>
      </div>

      {/* Feature Gate Toggle */}
      <Card className={`p-5 border ${gateEnabled ? "border-red-500/20" : "border-white/[0.04]"}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Pro Feature Gate
              {gateEnabled && <Badge variant="red">ACTIVE</Badge>}
            </h3>
            <p className="text-xs text-white/30 mt-1">
              {gateEnabled
                ? "Pro features are BLOCKED for non-Pro users. Only Pro and Admin users can access gold features."
                : "Pro features are currently accessible to all users (preview mode)."}
            </p>
          </div>
          <button
            onClick={toggleGate}
            disabled={gateLoading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all ${
              gateEnabled
                ? "bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20"
                : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20"
            }`}
          >
            {gateLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : gateEnabled ? (
              <ToggleRight size={18} />
            ) : (
              <ToggleLeft size={18} />
            )}
            {gateEnabled ? "Disable Gate (Allow All)" : "Enable Gate (Block Free Users)"}
          </button>
        </div>
      </Card>

      {/* User List */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users size={16} className="text-white/30" />
            All Users ({filtered.length})
          </h3>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              placeholder="Filter by email or name..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-white/10 w-64"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          {filtered.map((u) => {
            const isRestricted = u.bannedUntil && new Date(u.bannedUntil) > new Date();
            return (
              <div
                key={u.id}
                className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                  isRestricted
                    ? "bg-red-500/[0.03] border border-red-500/10"
                    : u.role === "ADMIN"
                      ? "bg-indigo-500/[0.04] border border-indigo-500/10"
                      : u.tier === "PRO"
                        ? "bg-amber-500/[0.03] border border-amber-500/8"
                        : "bg-white/[0.015] border border-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                    isRestricted
                      ? "bg-gradient-to-br from-red-800 to-red-900"
                      : u.role === "ADMIN"
                        ? "bg-gradient-to-br from-indigo-500 to-purple-600"
                        : u.tier === "PRO"
                          ? "bg-gradient-to-br from-amber-500 to-yellow-600"
                          : "bg-white/[0.06]"
                  }`}>
                    {isRestricted ? <Ban size={14} /> : u.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium truncate ${isRestricted ? "text-red-300/70" : "text-white"}`}>{u.name || "No name"}</p>
                      {u.role === "ADMIN" && <Badge variant="indigo">Admin</Badge>}
                      {isRestricted && <Badge variant="red">Restricted</Badge>}
                      {!isRestricted && u.tier === "PRO" && u.role !== "ADMIN" && <Badge variant="gold">Pro</Badge>}
                      {!isRestricted && u.tier === "FREE" && u.role !== "ADMIN" && (
                        <span className="text-[9px] text-white/20 font-medium px-1.5 py-0.5 bg-white/[0.03] rounded">FREE</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-white/25 flex items-center gap-1">
                        <Mail size={9} /> {u.email}
                      </span>
                      <span className="text-[10px] text-white/15 flex items-center gap-1">
                        <Calendar size={9} /> {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] text-white/15">
                        {u._count.autoTrades} trades · {u._count.searchHistory} searches
                      </span>
                    </div>
                  </div>
                </div>

                {u.role !== "ADMIN" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleRestrict(u.id, !!isRestricted)}
                      disabled={updating === u.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isRestricted
                          ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/15 hover:bg-emerald-500/20"
                          : "bg-orange-500/10 text-orange-300 border border-orange-500/15 hover:bg-orange-500/20"
                      }`}
                    >
                      {updating === u.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : isRestricted ? (
                        <><ShieldOff size={12} /> Unrestrict</>
                      ) : (
                        <><Ban size={12} /> Restrict</>
                      )}
                    </button>
                    {!isRestricted && (
                      <button
                        onClick={() => toggleTier(u.id, u.tier)}
                        disabled={updating === u.id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          u.tier === "PRO"
                            ? "bg-red-500/10 text-red-300 border border-red-500/15 hover:bg-red-500/20"
                            : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/15 hover:bg-emerald-500/20"
                        }`}
                      >
                        {updating === u.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : u.tier === "PRO" ? (
                          <><UserX size={12} /> Revoke Pro</>
                        ) : (
                          <><UserCheck size={12} /> Grant Pro</>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
