# Unclip — AI-Powered Instagram Video Transcription & Content Intelligence

Unclip is a production-quality web application built with **Next.js**, **TypeScript**, and **Tailwind CSS** that converts publicly accessible Instagram Reels and videos into accurate, timestamped transcripts, executive summaries, social posts, potential highlight clips, and multi-language translations.

---

## 🌟 Key Features

- ✂️ **Centralized Unclip Branding**: `src/config/site.ts` centralizes all product names, taglines, logos, and meta tags.
- 🔗 **Instagram URL Validation**: Supports public `/reel/` and `/p/` URLs with format parsing and canonical URL normalization.
- 🔒 **Compliant Media Retrieval**: Strictly adheres to public web endpoints without cookie scraping, authentication bypasses, or CAPTCHA hacks.
- ⚡ **Async Job Pipeline**: Polling job system (`POST /api/transcribe` ➔ `GET /api/transcribe/[jobId]`) tracking states (`queued`, `retrieving`, `extracting`, `transcribing`, `processing`, `completed`, `failed`).
- 🎙️ **Modular STT Architecture**: Supports **OpenAI Whisper** and built-in **Demo STT Engine**.
- 🎬 **Dual-Mode Video Player**: Mode A (Authorized media playback) & Mode B (Transcript-only fallback view).
- 📝 **Transcript Studio**: Segment viewer, real-time search filter, click-to-seek, segment inline editing, word count, copy options.
- 📄 **Multi-Format Export**: Export transcripts to `.srt`, `.vtt`, `.txt`, `.md`, and `.json`.
- 🤖 **Content Intelligence Studio**: Modular AI endpoints (`/api/ai/summary`, `/api/ai/repurpose`, `/api/ai/highlights`, `/api/ai/translate`).

---

## 🚀 Getting Started

### 1. Installation

```bash
cd /Users/zubedakhan/.gemini/antigravity/scratch/instagram-transcriber
npm install
```

### 2. Environment Variables & STT Provider

Create or update `.env.local`:

```env
# Choose Speech-to-Text Provider: 'local' (whisper.cpp) or 'gemini' (Google Gemini 3.5 Transcribe)
STT_PROVIDER=local

# Required if using STT_PROVIDER=gemini
GEMINI_API_KEY=AQ...
```

### 3. Local Speech-to-Text Setup (whisper.cpp)

When `STT_PROVIDER=local` is selected, Unclip transcribes audio locally on your machine with **zero Gemini API requests**.

1. **Build `whisper.cpp`**:
   ```bash
   cd tools/whisper.cpp
   ./build_whisper.sh
   ```
   *Automatically compiles `whisper-cli` for macOS Apple Silicon (`arm64`) using Apple's Accelerate framework.*

2. **Whisper Model Location**:
   The multilingual model is stored outside `node_modules` at:
   `tools/whisper.cpp/models/ggml-small.bin`

3. **Download Model (if missing)**:
   ```bash
   cd tools/whisper.cpp
   bash ./models/download-ggml-model.sh small
   ```

### 4. Development Server

Run Unclip locally on port 3001:

```bash
npm run dev -- -p 3001
```

Open [http://localhost:3001](http://localhost:3001) in your browser.


---

## 🛠️ Verification & Building

```bash
# Type check
npx tsc --noEmit

# Production build
npm run build
```

---

## 📁 Architecture Overview

```
src/
├── app/
│   ├── api/
│   │   ├── transcribe/         # POST /api/transcribe & GET /api/transcribe/[jobId]
│   │   └── ai/                 # Modular AI endpoints (/summary, /repurpose, /highlights, /translate)
│   ├── globals.css             # Near-black theme & purple ambient glows
│   └── page.tsx                # Main Unclip application
├── components/
│   ├── branding/               # BrandLogo & Header
│   ├── home/                   # Hero, UrlInputBar, SampleReelSelector
│   └── workspace/              # VideoPlayer, TranscriptStudio, ContentStudio, ExportModal
├── config/
│   └── site.ts                 # Centralized SITE_CONFIG branding ("Unclip")
├── lib/
│   ├── instagram/              # validator.ts, metadata.ts, media.ts
│   ├── audio/                  # extractor.ts (FFmpeg audio extraction)
│   ├── stt/                    # STTProvider interface, OpenAI Whisper & Mock providers
│   ├── ai/                     # content-intelligence.ts
│   └── security/               # ssrf.ts
└── types/                      # TypeScript definitions (Transcript, Segment, Job)
```
