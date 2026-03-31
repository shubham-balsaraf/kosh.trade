import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const RATE_LIMIT_PATHS = [
  "/api/stocks/",
  "/api/signals",
  "/api/trading",
  "/api/dip-finder",
  "/api/portfolio",
  "/api/congress",
  "/api/market/",
];

const counters = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const ANON_LIMIT = 60;
const FREE_LIMIT = 120;
const PRO_LIMIT = 600;

function memoryRateLimit(
  key: string,
  limit: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = counters.get(key);

  if (!entry || now > entry.resetAt) {
    counters.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1 };
  }

  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: limit - entry.count };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of counters) {
    if (now > entry.resetAt) counters.delete(key);
  }
}, 5 * 60 * 1000);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isRateLimited = RATE_LIMIT_PATHS.some((p) => pathname.startsWith(p));
  if (!isRateLimited) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const userId = token?.id as string | undefined;
  const tier = (token?.tier as string) || "FREE";
  const role = (token?.role as string) || "USER";

  if (role === "ADMIN") return NextResponse.next();

  const key = userId || request.headers.get("x-forwarded-for") || "anon";
  const limit = !userId ? ANON_LIMIT : tier === "PRO" ? PRO_LIMIT : FREE_LIMIT;

  const { allowed, remaining } = memoryRateLimit(key, limit);

  if (!allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please slow down.",
        retryAfterSeconds: Math.ceil(WINDOW_MS / 1000),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(WINDOW_MS / 1000)),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
