import fs from "fs/promises";
import { TranscriptionJob, JobStatus, Transcript, InstagramErrorCode } from "@/types";
import { generateId } from "../utils";
import { getSampleReelById } from "../demo/sample-data";
import { defaultMediaRetriever } from "../instagram/media";
import { fetchInstagramMetadata } from "../instagram/metadata";
import { extractAudioServerSide } from "../audio/extractor";
import { getSTTProvider } from "../stt/factory";
import { validateInstagramUrl } from "../instagram/validator";
import { defaultInstagramAuthProvider } from "../instagram/auth";

const globalJobsMap = new Map<string, TranscriptionJob>();

export function createJob(params: { url?: string; isDemo?: boolean; demoId?: string }): TranscriptionJob {
  const jobId = generateId();
  const now = new Date().toISOString();

  const newJob: TranscriptionJob = {
    id: jobId,
    url: params.url,
    isDemo: params.isDemo || false,
    demoId: params.demoId,
    status: "queued",
    progress: 5,
    message: "Job created and queued for processing...",
    createdAt: now,
    updatedAt: now,
  };

  globalJobsMap.set(jobId, newJob);
  console.log(`[Unclip] Job created: ${jobId} (isDemo: ${newJob.isDemo})`);

  // Trigger background job processing
  processTranscriptionJob(jobId).catch((err) => {
    console.error(`[Unclip] Job ${jobId} unhandled failure:`, err);
  });

  return newJob;
}

export function getJob(jobId: string): TranscriptionJob | undefined {
  return globalJobsMap.get(jobId);
}

export function updateJob(jobId: string, patch: Partial<TranscriptionJob>): TranscriptionJob {
  const existing = globalJobsMap.get(jobId);
  if (!existing) {
    throw new Error(`Job ${jobId} not found.`);
  }

  const updated: TranscriptionJob = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  globalJobsMap.set(jobId, updated);
  return updated;
}

export async function processTranscriptionJob(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;

  let tempVideoPath: string | null = null;
  let tempAudioPath: string | null = null;

  try {
    // 1. DEMO MODE PATH
    if (job.isDemo && job.demoId) {
      console.log(`[Unclip] Demo mode executing for sample ID: ${job.demoId}`);
      const sample = getSampleReelById(job.demoId);
      if (!sample) {
        updateJob(jobId, {
          status: "failed",
          error: "Sample authorized demo reel not found.",
          message: "Failed to load sample reel.",
          errorCode: "REEL_UNAVAILABLE",
        });
        return;
      }

      await delay(300);
      updateJob(jobId, { status: "retrieving", progress: 25, message: "Loading sample reel..." });
      await delay(300);
      updateJob(jobId, { status: "extracting", progress: 50, message: "Extracting sample audio..." });
      await delay(300);
      updateJob(jobId, { status: "transcribing", progress: 75, message: "Transcribing sample audio..." });
      await delay(200);
      updateJob(jobId, { status: "processing", progress: 90, message: "Formatting transcript..." });
      await delay(200);

      updateJob(jobId, {
        status: "completed",
        progress: 100,
        message: "Transcription ready!",
        transcript: sample.transcript,
      });
      console.log(`[Unclip] Demo job ${jobId} completed successfully.`);
      return;
    }

    // 2. REAL INSTAGRAM PIPELINE
    if (!job.url) {
      const err = new Error("No Instagram Reel URL supplied for transcription.") as Error & { code: InstagramErrorCode };
      err.code = "INVALID_INSTAGRAM_URL";
      throw err;
    }

    // Diagnostic log 1: Start
    console.log(`[Unclip] Instagram retrieval started for job: ${jobId}`);

    // Stage 1: URL Validation
    const validation = validateInstagramUrl(job.url);
    if (!validation.isValid || !validation.canonicalUrl) {
      const err = new Error(validation.error || "Invalid Instagram Reel URL.") as Error & { code: InstagramErrorCode };
      err.code = "INVALID_INSTAGRAM_URL";
      throw err;
    }
    console.log(`[Unclip] URL validated: ${validation.canonicalUrl}`);

    // Diagnostic log 2: Auth status
    const authContext = await defaultInstagramAuthProvider.getAuthenticatedContext();
    console.log(`[Unclip] Authentication configured: ${authContext.isAuthEnabled}`);
    console.log(`[Unclip] Authentication status: ${authContext.status}`);

    // Stage 2: Metadata Retrieval
    let title = "Instagram Video";
    let author = "@instagram_creator";
    try {
      const meta = await fetchInstagramMetadata(validation.canonicalUrl);
      if (meta.title) title = meta.title;
      if (meta.author) author = meta.author;
      console.log(`[Unclip] Metadata retrieved: title="${title}", author="${author}"`);
    } catch {
      console.log(`[Unclip] Metadata retrieval fallback to defaults.`);
    }

    // Stage 3: Media Retrieval
    console.log(`[Unclip] Attempting media retrieval...`);
    updateJob(jobId, {
      status: "retrieving",
      progress: 20,
      message: "Retrieving Instagram video bytes...",
    });

    console.log(`[Unclip] Media download started`);
    const media = await defaultMediaRetriever.retrieve(validation.canonicalUrl, defaultInstagramAuthProvider);
    tempVideoPath = media.localPath;

    console.log(`[Unclip] Media URL resolved: true`);
    console.log(`[Unclip] Media download completed. Content-Type: ${media.contentType}, Size: ${media.size} bytes`);

    // Stage 4: Video Validation
    const videoStat = await fs.stat(tempVideoPath);
    if (videoStat.size === 0) {
      const err = new Error("Retrieved video file is 0 bytes.") as Error & { code: InstagramErrorCode };
      err.code = "INVALID_MEDIA";
      throw err;
    }
    console.log(`[Unclip] Video validation: PASS (${videoStat.size} bytes on disk)`);

    // Stage 5: FFmpeg Audio Extraction
    console.log(`[Unclip] FFmpeg: Starting audio extraction from video file...`);
    updateJob(jobId, {
      status: "extracting",
      progress: 45,
      message: "Extracting audio with FFmpeg...",
    });

    const audioResult = await extractAudioServerSide(tempVideoPath);
    tempAudioPath = audioResult.audioPath;
    console.log(`[Unclip] FFmpeg: Audio extracted (${audioResult.audioBuffer.length} bytes)`);

    // Stage 6: Local Whisper Speech-to-Text
    console.log(`[Unclip] Whisper: Transcribing audio with local whisper.cpp...`);
    updateJob(jobId, {
      status: "transcribing",
      progress: 70,
      message: "Transcribing audio with Local Whisper...",
    });

    const sttProvider = getSTTProvider(false);
    const transcript: Transcript = await sttProvider.transcribe(audioResult.audioBuffer, {
      title,
      sourceUrl: job.url,
    });

    // Stage 7: Processing & Transcript Validation
    updateJob(jobId, {
      status: "processing",
      progress: 90,
      message: "Finalizing transcript segments...",
    });

    if (!transcript || !transcript.fullText || transcript.fullText.trim().length === 0) {
      const emptyErr = new Error("Transcription pipeline returned an empty transcript result.") as Error & { code: InstagramErrorCode };
      emptyErr.code = "EMPTY_TRANSCRIPT";
      throw emptyErr;
    }

    if (!transcript.segments || transcript.segments.length === 0) {
      const emptySegErr = new Error("Transcription pipeline returned no timestamped segments.") as Error & { code: InstagramErrorCode };
      emptySegErr.code = "EMPTY_TRANSCRIPT";
      throw emptySegErr;
    }

    transcript.metadata.author = author;

    // Stage 8: Completed
    updateJob(jobId, {
      status: "completed",
      progress: 100,
      message: "Transcription complete!",
      transcript,
    });

    console.log(`[Unclip] Whisper: Completed. Total segments: ${transcript.segments.length}. Job completed.`);
  } catch (err: unknown) {
    const errorObj = err as Error & { code?: InstagramErrorCode };
    const errorCode = errorObj.code || "MEDIA_RETRIEVAL_UNAVAILABLE";
    const errorMessage = errorObj.message || "Failed to process real Instagram transcription.";

    console.error(`[Unclip] Job failed: ${errorCode} — ${errorMessage}`);

    updateJob(jobId, {
      status: "failed",
      error: errorMessage,
      errorCode,
      message: "Couldn't transcribe this Reel",
    });
  } finally {
    // Cleanup temporary video and audio files from server disk
    if (tempVideoPath) {
      fs.unlink(tempVideoPath).catch(() => {});
    }
    if (tempAudioPath) {
      fs.unlink(tempAudioPath).catch(() => {});
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
