import { prisma } from "@/lib/db";
import { headers } from "next/headers";

export async function logActivity(
  userId: string,
  action: string,
  detail?: string
) {
  try {
    const hdrs = await headers();
    const ip =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      hdrs.get("x-real-ip") ||
      null;
    const userAgent = hdrs.get("user-agent") || null;

    await prisma.activityLog.create({
      data: { userId, action, detail, ip, userAgent },
    });
  } catch {
    // non-critical — don't break the request
  }
}
