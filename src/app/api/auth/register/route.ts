import { NextRequest, NextResponse } from "next/server";
import argon2 from "argon2";
import { prisma } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      include: { accounts: { select: { provider: true }, take: 1 } },
    });
    if (existing) {
      const googleLinked = existing.accounts?.some(
        (a: { provider: string }) => a.provider === "google"
      );
      if (googleLinked) {
        return NextResponse.json(
          {
            error: "This email is already registered with Google. Please sign in with Google instead.",
            code: "GOOGLE_ACCOUNT",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error: "An account with this email already exists. Please sign in instead.",
          code: "EXISTING_ACCOUNT",
        },
        { status: 409 }
      );
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const userName = name || email.split("@")[0];
    const user = await prisma.user.create({
      data: { email, passwordHash, name: userName },
      select: { id: true, email: true, name: true },
    });

    sendWelcomeEmail(email, userName).catch(() => {});

    return NextResponse.json(user, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
