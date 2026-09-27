import { Segment } from "@/types";

/**
 * Conservative Hinglish / Hindi spelling & orthography normalization.
 * 
 * Rules:
 * 1. Correct obvious Hindi spelling and orthographic errors (e.g. matras, nuktas).
 * 2. Correct obvious phonetic misrecognitions when context makes intended word clear.
 * 3. Preserve English words spoken in English.
 * 4. Preserve Hinglish/code-switching.
 * 5. NEVER translate Hindi into English or English into Hindi.
 * 6. NEVER rewrite speaker's wording or grammar.
 * 7. NEVER invent missing content or remove legitimate repetitions.
 * 8. Preserve timestamps and segment ordering exactly.
 */

const REPLACEMENT_RULES: Array<[string, string]> = [
  // 1. Common pronoun / demonstrative misrecognitions
  ["गो", "वो"],

  // 2. Retroflex D / R (Nukta) fixes
  ["अडे", "अड़े"],
  ["अडा", "अड़ा"],
  ["अडी", "अड़ी"],
  ["भरकीले", "भड़कीले"],
  ["भरकीला", "भड़कीला"],
  ["भरकीली", "भड़कीली"],
  ["लडका", "लड़का"],
  ["लडकी", "लड़की"],
  ["लडके", "लड़के"],
  ["लडकीयां", "लड़कियां"],
  ["गाडी", "गाड़ी"],
  ["गाडिया", "गाड़ियां"],
  ["पेड", "पेड़"],
  ["पेडो", "पेड़ों"],

  // 3. Matra & Phonetic typos
  ["निला", "नीला"],
  ["पिाला", "पीला"],
  ["चांदार", "शानदार"],
  ["शांदार", "शानदार"],
  ["छानदार", "शानदार"],
  ["यलो", "yellow"],

  // 4. Common conjunctions & verb endings
  ["क्युकी", "क्योंकि"],
  ["क्युकि", "क्योंकि"],
  ["क्यकी", "क्योंकि"],
  ["चाहीए", "चाहिए"],
  ["चाहीये", "चाहिए"],
  ["नही", "नहीं"],
  ["कराऐंगे", "कराएंगे"],
  ["करवाऐंगे", "करवाएंगे"],
  ["जाऐंगे", "जाएंगे"],
  ["आऐंगे", "आएंगे"],
];

/**
 * Creates a Unicode-safe word boundary regular expression for Devanagari & ASCII terms.
 * JavaScript \b is ASCII-only ([a-zA-Z0-9_]), so it fails on Devanagari characters.
 * [^\p{L}\p{M}\p{N}] matches any character that is NOT a Unicode Letter, Mark (matra), or Number.
 */
function buildUnicodeBoundaryRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<=^|[^\\p{L}\\p{M}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{M}\\p{N}])`, "gu");
}

/**
 * Cleans up a single string segment text without altering meaning or structure.
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  let cleaned = text;

  for (const [term, replacement] of REPLACEMENT_RULES) {
    const rx = buildUnicodeBoundaryRegex(term);
    cleaned = cleaned.replace(rx, replacement);
  }

  // Duplicate matra fixes (e.g. extra aa matra)
  cleaned = cleaned.replace(/ाा+/g, "ा");
  cleaned = cleaned.replace(/ीी+/g, "ी");
  cleaned = cleaned.replace(/ूू+/g, "ू");

  // Normalize duplicate spaces while preserving words
  return cleaned.replace(/[ \t]+/g, " ").trim();
}

/**
 * Normalizes full transcript while retaining raw original internally.
 */
export function normalizeTranscript(
  rawFullText: string,
  rawSegments: Segment[]
): {
  fullText: string;
  segments: Segment[];
  rawFullText: string;
  rawSegments: Segment[];
} {
  const cleanedSegments: Segment[] = (rawSegments || []).map((seg) => ({
    ...seg,
    text: normalizeText(seg.text),
  }));

  const cleanedFullText = cleanedSegments
    .map((s) => s.text)
    .filter(Boolean)
    .join(" ")
    .trim() || normalizeText(rawFullText);

  return {
    fullText: cleanedFullText,
    segments: cleanedSegments,
    rawFullText,
    rawSegments: rawSegments || [],
  };
}
