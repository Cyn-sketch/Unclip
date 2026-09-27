import { NextRequest, NextResponse } from "next/server";
import { generateTranslations } from "@/lib/ai/content-intelligence";
import { Transcript } from "@/types";
import { proxyToWorker } from "@/lib/worker-proxy";

export async function POST(req: NextRequest) {
  const proxied = await proxyToWorker(req, "/api/ai/translate");
  if (proxied) return proxied;

  try {
    const body = await req.json();
    const transcript: Transcript = body.transcript;
    const languages: string[] = body.languages || ["es", "fr", "de"];

    if (!transcript || !transcript.fullText) {
      return NextResponse.json({ error: "Transcript data is required." }, { status: 400 });
    }

    const translations = await generateTranslations(transcript, languages);
    return NextResponse.json({ translations });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to translate transcript.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
