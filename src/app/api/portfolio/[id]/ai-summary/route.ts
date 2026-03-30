import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { generateCompletion } from "@/lib/ai/claude";
import { PORTFOLIO_SUMMARY_SYSTEM } from "@/lib/ai/prompts";
import { getQuote } from "@/lib/api/fmp";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { id } = await params;

  const portfolio = await prisma.portfolio.findFirst({
    where: { id, userId },
    include: { holdings: true },
  });

  if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (portfolio.holdings.length === 0) {
    return NextResponse.json({ error: "Portfolio has no holdings to analyze" }, { status: 400 });
  }

  try {
    const holdingDetails = await Promise.all(
      portfolio.holdings.map(async (h: any) => {
        const quote = await getQuote(h.ticker).catch(() => null);
        return {
          ticker: h.ticker,
          shares: h.shares,
          avgCost: h.avgCostBasis,
          currentPrice: quote?.price || h.avgCostBasis,
          marketCap: quote?.marketCap || 0,
          pe: quote?.pe || 0,
          sector: quote?.sector || "Unknown",
          change: quote?.changesPercentage || 0,
        };
      })
    );

    let totalValue = portfolio.cash;
    const enriched = holdingDetails.map((h) => {
      const value = h.shares * h.currentPrice;
      totalValue += value;
      return { ...h, value };
    });

    const withWeights = enriched.map((h) => ({
      ...h,
      weight: totalValue > 0 ? ((h.value / totalValue) * 100).toFixed(1) + "%" : "0%",
      gainLoss: (((h.currentPrice - h.avgCost) / h.avgCost) * 100).toFixed(1) + "%",
    }));

    const userMessage = `Here is my portfolio (total value: $${totalValue.toFixed(2)}, cash: $${portfolio.cash.toFixed(2)}):

${withWeights.map((h) => `- ${h.ticker}: ${h.shares} shares, avg cost $${h.avgCost.toFixed(2)}, current $${h.currentPrice.toFixed(2)}, value $${h.value.toFixed(2)}, weight ${h.weight}, P&L ${h.gainLoss}, P/E ${h.pe.toFixed(1)}, sector: ${h.sector}`).join("\n")}

Please analyze this portfolio.`;

    const summary = await generateCompletion(PORTFOLIO_SUMMARY_SYSTEM, userMessage);
    return NextResponse.json({ summary });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "AI analysis failed" }, { status: 500 });
  }
}
