import { Transcript, RepurposedContent, HighlightItem } from "@/types";
import { getIntelligenceProvider } from "./router";

export async function generateSummary(transcript: Transcript) {
  const provider = await getIntelligenceProvider();
  try {
    return await provider.generateSummary(transcript);
  } catch (err) {
    console.warn("[Unclip AI] Primary provider failed for summary, using deterministic fallback:", err);
    const { DeterministicExtractorProvider } = await import("./providers/deterministic");
    const fallback = new DeterministicExtractorProvider();
    return await fallback.generateSummary(transcript);
  }
}

export async function generateRepurposedContent(transcript: Transcript): Promise<RepurposedContent["socialPosts"]> {
  const provider = await getIntelligenceProvider();
  try {
    return await provider.generateRepurposed(transcript);
  } catch (err) {
    console.warn("[Unclip AI] Primary provider failed for repurpose, using deterministic fallback:", err);
    const { DeterministicExtractorProvider } = await import("./providers/deterministic");
    const fallback = new DeterministicExtractorProvider();
    return await fallback.generateRepurposed(transcript);
  }
}

export async function generatePotentialHighlights(transcript: Transcript): Promise<HighlightItem[]> {
  const provider = await getIntelligenceProvider();
  try {
    return await provider.generateHighlights(transcript);
  } catch (err) {
    console.warn("[Unclip AI] Primary provider failed for highlights, using deterministic fallback:", err);
    const { DeterministicExtractorProvider } = await import("./providers/deterministic");
    const fallback = new DeterministicExtractorProvider();
    return await fallback.generateHighlights(transcript);
  }
}

export async function generateTranslations(_transcript: Transcript, _targetLanguages: string[] = ["es", "fr", "de"]) {
  return {
    isAvailable: false,
    message: "Local neural translation engine is currently unconfigured. Spoken text is preserved in original language.",
  };
}
