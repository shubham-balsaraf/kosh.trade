import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const alerts = await prisma.alert.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const { ticker, signalType, condition, threshold } = await req.json();

  if (!signalType || !condition) {
    return NextResponse.json({ error: "signalType and condition are required" }, { status: 400 });
  }

  const alert = await prisma.alert.create({
    data: {
      userId,
      ticker: ticker?.toUpperCase() || null,
      signalType,
      condition,
      threshold: threshold || null,
    },
  });

  return NextResponse.json(alert, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const { alertId } = await req.json();
  if (!alertId) return NextResponse.json({ error: "alertId required" }, { status: 400 });

  const alert = await prisma.alert.findFirst({ where: { id: alertId, userId } });
  if (!alert) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.alert.delete({ where: { id: alertId } });
  return NextResponse.json({ success: true });
}
