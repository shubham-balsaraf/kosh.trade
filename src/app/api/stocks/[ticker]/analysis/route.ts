import { NextRequest, NextResponse } from "next/server";
import { getQuote, getProfile, getIncomeStatement, getBalanceSheet, getCashFlow, getKeyMetrics, getRatios, getEarnings } from "@/lib/api/fmp";
import { generateCompletion } from "@/lib/ai/claude";

const SYSTEM_PROMPT = `You are a US Stock Fundamental Analyser for long-term investors.

CORE RULES:
1. No forward-looking statements. No "expected to", "should reach", or implied future performance.
2. Every metric must cite its source and date. If data cannot be found, write "DATA UNAVAILABLE".
3. Never fabricate financial data.
4. No buy/sell calls. No target prices. You produce a VIEW and a VERDICT.
5. All analysis is based on the provided financial data only.

You will receive pre-fetched financial data (quote, profile, income statements, balance sheets, cash flows, key metrics, ratios, and earnings history).

Analyze this data following the methodology below and return a JSON response.

SECTOR DETECTION: Identify the exact sector and sub-sector.

VALUATION: Apply sector-appropriate primary metrics:
- BANKING → P/TBV | INSURANCE → P/BV | IT/SAAS → P/E or EV/Revenue | SEMICONDUCTORS → P/E mid-cycle
- PHARMA → P/E adjusted | FMCG → P/E | RETAIL → EV/EBITDA | TELECOM → EV/EBITDA
- For other sectors, use the most appropriate primary metric.

Signal per metric: CHEAP (below sector avg & own 5yr avg), FAIR (within ±10%), EXPENSIVE (above both)
Overall: UNDERVALUED / FAIRLY VALUED / OVERVALUED / MIXED

GROWTH: Classify revenue, profit, EPS, margin trends as ACCELERATING / STEADY / SLOWING / DECLINING

HEALTH (non-banking):
- D/E: <0.5=SAFE, 0.5-1.5=MODERATE, >1.5=LEVERAGED
- Interest Coverage: >5x=HEALTHY, 2-5x=WATCH, <2x=RISK
- FCF: Positive & growing=STRONG, Positive flat=STABLE, Negative=CONCERN

RETURNS:
- ROE >15%=GOOD, 10-15%=AVERAGE, <10%=WEAK
- ROIC >12%=GOOD, 8-12%=AVERAGE, <8%=WEAK
Classify: HIGH-QUALITY COMPOUNDER / AVERAGE RETURNS / DIVIDEND PLAY / GROWTH REINVESTOR / TURNAROUND CANDIDATE

SCENARIOS for user's stated horizon:
- Bear: growth 40% below historical, margins compress
- Base: growth continues at historical CAGR, margins stable
- Bull: growth 20% above historical, margin expansion

VERDICT:
- CONSIDER (green): fundamentals strong, valuation reasonable
- MODERATE (yellow): mixed picture, some strengths offset by risks
- AVOID (red): weak fundamentals, high risk, or stretched valuation

Return ONLY valid JSON with this exact structure:
{
  "verdict": {
    "signal": "CONSIDER" | "MODERATE" | "AVOID",
    "reason": "One sentence explaining the verdict",
    "quality": "STRONG" | "MODERATE" | "WEAK"
  },
  "overview": {
    "sector": "string",
    "subSector": "string",
    "summary": "Two-sentence fundamental summary"
  },
  "valuation": {
    "primaryMetric": "e.g. P/E",
    "primaryValue": number or null,
    "signal": "CHEAP" | "FAIR" | "EXPENSIVE",
    "overall": "UNDERVALUED" | "FAIRLY VALUED" | "OVERVALUED" | "MIXED",
    "metrics": [
      { "name": "string", "value": "string", "signal": "CHEAP" | "FAIR" | "EXPENSIVE", "explanation": "one line" }
    ]
  },
  "growth": {
    "classification": "ACCELERATING" | "STEADY" | "SLOWING" | "DECLINING",
    "revenueCagr3y": number or null,
    "revenueCagr5y": number or null,
    "netIncomeCagr3y": number or null,
    "marginTrend": "string description"
  },
  "health": {
    "debtEquity": { "value": number, "signal": "SAFE" | "MODERATE" | "LEVERAGED" },
    "interestCoverage": { "value": number, "signal": "HEALTHY" | "WATCH" | "RISK" },
    "currentRatio": { "value": number, "signal": "string" },
    "fcf": { "signal": "STRONG" | "STABLE" | "CONCERN", "description": "string" }
  },
  "returns": {
    "classification": "string",
    "roe": { "current": number, "avg3y": number, "signal": "GOOD" | "AVERAGE" | "WEAK" },
    "roic": { "current": number, "signal": "GOOD" | "AVERAGE" | "WEAK" }
  },
  "scenarios": {
    "bear": "3 lines max",
    "base": "3 lines max",
    "bull": "3 lines max"
  },
  "strengths": ["string", "string", "string"],
  "watchPoints": ["string", "string"],
  "track": "One thing to track going forward",
  "opportunities": ["string", "string", "string"],
  "risks": ["string", "string", "string"],
  "timelineMatch": "One paragraph on whether this stock suits the stated investment horizon"
}`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI analysis requires ANTHROPIC_API_KEY" }, { status: 500 });
    }
    if (!process.env.FMP_API_KEY) {
      return NextResponse.json({ error: "FMP_API_KEY is not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const horizon = body.horizon || "5 years";

    const [quote, profile, income, balance, cashflow, metrics, ratios, earnings] = await Promise.all([
      getQuote(symbol).catch(() => null),
      getProfile(symbol).catch(() => null),
      getIncomeStatement(symbol, "annual", 10).catch(() => []),
      getBalanceSheet(symbol, "annual", 10).catch(() => []),
      getCashFlow(symbol, "annual", 10).catch(() => []),
      getKeyMetrics(symbol, "annual", 10).catch(() => []),
      getRatios(symbol, "annual", 10).catch(() => []),
      getEarnings(symbol).catch(() => []),
    ]);

    if (!quote && !profile) {
      return NextResponse.json({ error: "Stock not found" }, { status: 404 });
    }

    const financialData = {
      ticker: symbol,
      quote: quote || {},
      profile: profile || {},
      income: (income || []).slice(0, 5),
      balance: (balance || []).slice(0, 5),
      cashflow: (cashflow || []).slice(0, 5),
      metrics: (metrics || []).slice(0, 5),
      ratios: (ratios || []).slice(0, 5),
      recentEarnings: (earnings || []).slice(0, 8),
    };

    const userMessage = `Analyze ${symbol} for a ${horizon} investment horizon.

Here is the complete financial data:

${JSON.stringify(financialData, null, 2)}

Based on this data, provide your full fundamental analysis as JSON. Return ONLY the JSON object, no markdown fences, no explanation outside JSON.`;

    const result = await generateCompletion(SYSTEM_PROMPT, userMessage, 6000);

    let cleaned = result.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const analysis = JSON.parse(cleaned);

    return NextResponse.json({ analysis, ticker: symbol, horizon });
  } catch (e: any) {
    console.error(`[Analysis API] ${symbol}:`, e.message);
    return NextResponse.json({ error: e.message || "Analysis failed" }, { status: 500 });
  }
}
