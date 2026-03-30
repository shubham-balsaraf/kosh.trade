export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  volume: number;
  high52W: number;
  low52W: number;
  exchange: string;
  sector: string;
  industry: string;
}

export interface FinancialStatement {
  date: string;
  period: string;
  revenue: number;
  netIncome: number;
  grossProfit: number;
  operatingIncome: number;
  eps: number;
  epsDiluted: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  freeCashFlow: number;
  stockBasedCompensation: number;
  totalDebt: number;
  totalEquity: number;
  totalAssets: number;
  currentAssets: number;
  currentLiabilities: number;
  dividendsPaid: number;
  sharesBuyback: number;
}

export interface FCFData {
  date: string;
  period: 'Q' | 'FY';
  freeCashFlow: number;
  fcfPerShare: number;
  sharesOutstanding: number;
  stockBasedCompensation: number;
}

export interface EarningsEvent {
  date: string;
  ticker: string;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  hour: 'bmo' | 'amc' | null;
}

export interface InsiderTransaction {
  date: string;
  ticker: string;
  ownerName: string;
  transactionType: string;
  shares: number;
  pricePerShare: number;
  totalValue: number;
}

export interface SignalData {
  type: string;
  ticker: string;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number;
  description: string;
  source: string;
  date: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  holdings: PortfolioHoldingView[];
}

export interface PortfolioHoldingView {
  ticker: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  value: number;
  gainLoss: number;
  gainLossPercent: number;
  weight: number;
  sector: string;
}

export interface AnalysisResult {
  ticker: string;
  companyName: string;
  exchange: string;
  sector: string;
  subSector: string;
  price: number;
  marketCap: number;
  high52W: number;
  low52W: number;
  sharesOutstanding: number;
  verdict: 'CONSIDER' | 'MODERATE' | 'AVOID';
  verdictReason: string;
  quality: 'STRONG' | 'MODERATE' | 'WEAK';
  valuation: 'UNDERVALUED' | 'FAIRLY_VALUED' | 'OVERVALUED' | 'MIXED';
  growth: 'ACCELERATING' | 'STEADY' | 'SLOWING' | 'DECLINING';
  strengths: string[];
  watchPoints: string[];
  opportunities: string[];
  risks: string[];
  trackItem: string;
  timelineMatch: string;
  dataConfidence: 'HIGH' | 'MODERATE' | 'LOW';
  metrics: Record<string, any>;
  createdAt: string;
}

export type UserTier = 'FREE' | 'PRO';
export type UserRole = 'USER' | 'ADMIN';
