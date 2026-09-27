"use client";

import React from "react";
import { SAMPLE_REELS } from "@/lib/demo/sample-data";
import { SampleReel } from "@/types";
import { Play, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface SampleReelSelectorProps {
  onSelectSample: (sample: SampleReel) => void;
  isDisabled?: boolean;
}

export const SampleReelSelector: React.FC<SampleReelSelectorProps> = ({
  onSelectSample,
  isDisabled = false,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-3xl mx-auto px-4 mt-6 font-body relative z-20"
    >
      <div className="flex items-center justify-center mb-3 px-1">
        <div className="flex items-center gap-2 text-xs font-body font-bold text-white/70 uppercase tracking-widest bg-white/[0.03] backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
          <Sparkles className="w-3.5 h-3.5 text-[#ffec00]" />
          <span>Or try an authorized sample reel:</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SAMPLE_REELS.map((sample) => (
          <button
            key={sample.id}
            type="button"
            disabled={isDisabled}
            onClick={() => onSelectSample(sample)}
            className="group relative flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/10 hover:border-[#00c4cc]/50 hover:bg-white/[0.06] text-left transition-all duration-300 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl cursor-pointer"
          >
            {/* Thumbnail */}
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-black/60 shrink-0 border border-white/10">
              <img
                src={sample.thumbnailUrl}
                alt={sample.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/30 group-hover:bg-[#00c4cc]/20 transition-colors flex items-center justify-center">
                <Play className="w-4 h-4 text-[#ffec00] fill-[#ffec00] group-hover:scale-110 transition-transform" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 font-body">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 rounded-full bg-[#ffec00]/15 border border-[#ffec00]/30 text-[10px] font-bold text-[#ffec00]">
                  {sample.category}
                </span>
                <span className="text-[10px] text-white/50 font-mono">{sample.duration}s</span>
              </div>
              <h4 className="text-xs font-bold text-white truncate group-hover:text-[#00c4cc] transition-colors">
                {sample.title}
              </h4>
              <p className="text-[11px] text-white/60 truncate">{sample.author}</p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

