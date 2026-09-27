import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@google/genai", "ffmpeg-static", "playwright"],
};

export default nextConfig;
