import { Transcript, RepurposedContent, HighlightItem } from "@/types";

export interface SummaryResult {
  executiveSummary: string;
  keyTakeaways: string[];
  coreArgument?: string;
  actionableTakeaway?: string;
  sentiment: string;
  wordCount: number;
  speakingCadenceWPM: number;
  isGenerative: boolean;
  engineName: string;
}

export interface IntelligenceProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  generateSummary(transcript: Transcript): Promise<SummaryResult>;
  generateRepurposed(transcript: Transcript): Promise<RepurposedContent["socialPosts"]>;
  generateHighlights(transcript: Transcript): Promise<HighlightItem[]>;
}
