"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Bell, Plus, Trash2 } from "lucide-react";

interface Alert {
  id: string;
  ticker: string | null;
  signalType: string;
  condition: string;
  threshold: number | null;
  isActive: boolean;
  lastTriggered: string | null;
  createdAt: string;
}

const SIGNAL_TYPES = [
  "Price Drop",
  "Insider Buy",
  "Insider Sell",
  "Analyst Upgrade",
  "Analyst Downgrade",
  "Congressional Buy",
  "Options Flow",
  "Dark Pool Activity",
  "Short Interest Change",
  "Earnings Date",
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ticker: "", signalType: SIGNAL_TYPES[0], condition: "", threshold: "" });

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts");
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch {
      setAlerts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const createAlert = async () => {
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: form.ticker || null,
        signalType: form.signalType,
        condition: form.condition,
        threshold: form.threshold ? parseFloat(form.threshold) : null,
      }),
    });
    setShowCreate(false);
    setForm({ ticker: "", signalType: SIGNAL_TYPES[0], condition: "", threshold: "" });
    fetchAlerts();
  };

  const deleteAlert = async (alertId: string) => {
    await fetch("/api/alerts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId }),
    });
    fetchAlerts();
  };

  if (loading) return <div className="skeleton h-64 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <Button onClick={() => setShowCreate(true)} size="sm"><Plus size={16} /> New Alert</Button>
      </div>

      {alerts.length === 0 ? (
        <Card className="text-center py-16">
          <Bell size={48} className="mx-auto text-gray-700 mb-4" />
          <p className="text-gray-400 text-lg font-semibold">No alerts yet</p>
          <p className="text-gray-600 text-sm mt-2">Create alerts to get notified when signals align for your watchlist.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Card key={alert.id} className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {alert.ticker && <span className="text-white font-bold">{alert.ticker}</span>}
                  <Badge variant="indigo">{alert.signalType}</Badge>
                  <Badge variant={alert.isActive ? "green" : "gray"}>
                    {alert.isActive ? "Active" : "Paused"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-400">{alert.condition}</p>
                {alert.threshold != null && (
                  <p className="text-xs text-gray-500">Threshold: {alert.threshold}</p>
                )}
              </div>
              <button onClick={() => deleteAlert(alert.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Alert">
        <div className="space-y-4">
          <Input placeholder="Ticker (optional, e.g. AAPL)" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} />
          <select
            value={form.signalType}
            onChange={(e) => setForm({ ...form, signalType: e.target.value })}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SIGNAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Input placeholder="Condition (e.g. drops > 15%)" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} />
          <Input type="number" placeholder="Threshold (optional)" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
          <Button onClick={createAlert} className="w-full">Create Alert</Button>
        </div>
      </Modal>
    </div>
  );
}
