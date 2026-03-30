"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Shield, Crown, User, Lock } from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isPro = user?.role === "ADMIN" || user?.tier === "PRO";
  const isAdmin = user?.role === "ADMIN";

  const [settings, setSettings] = useState<any>(null);
  const [alpacaKey, setAlpacaKey] = useState("");
  const [alpacaSecret, setAlpacaSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {});
  }, []);

  const saveTradingMode = async (mode: "PAPER" | "LIVE") => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradingMode: mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to update");
      } else {
        setSettings((s: any) => ({ ...s, tradingMode: mode }));
        setMessage("Trading mode updated");
      }
    } catch {
      setMessage("Failed to update");
    }
    setSaving(false);
  };

  const saveAlpacaKeys = async () => {
    setSaving(true);
    setMessage("");
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alpacaApiKey: alpacaKey, alpacaSecretKey: alpacaSecret }),
      });
      setMessage("API keys saved");
      setAlpacaKey("");
      setAlpacaSecret("");
    } catch {
      setMessage("Failed to save keys");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      {/* Profile */}
      <Card className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
            {user?.name?.[0]?.toUpperCase() || <User size={24} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{user?.name || "User"}</h2>
              {isAdmin && <Badge variant="indigo"><Shield size={10} className="mr-1" />Admin</Badge>}
              {isPro && !isAdmin && <Badge variant="yellow"><Crown size={10} className="mr-1" />Pro</Badge>}
            </div>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>
      </Card>

      {/* Trading Mode */}
      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-400">Trading Mode</h3>
        <div className="flex gap-3">
          <button
            onClick={() => saveTradingMode("PAPER")}
            disabled={saving}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
              settings?.tradingMode === "PAPER"
                ? "bg-indigo-600 text-white ring-2 ring-indigo-500"
                : "bg-gray-900 text-gray-400 hover:bg-gray-800"
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
                : "bg-gray-900 text-gray-400 hover:bg-gray-800"
            } ${!isPro ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Live Trading
            {!isPro && <Lock size={12} className="inline ml-1.5" />}
          </button>
        </div>
        {!isPro && (
          <p className="text-xs text-amber-400">Live trading requires a Pro subscription.</p>
        )}
        {message && (
          <p className="text-xs text-indigo-400">{message}</p>
        )}
      </Card>

      {/* Alpaca API Keys */}
      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-400">Alpaca API Keys</h3>
        <p className="text-xs text-gray-500">
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
        <Button onClick={saveAlpacaKeys} loading={saving} size="sm">
          Save Keys
        </Button>
        {settings?.hasAlpacaKeys && (
          <Badge variant="green">Keys configured</Badge>
        )}
      </Card>

      {/* Account Info */}
      <Card className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-400">Account</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-800">
            <span className="text-gray-500">Tier</span>
            <span className="text-white font-medium">{isPro ? "Pro" : "Free"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-800">
            <span className="text-gray-500">Trading Mode</span>
            <span className="text-white font-medium">{settings?.tradingMode || "PAPER"}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Member Since</span>
            <span className="text-white font-medium">
              {settings?.createdAt ? new Date(settings.createdAt).toLocaleDateString() : "—"}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
