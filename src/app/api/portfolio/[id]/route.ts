import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

async function getPortfolio(id: string, userId: string) {
  return prisma.portfolio.findFirst({
    where: { id, userId },
    include: { holdings: true },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const portfolio = await getPortfolio(id, userId);
  if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(portfolio);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const existing = await getPortfolio(id, userId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, cash } = await req.json();
  const updated = await prisma.portfolio.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(cash !== undefined && { cash }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const existing = await getPortfolio(id, userId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.portfolio.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
