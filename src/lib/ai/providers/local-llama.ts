import { Transcript, RepurposedContent, HighlightItem, Segment } from "@/types";
import { IntelligenceProvider, SummaryResult } from "../types";
import { execFile } from "child_process";
import { promisify } from "util";
import fsSync from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

// Mutex queue to prevent concurrent LLM processes from exhausting Metal / RAM resources
let llamaLock: Promise<void> = Promise.resolve();

function runWithLock<T>(task: () => Promise<T>): Promise<T> {
  const next = llamaLock.then(task, task);
  llamaLock = next.then(() => {}, () => {});
  return next;
}

function cleanSegmentText(text: string): string {
  return (text || "").replace(/^["'\s]+|["'\s]+$/g, "").trim();
}

function parseJsonResponse<T>(rawText: string): T {
  let cleaned = rawText.trim();

  // Extract JSON object or array bounds
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
  } else if (firstBracket !== -1) {
    const lastBracket = cleaned.lastIndexOf("]");
    if (lastBracket > firstBracket) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }
  }

  // Sanitize unescaped newlines inside strings
  let sanitized = "";
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '"' && !isEscaped) {
      inString = !inString;
      sanitized += ch;
    } else if (inString) {
      if (ch === "\n") {
        sanitized += "\\n";
      } else if (ch === "\r") {
        sanitized += "\\r";
      } else if (ch === "\t") {
        sanitized += "\\t";
      } else {
        sanitized += ch;
      }
    } else {
      sanitized += ch;
    }
    isEscaped = ch === "\\" ? !isEscaped : false;
  }

  try {
    return JSON.parse(sanitized);
  } catch (err) {
    // Structural repair attempt
    try {
      let stringClosed = sanitized;
      if (inString) stringClosed += '"';
      stringClosed = stringClosed.replace(/,\s*$/, "").replace(/:\s*$/, ': ""');

      const stack: string[] = [];
      let strState = false;
      let escState = false;

      for (let i = 0; i < stringClosed.length; i++) {
        const c = stringClosed[i];
        if (c === '"' && !escState) {
          strState = !strState;
        } else if (!strState) {
          if (c === "{" || c === "[") {
            stack.push(c);
          } else if (c === "}" || c === "]") {
            if (stack.length > 0) {
              const top = stack[stack.length - 1];
              if ((c === "}" && top === "{") || (c === "]" && top === "[")) {
                stack.pop();
              }
            }
          }
        }
        escState = c === "\\" ? !escState : false;
      }

      let repaired = stringClosed;
      while (stack.length > 0) {
        const open = stack.pop();
        if (open === "{") repaired += "}";
        else if (open === "[") repaired += "]";
      }

      return JSON.parse(repaired);
    } catch {
      throw err;
    }
  }
}

export class LocalLlamaProvider implements IntelligenceProvider {
  name = "Local Qwen (Qwen2.5-3B-Instruct)";

  private getExecutablePath(): string {
    const customBin = process.env.LLAMA_CPP_PATH;
    if (customBin && fsSync.existsSync(customBin)) {
      return customBin;
    }

    const simpleBin = path.join(process.cwd(), "tools", "llama.cpp", "build", "bin", "llama-simple");
    if (fsSync.existsSync(simpleBin)) {
      return simpleBin;
    }

    const defaultBin = path.join(process.cwd(), "tools", "llama.cpp", "build", "bin", "llama-cli");
    if (fsSync.existsSync(defaultBin)) {
      return defaultBin;
    }

    throw new Error(`llama executable not found at: ${simpleBin}`);
  }

  private getModelPath(): string {
    const customModel = process.env.LOCAL_LLM_MODEL_PATH;
    if (customModel && fsSync.existsSync(customModel)) {
      return customModel;
    }

    const defaultModel = path.join(
      process.cwd(),
      "tools",
      "llama.cpp",
      "models",
      "qwen2.5-3b-instruct-q4_k_m.gguf"
    );
    if (fsSync.existsSync(defaultModel)) {
      return defaultModel;
    }

    throw new Error(`Qwen2.5 GGUF model not found at: ${defaultModel}`);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const exe = this.getExecutablePath();
      const model = this.getModelPath();
      return fsSync.existsSync(exe) && fsSync.existsSync(model);
    } catch {
      return false;
    }
  }

  private async queryLlama(prompt: string, maxTokens = 768): Promise<string> {
    const exePath = this.getExecutablePath();
    const modelPath = this.getModelPath();

    return runWithLock(async () => {
      console.log(`[Unclip AI] Running Local Qwen inference (${maxTokens} max tokens)...`);
      const startTime = Date.now();

      const { stdout, stderr } = await execFileAsync(
        exePath,
        [
          "-m", modelPath,
          "-n", maxTokens.toString(),
          "-ngl", "99",
          "-p", prompt
        ],
        { timeout: 90000 }
      );

      const elapsedMs = Date.now() - startTime;
      console.log(`[Unclip AI] Local Qwen inference completed in ${(elapsedMs / 1000).toFixed(2)}s`);

      let output = stdout;
      const assistantMarker = "<|im_start|>assistant\n";
      const markerIdx = output.lastIndexOf(assistantMarker);
      if (markerIdx !== -1) {
        output = output.substring(markerIdx + assistantMarker.length);
      }

      // Filter out ggml metal compilation & perf log lines
      output = output.replace(/ggml_metal_library_compile_pipeline:[^\n]*\n?/g, "");
      output = output.replace(/llama_perf_[^\n]*\n?/g, "");
      output = output.replace(/~llama_context[^\n]*\n?/g, "");
      output = output.replace(/sched_reserve[^\n]*\n?/g, "");
      output = output.replace(/main: decoded [^\n]*\n?/g, "");

      return output;
    });
  }

  async generateSummary(transcript: Transcript): Promise<SummaryResult> {
    const fullText = (transcript.fullText || "").trim();
    const segments = transcript.segments || [];

    const words = fullText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const duration = transcript.duration || (segments.length > 0 ? segments[segments.length - 1].end : 30);
    const wpm = wordCount > 0 ? Math.round((wordCount / (duration || 30)) * 60) : 120;

    const prompt = `<|im_start|>system
You are Unclip's local content intelligence engine.
Analyze ONLY the supplied video Reel transcript.
Identify the true subject, central proposition, context, and key takeaways.
Do NOT invent facts, numbers, dates, claims, or advice that are not present in the transcript.
Do NOT use generic filler like 'This video discusses Instagram Video...'.

Respond ONLY with a valid JSON object:
{
  "executiveSummary": "Concise 2-3 sentence summary explaining what this Reel is actually about and the speaker's main point.",
  "coreArgument": "The central message, claim, or main point of the Reel.",
  "keyTakeaways": ["1st grounded takeaway", "2nd grounded takeaway", "3rd grounded takeaway"],
  "actionableTakeaway": "Practical advice if explicitly stated in transcript; otherwise 'Actionable takeaway: None explicitly stated.'"
}<|im_end|>
<|im_start|>user
Spoken Transcript: "${fullText}"<|im_end|>
<|im_start|>assistant
`;

    try {
      const output = await this.queryLlama(prompt, 512);
      const parsed = parseJsonResponse<any>(output);

      let keyTakeaways: string[] = Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [];
      if (keyTakeaways.length === 0) {
        keyTakeaways = segments.slice(0, 3).map((s) => cleanSegmentText(s.text)).filter(Boolean);
      }

      let actionable = parsed.actionableTakeaway || "";
      if (actionable.toLowerCase().includes("continuous verification") || actionable.toLowerCase().includes("structured implementation")) {
        actionable = fullText.toLowerCase().includes("verification") ? actionable : "Actionable takeaway: None explicitly stated.";
      }

      return {
        executiveSummary: parsed.executiveSummary || fullText,
        keyTakeaways,
        coreArgument: parsed.coreArgument || cleanSegmentText(segments[0]?.text || fullText),
        actionableTakeaway: actionable || "Actionable takeaway: None explicitly stated.",
        sentiment: "Informative",
        wordCount,
        speakingCadenceWPM: wpm,
        isGenerative: true,
        engineName: this.name,
      };
    } catch (err) {
      console.warn("[Unclip AI] Local Qwen summary generation failed:", err);
      throw err;
    }
  }

  async generateRepurposed(transcript: Transcript): Promise<RepurposedContent["socialPosts"]> {
    const fullText = (transcript.fullText || "").trim();

    const prompt = `<|im_start|>system
You are Unclip's expert social media content strategist.
Transform the core message of the supplied transcript into high-performing, platform-native written content for Instagram and LinkedIn.

STEP 1: DEEP SEMANTIC CONTEXT ANALYSIS (Internal Step - Do NOT output this analysis)
1. Core Premise: What is the Reel actually about at its highest level?
2. Detail Hierarchy: Distinguish CENTRAL IDEA vs SUPPORTING DETAIL vs INCIDENTAL DETAIL. Never promote an incidental mention into the main premise.
3. Chronology & State: Respect the speaker's explicit timeline.
4. Genuine Intent: Identify if this is personal story, product review, tutorial, opinion, case study, advice, or entertainment. Do NOT force a fake business lesson onto personal or lifestyle content!

STEP 2: PLATFORM-NATIVE CONTENT CREATION

INSTAGRAM CAPTION:
- Hook: Open with a captivating statement that fits the Reel's true subject.
- Framing: Add context that complements the video naturally without repeating it line-by-line.
- Key Aspect: Highlight the most interesting/useful point using the creator's natural tone.
- Action & Hashtags: Preserve explicit CTAs if spoken; include 3-5 distinct relevant hashtags.

LINKEDIN POST:
- Adapt structure naturally based on content type:
  * Business/Case Study -> Challenge -> Strategy -> Result -> Takeaway
  * Educational/Advice -> Dilemma/Problem -> Recommendations -> Application
  * Product Review / Personal Experience -> Context -> Personal Insight -> Reflection
  * Opinion/Story -> Situation -> Turning Point -> Takeaway
- Tone: Professional storytelling tailored for LinkedIn without forcing fake corporate lessons onto casual subjects.
- Differentiation: Structure, framing, and tone MUST be meaningfully different from the Instagram caption.

NATURAL PHRASING & ACCURACY CONSTRAINTS:
1. NATURAL HINDI/HINGLISH: Write in clean, conversational Hinglish or English as real creators speak. Keep technical/product/loan words in English (e.g. 'Blinkit', 'condom', 'material', 'skin-on-skin', 'content strategy', 'leads'). Never distort English words into weird phonetic Hindi.
2. IDEA ADAPTATION OVER PARAPHRASING: Re-frame the underlying idea into original copy. Do not paraphrase sentence-by-sentence.
3. ZERO INVENTED CLAIMS: Never fabricate stats, revenue, fake frameworks, or false CTAs.

Respond ONLY with a valid JSON object matching:
{
  "instagramCaption": "...",
  "linkedInPost": "..."
}<|im_end|>
<|im_start|>user
Spoken Transcript: "${fullText}"<|im_end|>
<|im_start|>assistant
`;

    try {
      const output = await this.queryLlama(prompt, 1200);

      let instagramCaption = "";
      let linkedInPost = "";

      try {
        const parsed = parseJsonResponse<any>(output);
        instagramCaption = typeof parsed.instagramCaption === "string" ? parsed.instagramCaption.trim() : "";
        linkedInPost = typeof parsed.linkedInPost === "string" ? parsed.linkedInPost.trim() : "";
      } catch {
        const extractField = (fieldName: string): string => {
          const fieldIdx = output.indexOf(`"${fieldName}"`);
          if (fieldIdx === -1) return "";
          const colonIdx = output.indexOf(":", fieldIdx);
          if (colonIdx === -1) return "";

          let rest = output.substring(colonIdx + 1).trim();
          if (rest.startsWith('"')) rest = rest.substring(1);

          const nextKeyMatch = rest.match(/"[a-zA-Z0-9_]+\"\s*:/);
          if (nextKeyMatch && nextKeyMatch.index !== undefined) {
            rest = rest.substring(0, nextKeyMatch.index).trim();
            if (rest.endsWith(",")) rest = rest.substring(0, rest.length - 1).trim();
          } else {
            const lastBrace = rest.lastIndexOf("}");
            if (lastBrace !== -1) rest = rest.substring(0, lastBrace).trim();
          }
          if (rest.endsWith('"')) rest = rest.substring(0, rest.length - 1).trim();

          return rest.replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
        };

        instagramCaption = extractField("instagramCaption");
        linkedInPost = extractField("linkedInPost");
      }

      if (instagramCaption.length > 0 || linkedInPost.length > 0) {
        return {
          instagramCaption: instagramCaption || fullText,
          linkedInPost: linkedInPost || fullText,
          xThread: [],
          carouselOutline: [],
          newsletter: "",
        };
      }

      throw new Error("Local Qwen returned empty repurposed strings");
    } catch (err) {
      console.warn("[Unclip AI] Local Qwen repurpose generation failed:", err);
      throw err;
    }
  }

  async generateHighlights(transcript: Transcript): Promise<HighlightItem[]> {
    const segments = transcript.segments || [];
    if (segments.length === 0) {
      return [
        {
          id: "hl-1",
          start: 0,
          end: Math.min(transcript.duration || 5, 10),
          text: transcript.fullText || "Spoken Segment",
          reason: "Opening hook and key statement.",
          score: 1.0,
        },
      ];
    }

    const segmentsSummary = segments.map((s) => ({ id: s.id, text: cleanSegmentText(s.text) }));

    const prompt = `<|im_start|>system
Select 2-4 key highlight segments from the list of spoken transcript segments.
Identify the most interesting, surprising, or impactful moments.

Respond ONLY with a JSON array:
[
  { "id": "segment-id", "reason": "Brief explanation why this spoken moment is engaging or impactful" }
]<|im_end|>
<|im_start|>user
Segments: ${JSON.stringify(segmentsSummary)}<|im_end|>
<|im_start|>assistant
`;

    try {
      const output = await this.queryLlama(prompt, 384);
      const selected = parseJsonResponse<Array<{ id: string; reason: string }>>(output);

      if (Array.isArray(selected) && selected.length > 0) {
        const highlights: HighlightItem[] = [];

        selected.forEach((item, idx) => {
          const match = segments.find((s) => s.id === item.id);
          if (match) {
            highlights.push({
              id: `hl-${idx + 1}`,
              start: match.start,
              end: match.end,
              text: cleanSegmentText(match.text),
              reason: item.reason || `Key spoken segment (${match.start.toFixed(1)}s - ${match.end.toFixed(1)}s)`,
              score: 0.95 - idx * 0.05,
            });
          }
        });

        if (highlights.length > 0) return highlights;
      }
    } catch {
      // Fallback to structured segments mapping
    }

    return segments.slice(0, 4).map((seg, idx) => ({
      id: `hl-${idx + 1}`,
      start: seg.start,
      end: seg.end,
      text: cleanSegmentText(seg.text),
      reason: `Key spoken moment (${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s)`,
      score: 1.0 - idx * 0.05,
    }));
  }
}
