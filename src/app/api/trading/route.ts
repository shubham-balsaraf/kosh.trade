import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { submitOrder, getAccount, getPositions, getOrders } from "@/lib/api/alpaca";
import { requirePro } from "@/lib/auth/tierCheck";

function getAlpacaConfig(user: any) {
  return {
    apiKey: user.alpacaApiKey || process.env.ALPACA_API_KEY || "",
    secretKey: user.alpacaSecretKey || process.env.ALPACA_SECRET_KEY || "",
    paper: user.alpacaPaper !== false,
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const config = getAlpacaConfig(user);
  const action = req.nextUrl.searchParams.get("action");

  try {
    if (action === "account") {
      const account = await getAccount(config);
      return NextResponse.json({ account, mode: config.paper ? "PAPER" : "LIVE" });
    }
    if (action === "positions") {
      const positions = await getPositions(config);
      return NextResponse.json({ positions, mode: config.paper ? "PAPER" : "LIVE" });
    }
    if (action === "orders") {
      const orders = await getOrders(config);
      return NextResponse.json({ orders, mode: config.paper ? "PAPER" : "LIVE" });
    }

    const trades = await prisma.trade.findMany({
      where: { portfolio: { userId } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ trades });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!user.alpacaPaper) {
    const { authorized } = await requirePro();
    if (!authorized) {
      return NextResponse.json(
        { error: "Live trading requires a Pro subscription" },
        { status: 403 }
      );
    }
  }

  const config = getAlpacaConfig(user);
  const { ticker, qty, side, portfolioId, signalSource } = await req.json();

  if (!ticker || !qty || !side) {
    return NextResponse.json({ error: "ticker, qty, and side are required" }, { status: 400 });
  }

  try {
    const order = await submitOrder(config, {
      symbol: ticker.toUpperCase(),
      qty,
      side: side.toLowerCase(),
    });

    if (portfolioId) {
      await prisma.trade.create({
        data: {
          portfolioId,
          ticker: ticker.toUpperCase(),
          side: side.toUpperCase(),
          qty,
          price: order.filled_avg_price ? parseFloat(order.filled_avg_price) : null,
          alpacaOrderId: order.id,
          status: order.status === "filled" ? "FILLED" : "PENDING",
          mode: config.paper ? "PAPER" : "LIVE",
          signalSource: signalSource || null,
          executedAt: order.filled_at ? new Date(order.filled_at) : null,
        },
      });
    }

    return NextResponse.json({
      order,
      mode: config.paper ? "PAPER" : "LIVE",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
