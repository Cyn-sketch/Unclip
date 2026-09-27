import { NextRequest, NextResponse } from "next/server";

export function isWorkerProxyConfigured(): boolean {
  return Boolean(process.env.WORKER_URL && process.env.WORKER_URL.trim().length > 0);
}

export async function proxyToWorker(req: NextRequest, targetPath: string): Promise<NextResponse | null> {
  const workerUrlSetting = process.env.WORKER_URL;
  if (!workerUrlSetting || workerUrlSetting.trim().length === 0) {
    return null;
  }

  const workerUrl = workerUrlSetting.replace(/\/$/, "");
  const destination = `${workerUrl}${targetPath}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.WORKER_SECRET) {
    headers["Authorization"] = `Bearer ${process.env.WORKER_SECRET}`;
  }

  try {
    let body: string | undefined = undefined;
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      body = await req.text();
    }

    const workerRes = await fetch(destination, {
      method: req.method,
      headers,
      body: body && body.trim().length > 0 ? body : undefined,
      cache: "no-store",
    });

    const resContentType = workerRes.headers.get("content-type") || "application/json";
    const resText = await workerRes.text();

    if (resContentType.includes("application/json")) {
      try {
        const json = resText ? JSON.parse(resText) : {};
        return NextResponse.json(json, { status: workerRes.status });
      } catch {
        // Fallthrough if not valid JSON
      }
    }

    return new NextResponse(resText, {
      status: workerRes.status,
      headers: { "Content-Type": resContentType },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Unclip Proxy Error] Failed to proxy ${req.method} to worker at ${destination}: ${msg}`);
    return NextResponse.json(
      { error: "Transcription worker service is currently unreachable. Please check backend worker status." },
      { status: 503 }
    );
  }
}
