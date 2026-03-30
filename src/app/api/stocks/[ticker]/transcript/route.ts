import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getTranscript } from "@/lib/api/earningscalls";
import { generateCompletion } from "@/lib/ai/claude";
import { EARNINGS_TRANSCRIPT_SYSTEM } from "@/lib/ai/prompts";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticker } = await params;
  const year = req.nextUrl.searchParams.get("year");
  const quarter = req.nextUrl.searchParams.get("quarter");

  try {
    const transcript = await getTranscript(
      ticker,
      year ? parseInt(year) : undefined,
      quarter ? parseInt(quarter) : undefined
    );

    if (!transcript || (!transcript.text && !transcript.transcript)) {
      return NextResponse.json({ error: "Transcript not available" }, { status: 404 });
    }

    const text = transcript.text || transcript.transcript || "";
    const truncated = text.substring(0, 15000);

    const summary = await generateCompletion(
      EARNINGS_TRANSCRIPT_SYSTEM,
      `Here is the earnings call transcript for ${ticker.toUpperCase()}:\n\n${truncated}`
    );

    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      year: year || transcript.year,
      quarter: quarter || transcript.quarter,
      summary,
      hasFullTranscript: text.length > 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch transcript" }, { status: 500 });
  }
}
