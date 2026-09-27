import { STTProvider } from "./types";
import { MockSTTProvider } from "./providers/mock";
import { LocalWhisperCppProvider } from "./providers/local-whisper";
import { GeminiSTTProvider } from "./providers/whisper";

export function getSTTProvider(isDemo: boolean = false): STTProvider {
  if (isDemo) {
    return new MockSTTProvider();
  }

  const providerType = (process.env.STT_PROVIDER || "local").toLowerCase().trim();

  if (providerType === "gemini") {
    return new GeminiSTTProvider();
  }

  return new LocalWhisperCppProvider();
}

