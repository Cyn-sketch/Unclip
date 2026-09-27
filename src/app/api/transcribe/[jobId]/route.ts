import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs/store";
import { proxyToWorker } from "@/lib/worker-proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const proxied = await proxyToWorker(req, `/api/transcribe/${jobId}`);
  if (proxied) return proxied;

  try {
    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required." }, { status: 400 });
    }

    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Transcription job not found." }, { status: 404 });
    }

    return NextResponse.json(job, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
