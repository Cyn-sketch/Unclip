"use client";

import React, { useEffect, useRef } from "react";
import Hls from "hls.js";

interface BackgroundVideoProps {
  src?: string;
}

export const BackgroundVideo: React.FC<BackgroundVideoProps> = ({
  src = "https://stream.mux.com/kimF2ha9zLrX64H00UgLGPflCzNtl1T0215MlAmeOztv8.m3u8",
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Safari HLS support
      video.src = src;
      video.play().catch(() => {});
    } else if (Hls.isSupported()) {
      // hls.js fallback for Chromium / Firefox
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [src]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover scale-105"
      />
      {/* Layered dark cinematic overlays for maximum legibility */}
      <div className="absolute inset-0 bg-black/60 z-1" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#08090c]/80 via-transparent to-[#08090c]/90 z-1" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,196,204,0.08)_0%,transparent_70%)] z-1" />
    </div>
  );
};
