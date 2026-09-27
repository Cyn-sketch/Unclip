# Production Worker Dockerfile for Unclip (Local Whisper + Playwright + FFmpeg + Qwen AI)
FROM node:20-bookworm

# Install system dependencies: build tools, ffmpeg, git, curl, python3
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    g++ \
    make \
    ffmpeg \
    git \
    curl \
    ca-certificates \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package descriptors & install Node.js dependencies
COPY package*.json ./
RUN npm ci

# Install Playwright browser binaries (Chromium) & system dependencies
RUN npx playwright install chromium --with-deps

# Copy project source code
COPY . .

# Compile local whisper.cpp executable if not present
RUN if [ ! -f "tools/whisper.cpp/build/bin/whisper-cli" ]; then \
      chmod +x tools/whisper.cpp/build_whisper.sh && \
      bash tools/whisper.cpp/build_whisper.sh ; \
    fi

# Ensure model directory exists
RUN mkdir -p tools/whisper.cpp/models tools/llama.cpp/models

# Expose worker HTTP port
EXPOSE 8080

ENV PORT=8080
ENV STT_PROVIDER=local

# Start dedicated standalone worker
CMD ["npx", "tsx", "scripts/worker.ts"]
