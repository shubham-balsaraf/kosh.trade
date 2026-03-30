"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Briefcase, Plus, Trash2, PieChart, TrendingUp, TrendingDown } from "lucide-react";

interface Holding {
  id: string;
  ticker: string;
  shares: number;
  avgCostBasis: number;
  currentPrice?: number;
}

interface Portfolio {
  id: string;
  name: string;
  cash: number;
  holdings: Holding[];
}

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddHolding, setShowAddHolding] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [holdingForm, setHoldingForm] = useState({ ticker: "", shares: "", cost: "" });
  const [prices, setPrices] = useState<Record<string, number>>({});

  const fetchPortfolios = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio");
      const data = await res.json();
      setPortfolios(data.portfolios || []);

      const tickers = new Set<string>();
      (data.portfolios || []).forEach((p: Portfolio) =>
        p.holdings.forEach((h) => tickers.add(h.ticker))
      );

      for (const t of tickers) {
        fetch(`/api/stocks/${t}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.quote?.price) {
              setPrices((prev) => ({ ...prev, [t]: d.quote.price }));
            }
          })
          .catch(() => {});
      }
    } catch {
      setPortfolios([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPortfolios();
  }, [fetchPortfolios]);

  const createPortfolio = async () => {
    await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName || "My Portfolio" }),
    });
    setShowCreate(false);
    setNewName("");
    fetchPortfolios();
  };

  const deletePortfolio = async (id: string) => {
    await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
    fetchPortfolios();
  };

  const addHolding = async () => {
    if (!showAddHolding) return;
    await fetch(`/api/portfolio/${showAddHolding}/holdings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: holdingForm.ticker,
        shares: parseFloat(holdingForm.shares),
        avgCostBasis: parseFloat(holdingForm.cost),
      }),
    });
    setShowAddHolding(null);
    setHoldingForm({ ticker: "", shares: "", cost: "" });
    fetchPortfolios();
  };

  const removeHolding = async (portfolioId: string, holdingId: string) => {
    await fetch(`/api/portfolio/${portfolioId}/holdings`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdingId }),
    });
    fetchPortfolios();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-48" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Portfolio</h1>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus size={16} /> New Portfolio
        </Button>
      </div>

      {portfolios.length === 0 ? (
        <Card className="text-center py-16">
          <Briefcase size={48} className="mx-auto text-gray-700 mb-4" />
          <p className="text-gray-400 text-lg font-semibold">No portfolios yet</p>
          <p className="text-gray-600 text-sm mt-2">Create a portfolio to start tracking your holdings</p>
          <Button onClick={() => setShowCreate(true)} className="mt-4" size="sm">
            Create Portfolio
          </Button>
        </Card>
      ) : (
        portfolios.map((portfolio: any) => {
          let totalValue = portfolio.cash;
          let totalCost = portfolio.cash;
          const holdingViews = portfolio.holdings.map((h: any) => {
            const price = prices[h.ticker] || h.avgCostBasis;
            const value = h.shares * price;
            const cost = h.shares * h.avgCostBasis;
            totalValue += value;
            totalCost += cost;
            return { ...h, currentPrice: price, value, cost, gainLoss: value - cost, gainLossPercent: ((value - cost) / cost) * 100 };
          });
          const totalGainLoss = totalValue - totalCost;
          const totalGainLossPercent = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

          return (
            <Card key={portfolio.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">{portfolio.name}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-2xl font-black text-white">{formatCurrency(totalValue)}</span>
                    <span className={`text-sm font-semibold ${totalGainLoss >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {totalGainLoss >= 0 ? <TrendingUp size={14} className="inline mr-1" /> : <TrendingDown size={14} className="inline mr-1" />}
                      {formatCurrency(Math.abs(totalGainLoss))} ({formatPercent(totalGainLossPercent)})
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setShowAddHolding(portfolio.id)}>
                    <Plus size={14} /> Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deletePortfolio(portfolio.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              {portfolio.cash > 0 && (
                <div className="text-sm text-gray-500">
                  Cash: <span className="text-white font-medium">{formatCurrency(portfolio.cash)}</span>
                </div>
              )}

              {holdingViews.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-800">
                        <th className="text-left py-2 pr-4">Ticker</th>
                        <th className="text-right py-2 px-2">Shares</th>
                        <th className="text-right py-2 px-2">Avg Cost</th>
                        <th className="text-right py-2 px-2">Price</th>
                        <th className="text-right py-2 px-2">Value</th>
                        <th className="text-right py-2 px-2">P&L</th>
                        <th className="text-right py-2 px-2">Weight</th>
                        <th className="text-right py-2 pl-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdingViews.map((h: any) => (
                        <tr key={h.id} className="hover:bg-gray-900/50">
                          <td className="py-2 pr-4 font-bold text-white">{h.ticker}</td>
                          <td className="py-2 px-2 text-right text-gray-300">{h.shares}</td>
                          <td className="py-2 px-2 text-right text-gray-400">{formatCurrency(h.avgCostBasis)}</td>
                          <td className="py-2 px-2 text-right text-white">{formatCurrency(h.currentPrice || 0)}</td>
                          <td className="py-2 px-2 text-right text-white font-medium">{formatCurrency(h.value)}</td>
                          <td className={`py-2 px-2 text-right font-semibold ${h.gainLoss >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {formatPercent(h.gainLossPercent)}
                          </td>
                          <td className="py-2 px-2 text-right text-gray-400">
                            {totalValue > 0 ? `${((h.value / totalValue) * 100).toFixed(1)}%` : "—"}
                          </td>
                          <td className="py-2 pl-2 text-right">
                            <button onClick={() => removeHolding(portfolio.id, h.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {holdingViews.length === 0 && (
                <p className="text-center text-gray-600 text-sm py-4">No holdings yet. Add your first stock.</p>
              )}
            </Card>
          );
        })
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Portfolio">
        <div className="space-y-4">
          <Input placeholder="Portfolio name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button onClick={createPortfolio} className="w-full">Create</Button>
        </div>
      </Modal>

      <Modal open={!!showAddHolding} onClose={() => setShowAddHolding(null)} title="Add Holding">
        <div className="space-y-4">
          <Input placeholder="Ticker (e.g. AAPL)" value={holdingForm.ticker} onChange={(e) => setHoldingForm({ ...holdingForm, ticker: e.target.value.toUpperCase() })} />
          <Input type="number" placeholder="Number of shares" value={holdingForm.shares} onChange={(e) => setHoldingForm({ ...holdingForm, shares: e.target.value })} />
          <Input type="number" placeholder="Average cost per share" value={holdingForm.cost} onChange={(e) => setHoldingForm({ ...holdingForm, cost: e.target.value })} />
          <Button onClick={addHolding} className="w-full">Add Holding</Button>
        </div>
      </Modal>
    </div>
  );
}
