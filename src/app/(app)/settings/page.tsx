"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  Shield,
  Crown,
  User,
  Lock,
  Bell,
  Eye,
  EyeOff,
  Key,
  Mail,
  Calendar,
  Activity,
  Trash2,
  LogOut,
  Check,
  AlertTriangle,
} from "lucide-react";

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const user = session?.user as any;
  const isPro = user?.role === "ADMIN" || user?.tier === "PRO";
  const isAdmin = user?.role === "ADMIN";

  const [settings, setSettings] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [alpacaKey, setAlpacaKey] = useState("");
  const [alpacaSecret, setAlpacaSecret] = useState("");

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [tradeNotifications, setTradeNotifications] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/usage").then((r) => r.json()),
    ])
      .then(([s, u]) => {
        setSettings(s);
        setUsage(u);
        setDisplayName(user?.name || "");
      })
      .catch(() => {});
  }, [user?.name]);

  const flash = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const updateName = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName.trim() }),
      });
      if (res.ok) {
        flash("Display name updated");
        updateSession();
      } else {
        flash("Failed to update name", "error");
      }
    } catch {
      flash("Failed to update name", "error");
    }
    setSaving(false);
  };

  const changePassword = async () => {
    if (newPassword.length < 8) {
      flash("Password must be at least 8 characters", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      flash("Passwords do not match", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        flash("Password updated successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        flash(data.error || "Failed to change password", "error");
      }
    } catch {
      flash("Failed to change password", "error");
    }
    setSaving(false);
  };

  const saveTradingMode = async (mode: "PAPER" | "LIVE") => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradingMode: mode }),
      });
      if (res.ok) {
        setSettings((s: any) => ({ ...s, tradingMode: mode }));
        flash("Trading mode updated");
      } else {
        const data = await res.json();
        flash(data.error || "Failed to update", "error");
      }
    } catch {
      flash("Failed to update", "error");
    }
    setSaving(false);
  };

  const saveAlpacaKeys = async () => {
    if (!alpacaKey || !alpacaSecret) {
      flash("Both API key and secret are required", "error");
      return;
    }
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alpacaApiKey: alpacaKey, alpacaSecretKey: alpacaSecret }),
      });
      flash("Alpaca API keys saved");
      setAlpacaKey("");
      setAlpacaSecret("");
      setSettings((s: any) => ({ ...s, hasAlpacaKeys: true }));
    } catch {
      flash("Failed to save keys", "error");
    }
    setSaving(false);
  };

  const isGoogleUser = settings?.provider === "google";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        {message && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              message.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {message.type === "success" ? <Check size={12} /> : <AlertTriangle size={12} />}
            {message.text}
          </div>
        )}
      </div>

      {/* Profile */}
      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
          <User size={14} /> Profile
        </h3>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0 ${isPro ? "bg-gradient-to-br from-amber-500 to-yellow-600" : "bg-gradient-to-br from-indigo-500 to-purple-600"}`}>
            {user?.name?.[0]?.toUpperCase() || <User size={24} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-white">{user?.name || "User"}</h2>
              {isAdmin && <Badge variant="indigo"><Shield size={10} className="mr-1" />Admin</Badge>}
              {isPro && !isAdmin && <Badge variant="yellow"><Crown size={10} className="mr-1" />Pro</Badge>}
            </div>
            <p className="text-sm text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>

        <div className="pt-2 space-y-3">
          <label className="block text-xs text-gray-500">Display Name</label>
          <div className="flex gap-2">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              autoComplete="name"
            />
            <Button
              onClick={updateName}
              loading={saving}
              size="sm"
              disabled={displayName === user?.name || !displayName.trim()}
              className="shrink-0"
            >
              Save
            </Button>
          </div>
        </div>
      </Card>

      {/* Security */}
      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
          <Lock size={14} /> Security
        </h3>

        {isGoogleUser ? (
          <div className="flex items-center gap-3 py-3 px-4 rounded-xl bg-blue-500/[0.06] border border-blue-500/15">
            <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <div>
              <p className="text-sm font-medium text-white">Connected with Google</p>
              <p className="text-xs text-gray-500">Password managed by your Google account</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Change your password</p>
            <div className="relative">
              <Input
                type={showCurrentPw ? "text" : "password"}
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative">
              <Input
                type={showNewPw ? "text" : "password"}
                placeholder="New password (min 8 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            <Button
              onClick={changePassword}
              loading={saving}
              size="sm"
              disabled={!currentPassword || !newPassword || !confirmPassword}
            >
              Update Password
            </Button>
          </div>
        )}
      </Card>

      {/* Trading Preferences */}
      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
          <Activity size={14} /> Trading
        </h3>
        <div className="space-y-3">
          <label className="block text-xs text-gray-500">Trading Mode</label>
          <div className="flex gap-3">
            <button
              onClick={() => saveTradingMode("PAPER")}
              disabled={saving}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                settings?.tradingMode === "PAPER"
                  ? "bg-indigo-600 text-white ring-2 ring-indigo-500"
                  : "bg-white/[0.03] text-gray-400 hover:bg-white/[0.06] border border-white/[0.06]"
              }`}
            >
              Paper Trading
            </button>
            <button
              onClick={() => saveTradingMode("LIVE")}
              disabled={saving || !isPro}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all relative ${
                settings?.tradingMode === "LIVE"
                  ? "bg-emerald-600 text-white ring-2 ring-emerald-500"
                  : "bg-white/[0.03] text-gray-400 hover:bg-white/[0.06] border border-white/[0.06]"
              } ${!isPro ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Live Trading
              {!isPro && <Lock size={12} className="inline ml-1.5" />}
            </button>
          </div>
          {!isPro && (
            <p className="text-xs text-amber-400/70">Live trading requires a Pro subscription.</p>
          )}
        </div>

        <div className="space-y-3 pt-2">
          <label className="block text-xs text-gray-500">Alpaca API Keys</label>
          <p className="text-[11px] text-gray-600">
            Connect your Alpaca brokerage account for paper or live trading.
          </p>
          <Input
            type="password"
            placeholder="API Key"
            value={alpacaKey}
            onChange={(e) => setAlpacaKey(e.target.value)}
            autoComplete="off"
          />
          <Input
            type="password"
            placeholder="Secret Key"
            value={alpacaSecret}
            onChange={(e) => setAlpacaSecret(e.target.value)}
            autoComplete="off"
          />
          <div className="flex items-center gap-3">
            <Button onClick={saveAlpacaKeys} loading={saving} size="sm">
              Save Keys
            </Button>
            {settings?.hasAlpacaKeys && (
              <Badge variant="green"><Key size={10} className="mr-1" />Keys configured</Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Usage & Account */}
      <Card className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
          <Mail size={14} /> Account
        </h3>
        <div className="space-y-0">
          {[
            { label: "Email", value: user?.email, icon: Mail },
            { label: "Tier", value: isPro ? "Pro" : "Free", icon: Crown },
            { label: "Trading Mode", value: settings?.tradingMode || "PAPER", icon: Activity },
            { label: "Member Since", value: settings?.createdAt ? new Date(settings.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—", icon: Calendar },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
              <span className="text-sm text-gray-500 flex items-center gap-2">
                <Icon size={13} className="text-gray-600" /> {label}
              </span>
              <span className="text-sm text-white font-medium">{value}</span>
            </div>
          ))}
        </div>
        {!isPro && usage && (
          <div className="pt-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Analyses this week</span>
              <span className="text-gray-400">{usage.used}/{usage.limit}</span>
            </div>
            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
              />
            </div>
            {usage.resetsAt && (
              <p className="text-[10px] text-gray-600">
                Resets {new Date(usage.resetsAt).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Sign Out & Danger */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-gray-400 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:text-white transition-all"
        >
          <LogOut size={16} /> Sign Out
        </button>
        <button
          onClick={() => {
            if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
              flash("Contact support@kosh.trade to delete your account", "error");
            }
          }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-red-400/60 bg-red-500/[0.03] border border-red-500/10 hover:bg-red-500/[0.06] hover:text-red-400 transition-all"
        >
          <Trash2 size={16} /> Delete Account
        </button>
      </div>
    </div>
  );
}
