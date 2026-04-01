import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json(
      { message: "If that email exists, a reset link has been sent." },
      { status: 200 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { accounts: { select: { provider: true }, take: 1 } },
  });

  if (!user) {
    return NextResponse.json(
      { message: "If that email exists, a reset link has been sent." },
      { status: 200 }
    );
  }

  const isGoogleOnly =
    user.accounts?.some((a: { provider: string }) => a.provider === "google") &&
    !user.passwordHash;

  if (isGoogleOnly) {
    return NextResponse.json(
      { message: "If that email exists, a reset link has been sent.", isGoogle: true },
      { status: 200 }
    );
  }

  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: token,
      passwordResetExpiry: expiry,
    },
  });

  await sendPasswordResetEmail(user.email, user.name || "", token);

  return NextResponse.json({
    message: "If that email exists, a reset link has been sent.",
  });
}
