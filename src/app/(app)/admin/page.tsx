"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import {
  ShieldCheck, Users, Crown, Search, ToggleLeft, ToggleRight,
  RefreshCw, UserCheck, UserX, Loader2, Mail, Calendar, Activity,
  Ban, ShieldOff, Clock, Eye, LogIn, ChevronDown, ChevronUp,
  BarChart3, MousePointer,
} from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  role: string;
  image: string | null;
  bannedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  _count: { autoTrades: number; searchHistory: number; activityLogs: number };
}

interface ActivityEntry {
  id: string;
  action: string;
  detail: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: { name: string | null; email: string };
}

interface UserActivity {
  logs: ActivityEntry[];
  loginCount: number;
  lastLogin: string | null;
  featureViews: { feature: string; count: number }[];
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: "Login", color: "text-emerald-400" },
  signup: { label: "Signup", color: "text-blue-400" },
  page_view: { label: "Page View", color: "text-indigo-400" },
  feature_use: { label: "Feature Use", color: "text-amber-400" },
  search: { label: "Search", color: "text-cyan-400" },
  generate_picks: { label: "Generate Picks", color: "text-purple-400" },
  run_koshpilot: { label: "Run KoshPilot", color: "text-orange-400" },
  settings_change: { label: "Settings", color: "text-gray-400" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function shortUA(ua: string | null) {
  if (!ua) return "";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Mac")) return "Mac";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Linux")) return "Linux";
  return "Other";
}

function UserDetailPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = useState<UserActivity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin?action=user-activity&userId=${userId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <Loader2 size={18} className="animate-spin text-white/20 mx-auto" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mt-3 p-4 bg-white/[0.02] rounded-xl border border-white/[0.06] space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">User Activity</h4>
        <button onClick={onClose} className="text-[10px] text-white/20 hover:text-white/40">Close</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="p-2.5 bg-white/[0.02] rounded-lg text-center">
          <LogIn size={14} className="mx-auto text-emerald-400/40 mb-1" />
          <p className="text-lg font-bold text-white">{data.loginCount}</p>
          <p className="text-[9px] text-white/20">Total Logins</p>
        </div>
        <div className="p-2.5 bg-white/[0.02] rounded-lg text-center">
          <Clock size={14} className="mx-auto text-blue-400/40 mb-1" />
          <p className="text-xs font-bold text-white">{data.lastLogin ? timeAgo(data.lastLogin) : "Never"}</p>
          <p className="text-[9px] text-white/20">Last Login</p>
        </div>
        <div className="p-2.5 bg-white/[0.02] rounded-lg text-center">
          <Eye size={14} className="mx-auto text-indigo-400/40 mb-1" />
          <p className="text-lg font-bold text-white">{data.featureViews.reduce((s, f) => s + f.count, 0)}</p>
          <p className="text-[9px] text-white/20">Page Views</p>
        </div>
        <div className="p-2.5 bg-white/[0.02] rounded-lg text-center">
          <BarChart3 size={14} className="mx-auto text-amber-400/40 mb-1" />
          <p className="text-lg font-bold text-white">{data.logs.length}</p>
          <p className="text-[9px] text-white/20">Total Events</p>
        </div>
      </div>

      {data.featureViews.length > 0 && (
        <div>
          <p className="text-[10px] text-white/25 font-semibold uppercase mb-2">Feature Usage</p>
          <div className="flex flex-wrap gap-1.5">
            {data.featureViews.sort((a, b) => b.count - a.count).map((f) => (
              <span key={f.feature} className="px-2 py-1 bg-indigo-500/8 border border-indigo-500/12 rounded-lg text-[10px] text-indigo-300/70">
                {f.feature} <span className="text-white/30 ml-1">×{f.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] text-white/25 font-semibold uppercase mb-2">Recent Activity ({data.logs.length})</p>
        <div className="space-y-0.5 max-h-60 overflow-y-auto">
          {data.logs.slice(0, 30).map((log) => {
            const meta = ACTION_LABELS[log.action] || { label: log.action, color: "text-white/40" };
            return (
              <div key={log.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] text-[10px]">
                <span className={`font-semibold w-20 shrink-0 ${meta.color}`}>{meta.label}</span>
                <span className="text-white/25 flex-1 truncate">{log.detail || "—"}</span>
                <span className="text-white/15 shrink-0">{shortUA(log.userAgent)}</span>
                <span className="text-white/15 shrink-0 w-14 text-right">{timeAgo(log.createdAt)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActivityFeed() {
  const [logs, setLogs] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin?action=activity-feed")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={16} className="text-white/20" />
          <h3 className="text-sm font-bold text-white">Live Activity Feed</h3>
        </div>
        <Loader2 size={16} className="animate-spin text-white/15 mx-auto" />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={16} className="text-white/20" />
        <h3 className="text-sm font-bold text-white">Live Activity Feed</h3>
        <span className="text-[9px] text-white/15">Last 50 events</span>
      </div>
      <div className="space-y-0.5 max-h-72 overflow-y-auto">
        {logs.length === 0 && <p className="text-white/15 text-xs text-center py-4">No activity yet</p>}
        {logs.map((log) => {
          const meta = ACTION_LABELS[log.action] || { label: log.action, color: "text-white/40" };
          return (
            <div key={log.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] text-[10px]">
              <span className={`font-semibold w-20 shrink-0 ${meta.color}`}>{meta.label}</span>
              <span className="text-white/40 shrink-0 truncate max-w-28">{log.user?.name || log.user?.email}</span>
              <span className="text-white/20 flex-1 truncate">{log.detail || ""}</span>
              <span className="text-white/15 shrink-0 w-14 text-right">{timeAgo(log.createdAt)}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
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
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

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

      {/* Activity Feed */}
      <ActivityFeed />

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
            const isExpanded = expandedUser === u.id;
            return (
              <div key={u.id}>
                <div
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
                  <div className="flex items-center gap-3 min-w-0 flex-1">
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
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium truncate ${isRestricted ? "text-red-300/70" : "text-white"}`}>{u.name || "No name"}</p>
                        {u.role === "ADMIN" && <Badge variant="indigo">Admin</Badge>}
                        {isRestricted && <Badge variant="red">Restricted</Badge>}
                        {!isRestricted && u.tier === "PRO" && u.role !== "ADMIN" && <Badge variant="gold">Pro</Badge>}
                        {!isRestricted && u.tier === "FREE" && u.role !== "ADMIN" && (
                          <span className="text-[9px] text-white/20 font-medium px-1.5 py-0.5 bg-white/[0.03] rounded">FREE</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-white/25 flex items-center gap-1">
                          <Mail size={9} /> {u.email}
                        </span>
                        <span className="text-[10px] text-white/15 flex items-center gap-1">
                          <Calendar size={9} /> {new Date(u.createdAt).toLocaleDateString()}
                        </span>
                        {u.lastLoginAt && (
                          <span className="text-[10px] text-emerald-400/30 flex items-center gap-1">
                            <LogIn size={9} /> {timeAgo(u.lastLoginAt)}
                          </span>
                        )}
                        <span className="text-[10px] text-white/15">
                          {u._count.autoTrades} trades · {u._count.searchHistory} searches · {u._count.activityLogs} events
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold text-white/20 hover:text-white/50 hover:bg-white/[0.03] transition-all"
                      title="View activity"
                    >
                      <MousePointer size={11} />
                      {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                    {u.role !== "ADMIN" && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <UserDetailPanel userId={u.id} onClose={() => setExpandedUser(null)} />
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
