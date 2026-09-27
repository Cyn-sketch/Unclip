import { Transcript, RepurposedContent, HighlightItem } from "@/types";
import { IntelligenceProvider, SummaryResult } from "../types";

function cleanSegmentText(text: string): string {
  return (text || "").replace(/^["'\s]+|["'\s]+$/g, "").trim();
}

export class DeterministicExtractorProvider implements IntelligenceProvider {
  name = "Deterministic Fallback (Rule-Based Excerpts)";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generateSummary(transcript: Transcript): Promise<SummaryResult> {
    const fullText = (transcript.fullText || "").trim();
    const segments = (transcript.segments || []).filter((s) => s.text && s.text.trim().length > 0);

    const words = fullText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const duration = transcript.duration || (segments.length > 0 ? segments[segments.length - 1].end : 30);
    const wpm = wordCount > 0 ? Math.round((wordCount / (duration || 30)) * 60) : 120;

    if (segments.length === 0 || wordCount === 0 || fullText === "(No speech detected)") {
      return {
        executiveSummary: "No speech content was detected in this Reel.",
        keyTakeaways: [],
        coreArgument: undefined,
        actionableTakeaway: "No explicit actionable advice excerpt detected.",
        sentiment: "Neutral",
        wordCount: 0,
        speakingCadenceWPM: 0,
        isGenerative: false,
        engineName: this.name,
      };
    }

    const keyTakeaways: string[] = segments.map((s) => cleanSegmentText(s.text)).filter(Boolean);
    const coreArgument = cleanSegmentText(segments[0].text);

    const adviceKeywords = [
      "रहना", "करना", "कराना", "चाहिए", "मत", "ध्यान", "always", "should", "keep", "make", "stay", "don't", "avoid", "focus", "try"
    ];

    const actionableSegment = segments.find((seg) =>
      adviceKeywords.some((kw) => seg.text.toLowerCase().includes(kw.toLowerCase()))
    );

    const actionableTakeaway = actionableSegment
      ? cleanSegmentText(actionableSegment.text)
      : "No explicit actionable advice excerpt was detected in the spoken text.";

    return {
      executiveSummary: fullText,
      keyTakeaways,
      coreArgument,
      actionableTakeaway,
      sentiment: "Spoken Content",
      wordCount,
      speakingCadenceWPM: wpm,
      isGenerative: false,
      engineName: this.name,
    };
  }

  async generateRepurposed(transcript: Transcript): Promise<RepurposedContent["socialPosts"]> {
    const fullText = (transcript.fullText || "").trim();
    const segments = (transcript.segments || []).filter((s) => s.text && s.text.trim().length > 0);
    const mainQuote = segments.length > 0 ? cleanSegmentText(segments[0].text) : fullText;

    const instagramCaption = `[Deterministic Fallback]\n\nSpoken Content:\n"${fullText}"`;

    const linkedInPost = `[Deterministic Fallback]\n\nKey Excerpt:\n"${mainQuote}"\n\nFull Spoken Text:\n${fullText}`;

    const xThread: string[] = segments.map(
      (s, idx) => `[Fallback ${idx + 1}/${segments.length}] "${cleanSegmentText(s.text)}"`
    );
    if (xThread.length === 0 && fullText) {
      xThread.push(`"${fullText}"`);
    }

    const carouselOutline = segments.map((s, idx) => ({
      slideNumber: idx + 1,
      title: `Segment ${idx + 1}`,
      body: cleanSegmentText(s.text),
    }));

    if (carouselOutline.length === 0) {
      carouselOutline.push({
        slideNumber: 1,
        title: "Transcript",
        body: fullText,
      });
    }

    const newsletter = `[Deterministic Fallback]\n\n${fullText}`;

    return {
      instagramCaption,
      linkedInPost,
      xThread: [],
      carouselOutline: [],
      newsletter: "",
    };
  }

  async generateHighlights(transcript: Transcript): Promise<HighlightItem[]> {
    const segments = (transcript.segments || []).filter((s) => s.text && s.text.trim().length > 0);

    if (segments.length === 0) {
      return [
        {
          id: "hl-1",
          start: 0,
          end: Math.min(transcript.duration || 5, 10),
          text: transcript.fullText || "Spoken Segment",
          reason: "Full transcript segment",
          score: 1.0,
        },
      ];
    }

    return segments.map((seg, idx) => ({
      id: `hl-${idx + 1}`,
      start: seg.start,
      end: seg.end,
      text: cleanSegmentText(seg.text),
      reason: `Segment ${idx + 1} (${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s)`,
      score: 1.0 - idx * 0.05,
    }));
  }
}
