# Railway deployment trigger - self-contained whisper.cpp build
# Production Worker Dockerfile for Unclip (Local Whisper + Playwright + FFmpeg)
FROM node:20-bookworm

# 1. Install system dependencies: build tools (cmake, g++, make), ffmpeg, git, curl, python3
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

# 2. Copy package descriptors & install Node.js dependencies
COPY package*.json ./
RUN npm ci

# 3. Install Playwright browser binaries (Chromium) & system dependencies
RUN npx playwright install chromium --with-deps

# 4. Copy project source code
COPY . .

# 5. Clone whisper.cpp repository directly into /app/tools/whisper.cpp
RUN rm -rf /app/tools/whisper.cpp && \
    git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git /app/tools/whisper.cpp

# 6. Build whisper-cli using CMake into /app/tools/whisper.cpp/build/bin/whisper-cli
RUN cmake -B /app/tools/whisper.cpp/build -S /app/tools/whisper.cpp -DWHISPER_BUILD_EXAMPLES=ON && \
    cmake --build /app/tools/whisper.cpp/build --config Release --target whisper-cli -j$(nproc)

# 7. Download ggml-large-v3-turbo.bin model into /app/tools/whisper.cpp/models/
RUN mkdir -p /app/tools/whisper.cpp/models /app/tools/llama.cpp/models && \
    curl -L -o /app/tools/whisper.cpp/models/ggml-large-v3-turbo.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin

# Expose worker HTTP port
EXPOSE 8080

ENV PORT=8080
ENV STT_PROVIDER=local

# Start dedicated standalone worker
CMD ["npx", "tsx", "scripts/worker.ts"]
