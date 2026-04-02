import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { action, detail } = await req.json();
  if (!action || typeof action !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const allowed = [
    "page_view", "feature_use", "search", "generate_picks",
    "run_koshpilot", "settings_change",
  ];
  if (!allowed.includes(action)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await logActivity((session.user as any).id, action, detail);
  return NextResponse.json({ ok: true });
}
