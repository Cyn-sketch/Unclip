"use client";

import React from "react";
import { BrandLogo } from "./BrandLogo";
import { SITE_CONFIG } from "@/config/site";
import { Sparkles, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

interface HeaderProps {
  onReset?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onReset }) => {
  return (
    <motion.header 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-30 w-full px-6 sm:px-10 pt-4 sm:pt-6 pb-2 flex items-center justify-between"
    >
      {/* 1. Logo at EXTREME LEFT (~32-40px left margin from viewport edge) */}
      <div 
        onClick={onReset} 
        className="cursor-pointer z-20 shrink-0"
      >
        <BrandLogo size="sm" />
      </div>

      {/* 2. Compact Centered Navbar Banner (matching screenshot 2 footprint) */}
      <div className="absolute left-1/2 -translate-x-1/2 top-4 sm:top-6 z-10">
        <div className="rounded-full px-4 sm:px-6 py-2 flex items-center gap-2 sm:gap-4 bg-white/[0.01] backdrop-blur-[4px] border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_8px_32px_0_rgba(0,0,0,0.37)] font-body">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/10 text-xs text-neutral-300 backdrop-blur-md">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00c4cc]" />
            <span>Public Reels Only</span>
          </div>

          <a
            href={SITE_CONFIG.links.github}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#ffec00]/10 border border-[#ffec00]/30 text-[#ffec00] hover:bg-[#ffec00]/20 transition-all text-xs font-bold shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#ffec00]" />
            <span>v1.0 MVP</span>
          </a>
        </div>
      </div>
    </motion.header>
  );
};

