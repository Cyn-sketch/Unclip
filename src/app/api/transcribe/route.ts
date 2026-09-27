import { NextRequest, NextResponse } from "next/server";
import { validateInstagramUrl } from "@/lib/instagram/validator";
import { createJob } from "@/lib/jobs/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url, isDemo, demoId } = body;

    if (isDemo && demoId) {
      const job = createJob({ isDemo: true, demoId });
      return NextResponse.json({ jobId: job.id, status: job.status }, { status: 201 });
    }

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Please provide a valid Instagram Reel URL." },
        { status: 400 }
      );
    }

    const validation = validateInstagramUrl(url);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const job = createJob({ url: validation.canonicalUrl || url });
    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
