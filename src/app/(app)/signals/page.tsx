"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { BarChart3, TrendingUp, TrendingDown, Globe, Users, Target } from "lucide-react";

export default function SignalsPage() {
  const [ticker, setTicker] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [macroLoading, setMacroLoading] = useState(true);
  const [macro, setMacro] = useState<any>(null);

  useEffect(() => {
    fetch("/api/signals")
      .then((r) => r.json())
      .then((d) => setMacro(d.macro))
      .catch(() => {})
      .finally(() => setMacroLoading(false));
  }, []);

  const loadSignals = async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/signals?ticker=${ticker.trim().toUpperCase()}`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  const regimeColors: Record<string, "green" | "yellow" | "red" | "blue"> = {
    EXPANSION: "green",
    PEAK: "yellow",
    CONTRACTION: "red",
    TROUGH: "blue",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Signals Dashboard</h1>

      {/* Macro regime */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Globe size={18} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-gray-400">Macro Regime</h2>
        </div>
        {macroLoading ? (
          <div className="skeleton h-20 w-full" />
        ) : macro ? (
          <div className="space-y-3">
            <Badge variant={regimeColors[macro.regime] || "gray"} className="text-base px-4 py-1">
              {macro.regime}
            </Badge>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
              {[
                { label: "GDP Growth", value: macro.gdpGrowth != null ? `${macro.gdpGrowth.toFixed(1)}%` : "N/A" },
                { label: "Unemployment", value: macro.unemployment != null ? `${macro.unemployment.toFixed(1)}%` : "N/A" },
                { label: "Fed Funds", value: macro.fedFunds != null ? `${macro.fedFunds.toFixed(2)}%` : "N/A" },
                { label: "Yield Curve", value: macro.yieldCurve != null ? `${macro.yieldCurve.toFixed(2)}%` : "N/A" },
                { label: "CPI YoY", value: macro.cpiYoY != null ? `${macro.cpiYoY.toFixed(1)}%` : "N/A" },
              ].map(({ label, value }) => (
                <div key={label} className="text-center p-2 bg-gray-900/50 rounded-xl">
                  <div className="text-[10px] text-gray-500 uppercase">{label}</div>
                  <div className="text-sm font-bold text-white mt-0.5">{value}</div>
                </div>
              ))}
            </div>
            {macro.signals?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {macro.signals.map((s: string, i: number) => (
                  <Badge key={i} variant="gray">{s}</Badge>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">Macro data unavailable</p>
        )}
      </Card>

      {/* Stock-specific signals */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Stock Signals</h2>
        <div className="flex gap-3 mb-4">
          <Input
            placeholder="Enter ticker... AAPL"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && loadSignals()}
          />
          <Button onClick={loadSignals} loading={loading}>Analyze</Button>
        </div>

        {data && (
          <div className="space-y-4">
            {/* Analyst Recommendations */}
            {data.analyst?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target size={16} className="text-amber-400" />
                  <h3 className="text-sm font-semibold text-gray-400">Analyst Recommendations</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-800">
                        <th className="text-left py-2">Period</th>
                        <th className="text-right py-2">Buy</th>
                        <th className="text-right py-2">Hold</th>
                        <th className="text-right py-2">Sell</th>
                        <th className="text-right py-2">Strong Buy</th>
                        <th className="text-right py-2">Strong Sell</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.analyst.slice(0, 4).map((r: any, i: number) => (
                        <tr key={r.period} className={i % 2 === 0 ? "bg-gray-900/50" : ""}>
                          <td className="py-2 text-white font-medium">{r.period}</td>
                          <td className="py-2 text-right text-emerald-400">{r.buy}</td>
                          <td className="py-2 text-right text-gray-400">{r.hold}</td>
                          <td className="py-2 text-right text-red-400">{r.sell}</td>
                          <td className="py-2 text-right text-emerald-300">{r.strongBuy}</td>
                          <td className="py-2 text-right text-red-300">{r.strongSell}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Price Target */}
            {data.priceTarget && (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-gray-900/50 rounded-xl">
                  <div className="text-[10px] text-gray-500 uppercase">Low Target</div>
                  <div className="text-lg font-bold text-red-400">{formatCurrency(data.priceTarget.targetLow || 0)}</div>
                </div>
                <div className="text-center p-3 bg-gray-900/50 rounded-xl">
                  <div className="text-[10px] text-gray-500 uppercase">Mean Target</div>
                  <div className="text-lg font-bold text-white">{formatCurrency(data.priceTarget.targetMean || 0)}</div>
                </div>
                <div className="text-center p-3 bg-gray-900/50 rounded-xl">
                  <div className="text-[10px] text-gray-500 uppercase">High Target</div>
                  <div className="text-lg font-bold text-emerald-400">{formatCurrency(data.priceTarget.targetHigh || 0)}</div>
                </div>
              </div>
            )}

            {/* Insider Transactions */}
            {data.insider?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users size={16} className="text-blue-400" />
                  <h3 className="text-sm font-semibold text-gray-400">Insider Transactions</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-800">
                        <th className="text-left py-2">Date</th>
                        <th className="text-left py-2">Name</th>
                        <th className="text-left py-2">Type</th>
                        <th className="text-right py-2">Shares</th>
                        <th className="text-right py-2">Price</th>
                        <th className="text-right py-2">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.insider.map((t: any, i: number) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-gray-900/50" : ""}>
                          <td className="py-2 text-gray-400 text-xs">{t.transactionDate || t.filingDate}</td>
                          <td className="py-2 text-white text-xs truncate max-w-[120px]">{t.reportingName}</td>
                          <td className="py-2">
                            <Badge variant={t.acquistionOrDisposition === "A" || t.transactionType?.includes("Purchase") ? "green" : "red"}>
                              {t.acquistionOrDisposition === "A" ? "Buy" : "Sell"}
                            </Badge>
                          </td>
                          <td className="py-2 text-right text-gray-300">{Math.abs(t.securitiesTransacted || 0).toLocaleString()}</td>
                          <td className="py-2 text-right text-gray-400">{t.price ? formatCurrency(t.price) : "—"}</td>
                          <td className="py-2 text-right text-white font-medium">
                            {t.securitiesTransacted && t.price ? formatCurrency(Math.abs(t.securitiesTransacted * t.price), true) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
