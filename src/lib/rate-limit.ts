import { prisma } from "@/lib/db";

const ADMIN_EMAIL = "shubhambalsaraf73@gmail.com";

const FREE_HOURLY_LIMIT = 120;
const PRO_HOURLY_LIMIT = 600;
const WINDOW_MS = 60 * 60 * 1000;
const BAN_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  banned: boolean;
  retryAfterMs?: number;
}

export async function checkRateLimit(
  userId: string,
  tier: string = "FREE",
  role: string = "USER"
): Promise<RateLimitResult> {
  if (role === "ADMIN") {
    return { allowed: true, remaining: Infinity, banned: false };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      bannedUntil: true,
      apiCallCount: true,
      apiCallWindow: true,
    },
  });

  if (!user) return { allowed: false, remaining: 0, banned: false };

  if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
    return {
      allowed: false,
      remaining: 0,
      banned: true,
      retryAfterMs: new Date(user.bannedUntil).getTime() - Date.now(),
    };
  }

  const limit = tier === "PRO" ? PRO_HOURLY_LIMIT : FREE_HOURLY_LIMIT;
  const now = new Date();
  const windowStart = user.apiCallWindow
    ? new Date(user.apiCallWindow)
    : new Date(0);
  const windowExpired = now.getTime() - windowStart.getTime() > WINDOW_MS;

  if (windowExpired) {
    await prisma.user.update({
      where: { id: userId },
      data: { apiCallCount: 1, apiCallWindow: now },
    });
    return { allowed: true, remaining: limit - 1, banned: false };
  }

  const newCount = user.apiCallCount + 1;

  if (newCount > limit * 3) {
    const banUntil = new Date(Date.now() + BAN_DURATION_MS);
    await prisma.user.update({
      where: { id: userId },
      data: { bannedUntil: banUntil, apiCallCount: newCount },
    });
    sendBanNotification(userId, user as any, newCount, limit).catch(
      () => {}
    );
    return {
      allowed: false,
      remaining: 0,
      banned: true,
      retryAfterMs: BAN_DURATION_MS,
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { apiCallCount: newCount },
  });

  if (newCount > limit) {
    return { allowed: false, remaining: 0, banned: false };
  }

  return { allowed: true, remaining: limit - newCount, banned: false };
}

async function sendBanNotification(
  userId: string,
  _user: any,
  callCount: number,
  limit: number
) {
  try {
    const fullUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, tier: true },
    });
    if (!fullUser) return;

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.porkbun.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Kosh.trade" <${process.env.SMTP_USER || "hello@kosh.trade"}>`,
      to: ADMIN_EMAIL,
      subject: `[ALERT] User banned for API abuse: ${fullUser.email}`,
      html: `
<div style="font-family:sans-serif;padding:20px;background:#111;color:#e5e7eb;border-radius:12px;">
  <h2 style="color:#ef4444;margin:0 0 16px;">User Banned for API Abuse</h2>
  <p><strong style="color:#fff;">Email:</strong> ${fullUser.email}</p>
  <p><strong style="color:#fff;">Name:</strong> ${fullUser.name || "—"}</p>
  <p><strong style="color:#fff;">Tier:</strong> ${fullUser.tier}</p>
  <p><strong style="color:#fff;">API Calls (1 hour):</strong> ${callCount} (limit: ${limit})</p>
  <p><strong style="color:#fff;">Exceeded by:</strong> ${callCount - limit} calls (${Math.round((callCount / limit) * 100)}% of limit)</p>
  <p><strong style="color:#fff;">Banned until:</strong> ${new Date(Date.now() + BAN_DURATION_MS).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
  <p><strong style="color:#fff;">Time:</strong> ${new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })} IST</p>
  <hr style="border-color:#1f2937;margin:16px 0;">
  <p style="color:#6b7280;font-size:12px;">To unban: <code>UPDATE "User" SET "bannedUntil" = NULL WHERE email = '${fullUser.email}';</code></p>
</div>`,
    });
  } catch (e) {
    console.error("[RateLimit] Failed to send ban notification:", e);
  }
}
