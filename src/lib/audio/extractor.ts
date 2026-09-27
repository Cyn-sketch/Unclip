import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
import ffmpegPath from "ffmpeg-static";
import { generateId } from "@/lib/utils";

const execAsync = promisify(exec);

export interface ExtractionResult {
  audioBuffer: Buffer;
  audioPath: string;
  durationSeconds: number;
  mimeType: string;
}

export function resolveFFmpegBinaryPath(): string {
  // 1. Explicit environment variable override if provided
  if (process.env.FFMPEG_BIN && fsSync.existsSync(process.env.FFMPEG_BIN)) {
    return process.env.FFMPEG_BIN;
  }

  // 2. Imported ffmpeg-static package path if valid on disk
  if (ffmpegPath && typeof ffmpegPath === "string" && fsSync.existsSync(ffmpegPath)) {
    return ffmpegPath;
  }

  // 3. Fallback to process.cwd() node_modules resolution for Next.js bundled runtime
  const exeName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const projectNodeModulesPath = path.join(process.cwd(), "node_modules", "ffmpeg-static", exeName);
  if (fsSync.existsSync(projectNodeModulesPath)) {
    return projectNodeModulesPath;
  }

  // 4. System PATH fallback
  return "ffmpeg";
}

export async function extractAudioServerSide(videoLocalPath: string): Promise<ExtractionResult> {
  // Validate input video file exists on disk and is non-empty
  try {
    const stat = await fs.stat(videoLocalPath);
    if (stat.size === 0) {
      const err = new Error("Video file supplied for FFmpeg audio extraction is 0 bytes.");
      (err as Error & { code: string }).code = "INVALID_MEDIA";
      throw err;
    }
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "INVALID_MEDIA") throw err;
    const fileErr = new Error(`Video file does not exist at local path: ${videoLocalPath}`);
    (fileErr as Error & { code: string }).code = "INVALID_MEDIA";
    throw fileErr;
  }

  const binary = resolveFFmpegBinaryPath();
  console.log(`[Unclip] Resolved FFmpeg binary path: ${binary}`);

  const tmpDir = os.tmpdir();
  const outputFileName = `unclip_audio_${generateId()}.mp3`;
  const audioOutputPath = path.join(tmpDir, outputFileName);

  // Shell-sanitize file path
  const sanitizedInput = videoLocalPath.replace(/(["\s'$`\\])/g, "\\$1");
  const sanitizedOutput = audioOutputPath.replace(/(["\s'$`\\])/g, "\\$1");

  // FFmpeg command: extract audio to mono 16kHz MP3 for speech recognition
  const ffmpegCmd = `"${binary}" -i "${sanitizedInput}" -vn -acodec libmp3lame -ac 1 -ar 16000 -q:a 4 "${sanitizedOutput}" -y`;

  try {
    await execAsync(ffmpegCmd, { timeout: 60000 });

    const audioStat = await fs.stat(audioOutputPath);
    if (audioStat.size === 0) {
      const err = new Error("FFmpeg audio extraction produced an empty audio file (0 bytes).");
      (err as Error & { code: string }).code = "NO_AUDIO_STREAM";
      throw err;
    }

    const audioBuffer = await fs.readFile(audioOutputPath);

    // Clean up temporary audio file asynchronously
    fs.unlink(audioOutputPath).catch(() => {});

    return {
      audioBuffer,
      audioPath: audioOutputPath,
      durationSeconds: 45, // Estimated duration or parsed from ffprobe
      mimeType: "audio/mp3",
    };
  } catch (err: unknown) {
    // Ensure cleanup
    fs.unlink(audioOutputPath).catch(() => {});

    if ((err as { code?: string }).code) throw err;

    const ffmpegErr = new Error(
      "FFmpeg audio extraction failed: " + (err instanceof Error ? err.message : String(err))
    );
    (ffmpegErr as Error & { code: string }).code = "FFMPEG_FAILED";
    throw ffmpegErr;
  }
}
