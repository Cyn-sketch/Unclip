import { GoogleGenAI } from "@google/genai";
import { STTProvider, TranscribeOptions } from "../types";
import { Transcript, Segment } from "@/types";
import { generateId } from "@/lib/utils";

function extractTextFromGeminiResponse(data: any): string {
  if (!data) return "";

  // Direct SDK text accessor if non-empty
  if (typeof data.text === "string" && data.text.trim().length > 0) {
    return data.text.trim();
  }

  const candidates = data.candidates || (Array.isArray(data) ? data : []);
  const candidate = candidates?.[0];
  if (!candidate) return "";

  const parts = candidate.content?.parts || [];
  let extracted = "";

  for (const part of parts) {
    if (part.text && typeof part.text === "string") {
      extracted += part.text + " ";
    }
    if (part.audioTranscription) {
      if (typeof part.audioTranscription === "string") {
        extracted += part.audioTranscription + " ";
      } else if (part.audioTranscription.text) {
        extracted += part.audioTranscription.text + " ";
      } else if (part.audioTranscription.transcript) {
        extracted += part.audioTranscription.transcript + " ";
      } else if (Array.isArray(part.audioTranscription.words)) {
        extracted += part.audioTranscription.words.map((w: any) => w.word || w.text || "").join(" ") + " ";
      }
    }
  }

  return extracted.trim();
}

async function callGeminiForModel(
  model: string,
  base64Audio: string,
  promptText: string,
  apiKey: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const backoffDelays = [2000, 5000, 10000];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= backoffDelays.length; attempt++) {
    if (attempt > 0) {
      const delayMs = backoffDelays[attempt - 1];
      console.log(
        `[Unclip STT] HTTP 503 / High Demand on model '${model}'. Retrying in ${delayMs / 1000}s (Attempt ${attempt}/${backoffDelays.length})...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      console.log(`[Unclip STT] Attempting Gemini transcription with model '${model}' (attempt ${attempt + 1})...`);
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              mimeType: "audio/mp3",
              data: base64Audio,
            },
          },
          {
            text: promptText,
          },
        ],
      });

      const text = extractTextFromGeminiResponse(response);
      if (text.length > 0) {
        return text;
      }
    } catch (sdkError: unknown) {
      const errMsg = sdkError instanceof Error ? sdkError.message : String(sdkError);
      lastError = sdkError instanceof Error ? sdkError : new Error(errMsg);

      const is503 =
        errMsg.includes("503") ||
        errMsg.includes("UNAVAILABLE") ||
        errMsg.includes("high demand") ||
        errMsg.includes("overloaded");

      if (is503 && attempt < backoffDelays.length) {
        continue;
      }

      // Try equivalent direct REST fetch before giving up
      try {
        console.log(`[Unclip STT] SDK call error on '${model}': ${errMsg}. Trying direct REST request...`);
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: "audio/mp3",
                      data: base64Audio,
                    },
                  },
                  {
                    text: promptText,
                  },
                ],
              },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = extractTextFromGeminiResponse(data);
          if (text.length > 0) {
            return text;
          }
        } else {
          const errText = await res.text();
          lastError = new Error(`Gemini API REST error (${res.status}): ${errText}`);
          if (res.status === 503 && attempt < backoffDelays.length) {
            continue;
          }
        }
      } catch (restErr: unknown) {
        const restMsg = restErr instanceof Error ? restErr.message : String(restErr);
        lastError = new Error(restMsg);
      }

      if (!is503) {
        break;
      }
    }
  }

  throw lastError || new Error(`Model '${model}' failed after retries.`);
}

export class GeminiSTTProvider implements STTProvider {
  name = "Google Gemini (gemini-3.5-transcribe)";

  async transcribe(audio: ArrayBuffer | Buffer | string, options?: TranscribeOptions): Promise<Transcript> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      const err = new Error(
        "GEMINI_API_KEY is not configured in server environment variables. Please add GEMINI_API_KEY to your .env.local file to transcribe videos."
      );
      (err as Error & { code: string }).code = "GEMINI_API_KEY_MISSING";
      throw err;
    }

    let audioBuffer: Buffer;
    if (typeof audio === "string") {
      throw new Error("Local file path string transcription requires Buffer payload.");
    } else if (Buffer.isBuffer(audio)) {
      audioBuffer = audio;
    } else {
      audioBuffer = Buffer.from(audio as ArrayBuffer);
    }

    const base64Audio = audioBuffer.toString("base64");

    const promptText = `Generate a precise, verbatim timestamped transcript of this audio file. Format your response strictly as valid JSON matching this schema:
{
  "language": "en",
  "fullText": "Complete transcript text...",
  "segments": [
    {
      "id": "seg-0",
      "start": 0.0,
      "end": 3.5,
      "text": "First segment text"
    }
  ]
}
Ensure timestamps start from 0.0 with accurate start/end times in seconds. Do not add text outside JSON.`;

    const primaryModel = "gemini-3.5-transcribe";
    let rawContentText = "";

    try {
      rawContentText = await callGeminiForModel(primaryModel, base64Audio, promptText, apiKey);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const geminiErr = new Error(`Google Gemini API transcription (${primaryModel}) failed: ${msg}`);
      (geminiErr as Error & { code: string }).code = "STT_FAILED";
      throw geminiErr;
    }

    let parsedResponse: {
      language?: string;
      fullText?: string;
      segments?: Array<{ id?: string; start: number; end: number; text: string }>;
    } = {};

    try {
      const cleanJsonStr = rawContentText.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsedResponse = JSON.parse(cleanJsonStr);
    } catch {
      parsedResponse = {
        fullText: rawContentText.trim(),
        segments: [],
      };
    }

    const rawSegments = parsedResponse.segments || [];
    const segments: Segment[] = rawSegments.map((s, index) => ({
      id: s.id || `seg-${index}`,
      start: typeof s.start === "number" ? Math.round(s.start * 100) / 100 : index * 3,
      end: typeof s.end === "number" ? Math.round(s.end * 100) / 100 : (index + 1) * 3,
      text: (s.text || "").trim(),
      speaker: "Speaker 1",
    }));

    const fullText = (parsedResponse.fullText || segments.map((s) => s.text).join(" ") || rawContentText).trim();

    const duration = Math.ceil(
      segments.length > 0 ? segments[segments.length - 1].end : 30
    );

    return {
      id: `tr-${generateId()}`,
      language: parsedResponse.language || "en",
      duration,
      fullText: fullText || "(No speech detected)",
      segments: segments.length > 0 ? segments : [
        {
          id: "seg-0",
          start: 0,
          end: duration || 3,
          text: fullText || "(No speech detected)",
          speaker: "Speaker 1",
        }
      ],
      metadata: {
        title: options?.title || "Instagram Video Transcript",
        sourceUrl: options?.sourceUrl,
        createdAt: new Date().toISOString(),
        sttProvider: `Google Gemini (${primaryModel})`,
      },
    };
  }
}

// Export backwards-compatible alias so factory.ts and existing imports work seamlessly
export const OpenAIWhisperProvider = GeminiSTTProvider;
