import http from "http";
import { parse } from "url";
import { createJob, getJob } from "../src/lib/jobs/store";
import { validateInstagramUrl } from "../src/lib/instagram/validator";
import { generateSummary, generateHighlights, generateTranslation } from "../src/lib/ai/content-intelligence";

const PORT = Number(process.env.PORT || process.env.WORKER_PORT || 8080);
const WORKER_SECRET = process.env.WORKER_SECRET;

function sendJson(res: http.ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(JSON.stringify(data));
}

async function getRequestBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    res.end();
    return;
  }

  // Verify Bearer Auth Secret if WORKER_SECRET is configured
  if (WORKER_SECRET) {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${WORKER_SECRET}`) {
      return sendJson(res, 401, { error: "Unauthorized worker access." });
    }
  }

  const parsedUrl = parse(req.url || "", true);
  const pathname = parsedUrl.pathname || "/";

  try {
    // 1. Health check endpoint
    if (pathname === "/health" || pathname === "/api/health") {
      return sendJson(res, 200, {
        status: "ok",
        sttProvider: process.env.STT_PROVIDER || "local",
        time: new Date().toISOString(),
      });
    }

    // 2. Create Job: POST /api/transcribe
    if (pathname === "/api/transcribe" && req.method === "POST") {
      const body = await getRequestBody(req);
      const { url, isDemo, demoId } = body;

      if (isDemo && demoId) {
        const job = createJob({ isDemo: true, demoId });
        return sendJson(res, 201, { jobId: job.id, status: job.status });
      }

      if (!url || typeof url !== "string") {
        return sendJson(res, 400, { error: "Please provide a valid Instagram Reel URL." });
      }

      const validation = validateInstagramUrl(url);
      if (!validation.isValid) {
        return sendJson(res, 400, { error: validation.error });
      }

      const job = createJob({ url: validation.canonicalUrl || url });
      return sendJson(res, 201, { jobId: job.id, status: job.status });
    }

    // 3. Get Job Status: GET /api/transcribe/:jobId
    if (pathname.startsWith("/api/transcribe/") && req.method === "GET") {
      const jobId = pathname.replace("/api/transcribe/", "").trim();
      if (!jobId) {
        return sendJson(res, 400, { error: "Job ID is required." });
      }

      const job = getJob(jobId);
      if (!job) {
        return sendJson(res, 404, { error: "Transcription job not found." });
      }

      return sendJson(res, 200, job);
    }

    // 4. Content Intelligence Summary: POST /api/ai/summary
    if (pathname === "/api/ai/summary" && req.method === "POST") {
      const body = await getRequestBody(req);
      if (!body.transcript || !body.transcript.fullText) {
        return sendJson(res, 400, { error: "Transcript data is required." });
      }
      const summary = await generateSummary(body.transcript);
      return sendJson(res, 200, { summary });
    }

    // 5. Content Intelligence Highlights: POST /api/ai/highlights
    if (pathname === "/api/ai/highlights" && req.method === "POST") {
      const body = await getRequestBody(req);
      if (!body.transcript || !body.transcript.fullText) {
        return sendJson(res, 400, { error: "Transcript data is required." });
      }
      const highlights = await generateHighlights(body.transcript);
      return sendJson(res, 200, { highlights });
    }

    // 6. Content Intelligence Translate: POST /api/ai/translate
    if (pathname === "/api/ai/translate" && req.method === "POST") {
      const body = await getRequestBody(req);
      const { transcript, targetLanguage } = body;
      if (!transcript || !transcript.fullText) {
        return sendJson(res, 400, { error: "Transcript data is required." });
      }
      const translation = await generateTranslation(transcript, targetLanguage || "Hindi");
      return sendJson(res, 200, { translation });
    }

    return sendJson(res, 404, { error: "Endpoint not found on Unclip worker." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Worker Error";
    console.error(`[Worker Error] ${req.method} ${pathname}:`, err);
    return sendJson(res, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`[Unclip Worker] Dedicated backend server listening on port ${PORT}`);
  console.log(`[Unclip Worker] STT Provider: ${process.env.STT_PROVIDER || "local"}`);
  console.log(`[Unclip Worker] Auth secret enforced: ${Boolean(WORKER_SECRET)}`);
});
