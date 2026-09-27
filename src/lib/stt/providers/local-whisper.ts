import { STTProvider, TranscribeOptions } from "../types";
import { Transcript, Segment } from "@/types";
import { generateId } from "@/lib/utils";
import { resolveFFmpegBinaryPath } from "@/lib/audio/extractor";
import { normalizeTranscript } from "@/lib/stt/normalization";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

export class LocalWhisperCppProvider implements STTProvider {
  name = "Local Whisper (whisper.cpp - ggml-large-v3-turbo)";

  private getExecutablePath(): string {
    const customBin = process.env.WHISPER_CPP_PATH;
    if (customBin && fsSync.existsSync(customBin)) {
      return customBin;
    }

    const defaultBin = path.join(process.cwd(), "tools", "whisper.cpp", "build", "bin", "whisper-cli");
    if (fsSync.existsSync(defaultBin)) {
      return defaultBin;
    }

    throw new Error(
      `whisper-cli executable not found at: ${defaultBin}. Please run the build script in tools/whisper.cpp/build_whisper.sh.`
    );
  }

  private getModelPath(): string {
    const customModel = process.env.WHISPER_MODEL_PATH;
    if (customModel && fsSync.existsSync(customModel)) {
      return customModel;
    }

    // Preferred primary local model
    const primaryModel = path.join(process.cwd(), "tools", "whisper.cpp", "models", "ggml-large-v3-turbo.bin");
    if (fsSync.existsSync(primaryModel)) {
      return primaryModel;
    }

    // Fallback local model
    const fallbackModel = path.join(process.cwd(), "tools", "whisper.cpp", "models", "ggml-small.bin");
    if (fsSync.existsSync(fallbackModel)) {
      return fallbackModel;
    }

    throw new Error(
      `Whisper model file not found at: ${primaryModel} or ${fallbackModel}. Please download model into tools/whisper.cpp/models/.`
    );
  }

  async transcribe(audio: ArrayBuffer | Buffer | string, options?: TranscribeOptions): Promise<Transcript> {
    const exePath = this.getExecutablePath();
    const modelPath = this.getModelPath();
    const ffmpegBin = resolveFFmpegBinaryPath();

    const tmpDir = os.tmpdir();
    const id = generateId();
    const tmpInputPath = path.join(tmpDir, `unclip_local_in_${id}.tmp`);
    const wavOutputPath = path.join(tmpDir, `unclip_local_16k_${id}.wav`);
    const jsonOutputPath = `${wavOutputPath}.json`;

    let createdInputFile = false;
    let actualInputPath = "";

    try {
      if (typeof audio === "string") {
        actualInputPath = audio;
      } else {
        const buffer = Buffer.isBuffer(audio) ? audio : Buffer.from(audio);
        await fs.writeFile(tmpInputPath, buffer);
        createdInputFile = true;
        actualInputPath = tmpInputPath;
      }

      // Convert input audio to 16kHz mono 16-bit PCM WAV using FFmpeg
      await execFileAsync(ffmpegBin, [
        "-i", actualInputPath,
        "-vn",
        "-ar", "16000",
        "-ac", "1",
        "-c:a", "pcm_s16le",
        wavOutputPath,
        "-y"
      ], { timeout: 60000 });

      const promptText = options?.prompt || "Hindi and English mixed-language speech (Hinglish). Preserve both Hindi and English words exactly as spoken.";

      // Run whisper-cli with large-v3-turbo, language auto-detection, Hinglish prompt, and NO VAD flags
      await execFileAsync(exePath, [
        "-m", modelPath,
        "-f", wavOutputPath,
        "-l", options?.language || "auto",
        "--prompt", promptText,
        "--output-json",
        "-ojf"
      ], { timeout: 120000 });

      if (!fsSync.existsSync(jsonOutputPath)) {
        throw new Error(`whisper-cli completed but did not produce expected JSON output file at: ${jsonOutputPath}`);
      }

      const jsonStr = await fs.readFile(jsonOutputPath, "utf-8");
      const parsed = JSON.parse(jsonStr);

      const rawTranscription = parsed.transcription || parsed.segments || [];
      const language = parsed.result?.language || parsed.language || options?.language || "auto";

      const rawSegments: Segment[] = rawTranscription.map((item: any, index: number) => {
        let start = 0;
        let end = 0;

        if (item.offsets) {
          start = (item.offsets.from || 0) / 1000;
          end = (item.offsets.to || 0) / 1000;
        } else if (item.timestamps) {
          start = typeof item.timestamps.from === "number" ? item.timestamps.from : 0;
          end = typeof item.timestamps.to === "number" ? item.timestamps.to : 0;
        } else {
          start = item.start ?? index * 3;
          end = item.end ?? (index + 1) * 3;
        }

        return {
          id: `seg-${index}`,
          start: Math.round(start * 100) / 100,
          end: Math.round(end * 100) / 100,
          text: (item.text || "").trim(),
          speaker: item.speaker || "Speaker 1",
        };
      });

      const rawFullText = rawSegments.map((s) => s.text).filter(Boolean).join(" ").trim();
      const duration = rawSegments.length > 0 ? Math.ceil(rawSegments[rawSegments.length - 1].end) : 0;

      const normalized = normalizeTranscript(rawFullText, rawSegments);

      return {
        id: `tr-${generateId()}`,
        language,
        duration,
        fullText: normalized.fullText || "(No speech detected)",
        segments: normalized.segments.length > 0 ? normalized.segments : [
          {
            id: "seg-0",
            start: 0,
            end: duration || 3,
            text: normalized.fullText || "(No speech detected)",
            speaker: "Speaker 1",
          }
        ],
        metadata: {
          title: options?.title || "Instagram Video Transcript",
          sourceUrl: options?.sourceUrl,
          createdAt: new Date().toISOString(),
          sttProvider: this.name,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const localErr = new Error(`Local whisper.cpp transcription failed: ${msg}`);
      (localErr as Error & { code: string }).code = "LOCAL_STT_FAILED";
      throw localErr;
    } finally {
      // Cleanup temp files
      if (createdInputFile) {
        fs.unlink(tmpInputPath).catch(() => {});
      }
      fs.unlink(wavOutputPath).catch(() => {});
      fs.unlink(jsonOutputPath).catch(() => {});
    }
  }
}
