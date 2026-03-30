import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { category, subject, message, userEmail, userName } = body;

    if (!subject || !message) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }

    const logsDir = join(process.cwd(), "data", "support");
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }

    const entry = {
      timestamp: new Date().toISOString(),
      userId: (session.user as any).id,
      userName: userName || session.user.name,
      userEmail: userEmail || session.user.email,
      category: category || "General Question",
      subject,
      message,
    };

    const logFile = join(logsDir, "messages.jsonl");
    appendFileSync(logFile, JSON.stringify(entry) + "\n", "utf-8");

    console.log("[SUPPORT]", entry.timestamp, "-", entry.userEmail, "-", entry.subject);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[SUPPORT] Error:", err);
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }
}
