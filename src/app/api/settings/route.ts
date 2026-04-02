import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  let settings = await prisma.appSettings.findUnique({ where: { id: "global" } });
  if (!settings) {
    settings = await prisma.appSettings.create({ data: { id: "global" } });
  }
  return NextResponse.json({ proGateEnabled: settings.proGateEnabled });
}
