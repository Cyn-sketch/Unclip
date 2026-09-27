import React, { useRef, useState, useEffect } from "react";
import { formatTimestamp } from "@/lib/utils";
import { Play, Pause, Volume2, VolumeX, RotateCcw, AlertCircle, Headphones } from "lucide-react";

interface VideoPlayerProps {
  videoUrl?: string;
  hasVideoPlayback?: boolean;
  title?: string;
  author?: string;
  currentTime: number;
  duration: number;
  onTimeUpdate: (time: number) => void;
  onSeek: (time: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  hasVideoPlayback = false,
  title,
  author,
  currentTime,
  duration,
  onTimeUpdate,
  onSeek,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  // Sync external seek props to HTML5 video element
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const togglePlay = () => {
    if (hasVideoPlayback && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    } else {
      // Transcript-only audio timer simulation mode
      setIsPlaying(!isPlaying);
    }
  };

  // Timer loop for simulated audio timeline when no video file is present
  useEffect(() => {
    if (!hasVideoPlayback && isPlaying) {
      const interval = setInterval(() => {
        const nextTime = currentTime + 0.25;
        if (nextTime >= duration) {
          setIsPlaying(false);
          onSeek(0);
        } else {
          onTimeUpdate(nextTime);
        }
      }, 250);
      return () => clearInterval(interval);
    }
  }, [hasVideoPlayback, isPlaying, duration, currentTime, onTimeUpdate, onSeek]);

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  return (
    <div className="w-full flex flex-col rounded-2xl bg-[#0d1017] border border-[#00c4cc]/20 overflow-hidden shadow-2xl font-body">
      {/* Media Box */}
      <div className="relative aspect-video w-full bg-[#08090c] flex items-center justify-center border-b border-[#00c4cc]/15 overflow-hidden">
        {hasVideoPlayback && videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            onTimeUpdate={() => {
              if (videoRef.current) onTimeUpdate(videoRef.current.currentTime);
            }}
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          /* Mode B: Transcript-Only Fallback View */
          <div className="flex flex-col items-center justify-center p-6 text-center font-body">
            <div className="w-16 h-16 rounded-full bg-[#00c4cc]/10 border border-[#00c4cc]/30 flex items-center justify-center text-[#00c4cc] mb-3 shadow-lg shadow-[#00c4cc]/10">
              <Headphones className="w-8 h-8 text-[#00c4cc]" />
            </div>
            <h4 className="text-sm font-bold text-white max-w-xs truncate font-body">
              {title || "Instagram Video Transcript"}
            </h4>
            <p className="text-xs text-neutral-400 mt-1 font-body">{author || "@instagram_creator"}</p>

            <div className="mt-4 px-3.5 py-1.5 rounded-full bg-[#08090c] border border-[#00c4cc]/20 text-[11px] text-neutral-300 flex items-center gap-1.5 font-body">
              <AlertCircle className="w-3.5 h-3.5 text-[#ffec00]" />
              <span>Transcript-Only Mode (Media direct embed unavailable)</span>
            </div>
          </div>
        )}

        {/* Ambient Overlay Gradient */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0d1017] via-transparent to-black/40 opacity-70" />
      </div>

      {/* Control Bar */}
      <div className="p-4 flex flex-col gap-3 font-body">
        {/* Seek Bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-medium text-neutral-400 w-10 text-right">
            {formatTimestamp(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => {
              const newTime = parseFloat(e.target.value);
              onSeek(newTime);
            }}
            className="flex-1 h-1.5 rounded-lg appearance-none bg-neutral-800 accent-[#00c4cc] cursor-pointer"
          />
          <span className="text-xs font-mono font-medium text-neutral-400 w-10">
            {formatTimestamp(duration)}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="p-2.5 rounded-xl bg-[#00c4cc] hover:bg-[#00b2b8] text-black shadow-md shadow-[#00c4cc]/20 transition-all hover:scale-105 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4 text-black" /> : <Play className="w-4 h-4 fill-black text-black ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => onSeek(0)}
              className="p-2 rounded-lg bg-[#08090c] hover:bg-[#00c4cc]/10 text-neutral-300 hover:text-white border border-[#00c4cc]/15 transition-colors cursor-pointer"
              title="Reset player"
            >
              <RotateCcw className="w-4 h-4 text-[#00c4cc]" />
            </button>

            {hasVideoPlayback && (
              <button
                type="button"
                onClick={() => {
                  setIsMuted(!isMuted);
                  if (videoRef.current) videoRef.current.muted = !isMuted;
                }}
                className="p-2 rounded-lg bg-[#08090c] hover:bg-[#00c4cc]/10 text-neutral-300 transition-colors border border-[#00c4cc]/15 cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[#00c4cc]" />}
              </button>
            )}
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-[#08090c] p-1 rounded-xl border border-[#00c4cc]/20">
            {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => handleRateChange(rate)}
                className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                  playbackRate === rate
                    ? "bg-[#00c4cc] text-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
