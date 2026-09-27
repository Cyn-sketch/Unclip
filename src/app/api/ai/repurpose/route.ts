import { NextRequest, NextResponse } from "next/server";
import { generateRepurposedContent } from "@/lib/ai/content-intelligence";
import { Transcript } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const transcript: Transcript = body.transcript;

    if (!transcript || !transcript.fullText) {
      return NextResponse.json({ error: "Transcript data is required." }, { status: 400 });
    }

    const socialPosts = await generateRepurposedContent(transcript);
    return NextResponse.json({ socialPosts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate social content.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
