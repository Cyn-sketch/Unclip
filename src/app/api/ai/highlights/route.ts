import { NextRequest, NextResponse } from "next/server";
import { generatePotentialHighlights } from "@/lib/ai/content-intelligence";
import { Transcript } from "@/types";
import { proxyToWorker } from "@/lib/worker-proxy";

export async function POST(req: NextRequest) {
  const proxied = await proxyToWorker(req, "/api/ai/highlights");
  if (proxied) return proxied;

  try {
    const body = await req.json();
    const transcript: Transcript = body.transcript;

    if (!transcript || !transcript.fullText) {
      return NextResponse.json({ error: "Transcript data is required." }, { status: 400 });
    }

    const highlights = await generatePotentialHighlights(transcript);
    return NextResponse.json({ highlights });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to identify potential highlights.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
