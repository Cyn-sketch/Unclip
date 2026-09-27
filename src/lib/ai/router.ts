import { IntelligenceProvider } from "./types";
import { LocalLlamaProvider } from "./providers/local-llama";
import { DeterministicExtractorProvider } from "./providers/deterministic";

const localLlamaProvider = new LocalLlamaProvider();
const deterministicProvider = new DeterministicExtractorProvider();

export async function getIntelligenceProvider(): Promise<IntelligenceProvider> {
  try {
    const isAvailable = await localLlamaProvider.isAvailable();
    if (isAvailable) {
      return localLlamaProvider;
    }
  } catch (err) {
    console.warn("[Unclip AI] Local LLM availability check failed, falling back to deterministic:", err);
  }

  return deterministicProvider;
}

export async function getActiveProviderName(): Promise<string> {
  const provider = await getIntelligenceProvider();
  return provider.name;
}

export { localLlamaProvider, deterministicProvider };
