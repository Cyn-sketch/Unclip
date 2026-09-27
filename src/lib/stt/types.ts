import { Transcript } from "@/types";

export interface TranscribeOptions {
  language?: string;
  prompt?: string;
  title?: string;
  sourceUrl?: string;
}

export interface STTProvider {
  name: string;
  transcribe(audio: ArrayBuffer | Buffer | string, options?: TranscribeOptions): Promise<Transcript>;
}
