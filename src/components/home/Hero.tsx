"use client";

import React from "react";
import { SITE_CONFIG } from "@/config/site";
import { Video, Headphones, FileText, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export const Hero: React.FC = () => {
  return (
    <div className="flex flex-col items-center text-center max-w-4xl mx-auto px-4 relative z-20">
      {/* Eyebrow Tag */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/15 text-[#00c4cc] text-[11px] font-body font-bold tracking-widest uppercase mb-6 backdrop-blur-md shadow-lg"
      >
        <span className="w-2 h-2 rounded-full bg-[#ffec00] animate-pulse" />
        <span>AI-POWERED REEL INTELLIGENCE</span>
      </motion.div>

      {/* Main Headline in Michroma */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="font-heading text-4xl sm:text-5xl lg:text-7xl text-white tracking-tight leading-[1.05] drop-shadow-2xl mb-4"
      >
        {SITE_CONFIG.tagline}
      </motion.h1>

      {/* Subheading in Encode Sans Expanded */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="font-body text-base sm:text-xl text-white/80 max-w-2xl leading-relaxed mb-6 drop-shadow"
      >
        {SITE_CONFIG.description}
      </motion.p>

      {/* Process Flow Pill: VIDEO -> AUDIO -> TRANSCRIPT */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-center gap-2.5 sm:gap-4 px-5 py-2.5 rounded-full bg-black/40 border border-white/10 text-xs font-body font-semibold text-neutral-200 backdrop-blur-md shadow-xl mb-6"
      >
        <div className="flex items-center gap-1.5 text-[#00c4cc]">
          <Video className="w-4 h-4 text-[#00c4cc]" />
          <span className="tracking-wider">VIDEO</span>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-neutral-500" />
        <div className="flex items-center gap-1.5 text-[#138eff]">
          <Headphones className="w-4 h-4 text-[#138eff]" />
          <span className="tracking-wider">AUDIO</span>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-neutral-500" />
        <div className="flex items-center gap-1.5 text-[#ffec00]">
          <FileText className="w-4 h-4 text-[#ffec00]" />
          <span className="tracking-wider">TRANSCRIPT</span>
        </div>
      </motion.div>
    </div>
  );
};

