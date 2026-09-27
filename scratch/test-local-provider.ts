import { LocalWhisperCppProvider } from "../src/lib/stt/providers/local-whisper";
import fs from "fs";
import path from "path";

async function testLocalProvider() {
  console.log("=== Testing LocalWhisperCppProvider Standalone ===");

  const samplePath = path.join(process.cwd(), "tools", "whisper.cpp", "samples", "jfk.wav");
  if (!fs.existsSync(samplePath)) {
    throw new Error(`Sample file not found at: ${samplePath}`);
  }

  const audioBuffer = fs.readFileSync(samplePath);
  console.log(`Loaded test audio buffer: ${audioBuffer.length} bytes from ${samplePath}`);

  // Confirm STT_PROVIDER is set to local
  process.env.STT_PROVIDER = "local";

  const provider = new LocalWhisperCppProvider();
  console.log(`Provider initialized: ${provider.name}`);

  const startTime = Date.now();
  const transcript = await provider.transcribe(audioBuffer, {
    title: "JFK Test Audio",
    sourceUrl: "https://local-test",
  });
  const elapsedMs = Date.now() - startTime;

  console.log("\n--- TRANSCRIPTION RESULT ---");
  console.log(`ID: ${transcript.id}`);
  console.log(`Language detected: ${transcript.language}`);
  console.log(`Duration: ${transcript.duration}s`);
  console.log(`Execution time: ${elapsedMs}ms`);
  console.log(`STT Provider Metadata: ${transcript.metadata.sttProvider}`);
  console.log(`Full Text: "${transcript.fullText}"`);
  console.log(`Segments count: ${transcript.segments.length}`);
  console.log("First 3 segments:");
  console.dir(transcript.segments.slice(0, 3), { depth: null });

  if (!transcript.fullText || transcript.fullText.includes("(No speech detected)")) {
    throw new Error("Local transcription failed to extract text from JFK sample!");
  }

  console.log("\nSUCCESS: Local whisper.cpp provider transcribed sample audio perfectly without Gemini API!");
}

testLocalProvider().catch((err) => {
  console.error("Test FAILED:", err);
  process.exit(1);
});
