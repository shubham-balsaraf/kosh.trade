interface StrategyInput {
  budget: number;
  signals: Array<{
    ticker: string;
    score: number;
    reasons: string[];
  }>;
  maxPositionPct: number;
}

interface TradeRecommendation {
  ticker: string;
  allocation: number;
  qty: number;
  estimatedPrice: number;
  score: number;
  reasons: string[];
}

export function generateAllocations(input: StrategyInput): TradeRecommendation[] {
  const { budget, signals, maxPositionPct } = input;
  const maxPerPosition = budget * (maxPositionPct / 100);

  const sorted = [...signals]
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (sorted.length === 0) return [];

  const totalScore = sorted.reduce((sum, s) => sum + s.score, 0);

  return sorted.map((s) => {
    const rawAllocation = (s.score / totalScore) * budget;
    const allocation = Math.min(rawAllocation, maxPerPosition);
    return {
      ticker: s.ticker,
      allocation: Math.round(allocation * 100) / 100,
      qty: 0,
      estimatedPrice: 0,
      score: s.score,
      reasons: s.reasons,
    };
  });
}
