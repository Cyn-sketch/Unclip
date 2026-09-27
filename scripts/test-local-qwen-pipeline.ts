import { Transcript } from "../src/types";
import {
  generateSummary,
  generateRepurposedContent,
  generatePotentialHighlights,
  generateTranslations,
} from "../src/lib/ai/content-intelligence";

async function runPipelineTest() {
  const sampleTranscript: Transcript = {
    id: "test-tr-qwen-1",
    language: "hi",
    duration: 25,
    fullText:
      "वो bright red कराएंगे, तुम्हें terracotta पे अड़े रहना। इसके साथ walnut wood furniture बहुत classy लगता है। भड़कीले yellow नहीं, पापा से कहो warm beige करना है। इसके साथ oak wood और cream upholstery का combination perfect है।",
    segments: [
      {
        id: "seg-0",
        start: 0,
        end: 6.5,
        text: "वो bright red कराएंगे, तुम्हें terracotta पे अड़े रहना।",
        speaker: "Speaker 1",
      },
      {
        id: "seg-1",
        start: 6.5,
        end: 12.0,
        text: "इसके साथ walnut wood furniture बहुत classy लगता है।",
        speaker: "Speaker 1",
      },
      {
        id: "seg-2",
        start: 12.0,
        end: 18.5,
        text: "भड़कीले yellow नहीं, पापा से कहो warm beige करना है।",
        speaker: "Speaker 1",
      },
      {
        id: "seg-3",
        start: 18.5,
        end: 25.0,
        text: "इसके साथ oak wood और cream upholstery का combination perfect है।",
        speaker: "Speaker 1",
      },
    ],
    metadata: {
      title: "Interior Color Palette & Materials Guide",
      author: "@interior_expert",
      createdAt: new Date().toISOString(),
      sttProvider: "Local Whisper (whisper.cpp - ggml-large-v3-turbo)",
    },
  };

  const studyAbroadTranscript: Transcript = {
    id: "test-tr-qwen-2",
    language: "hi",
    duration: 30,
    fullText:
      "हमने एक स्टडी एब्रॉड कंसल्टेंसी का अकाउंट स्टार्ट किया था, एंड सिर्फ 3 महीनों में उसपे ज़बरदस्त रिजल्ट्स आए। इस इंडस्ट्री में कॉम्पिटिशन बहुत ज़्यादा है, लेकिन अगर आप सही कंटेंट स्ट्रैटेजी और कंसिस्टेंसी मेंटेन करो, तो लीड्स और एंगेजमेंट पक्का बढ़ेगा।",
    segments: [
      {
        id: "seg-0",
        start: 0,
        end: 10.0,
        text: "हमने एक स्टडी एब्रॉड कंसल्टेंसी का अकाउंट स्टार्ट किया था, एंड सिर्फ 3 महीनों में उसपे ज़बरदस्त रिजल्ट्स आए।",
        speaker: "Speaker 1",
      },
      {
        id: "seg-1",
        start: 10.0,
        end: 30.0,
        text: "इस इंडस्ट्री में कॉम्पिटिशन बहुत ज़्यादा है, लेकिन अगर आप सही कंटेंट स्ट्रैटेजी और कंसिस्टेंसी मेंटेन करो, तो लीड्स और एंगेजमेंट पक्का बढ़ेगा।",
        speaker: "Speaker 1",
      },
    ],
    metadata: {
      title: "Study Abroad Marketing Case Study",
      author: "@growth_marketer",
      createdAt: new Date().toISOString(),
      sttProvider: "Local Whisper (whisper.cpp - ggml-large-v3-turbo)",
    },
  };

  console.log("==========================================");
  console.log("TESTING LOCAL QWEN CONTENT INTELLIGENCE");
  console.log("==========================================");

  console.log("\n--- TEST 1: Interior Design Reel ---");
  console.log("\n1. Generating Summary...");
  const startSum = Date.now();
  const summary = await generateSummary(sampleTranscript);
  console.log(`[Time: ${Date.now() - startSum}ms] Summary Output:`);
  console.log(JSON.stringify(summary, null, 2));

  console.log("\n2. Generating Social Repurpose...");
  const startRep = Date.now();
  const repurpose = await generateRepurposedContent(sampleTranscript);
  console.log(`[Time: ${Date.now() - startRep}ms] Social Repurpose Output:`);
  console.log(JSON.stringify(repurpose, null, 2));

  console.log("\n--- TEST 2: Study-Abroad Consultancy Growth Reel ---");
  console.log("\n2. Generating Social Repurpose for Study Abroad...");
  const startRep2 = Date.now();
  const repurpose2 = await generateRepurposedContent(studyAbroadTranscript);
  console.log(`[Time: ${Date.now() - startRep2}ms] Study Abroad Repurpose Output:`);
  console.log(JSON.stringify(repurpose2, null, 2));

  console.log("\n3. Generating Highlights...");
  const startHl = Date.now();
  const highlights = await generatePotentialHighlights(sampleTranscript);
  console.log(`[Time: ${Date.now() - startHl}ms] Highlights Output:`);
  console.log(JSON.stringify(highlights, null, 2));

  console.log("\n4. Checking Translations...");
  const translations = await generateTranslations(sampleTranscript);
  console.log("Translations Output:");
  console.log(JSON.stringify(translations, null, 2));

  console.log("\n==========================================");
  console.log("ALL TESTS COMPLETED SUCCESSFULLY!");
  console.log("==========================================");
}

runPipelineTest().catch((err) => {
  console.error("Pipeline test failed:", err);
  process.exit(1);
});
