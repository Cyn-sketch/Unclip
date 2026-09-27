"use client";

import React, { useState } from "react";
import { validateInstagramUrl } from "@/lib/instagram/validator";
import { Link2, Clipboard, X, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

interface UrlInputBarProps {
  onSubmitUrl: (url: string) => void;
  isLoading?: boolean;
}

export const UrlInputBar: React.FC<UrlInputBarProps> = ({ onSubmitUrl, isLoading = false }) => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError("Please paste an Instagram Reel URL.");
      return;
    }

    const validation = validateInstagramUrl(url);
    if (!validation.isValid) {
      setError(validation.error || "Please enter a valid public Instagram URL.");
      return;
    }

    setError(null);
    onSubmitUrl(validation.canonicalUrl || url);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        const validation = validateInstagramUrl(text);
        if (validation.isValid) {
          setError(null);
        }
      }
    } catch {
      // Fallback if clipboard API is blocked
    }
  };

  const handleClear = () => {
    setUrl("");
    setError(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-2xl mx-auto px-4 font-body relative z-20"
    >
      <form onSubmit={handleSubmit} className="relative flex flex-col gap-2">
        <label htmlFor="instagram-url-input" className="sr-only">
          Paste Instagram Reel URL
        </label>

        {/* Premium Rounded-Full Outlined Glass Capsule */}
        <div className={`relative flex items-center rounded-full bg-white/[0.04] backdrop-blur-xl border ${error ? "border-red-500/60" : "border-white/15 focus-within:border-[#00c4cc] focus-within:ring-2 focus-within:ring-[#00c4cc]/20"} p-2 shadow-2xl transition-all duration-300`}>
          <div className="pl-4 pr-2 text-[#00c4cc]">
            <Link2 className="w-5 h-5 text-[#00c4cc]" />
          </div>

          <input
            id="instagram-url-input"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Paste an Instagram Reel URL..."
            className="w-full bg-transparent text-white placeholder-white/40 text-sm sm:text-base focus:outline-none pr-2 font-body"
            disabled={isLoading}
            autoComplete="off"
            spellCheck={false}
          />

          {url && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-white/10 transition-colors mr-1"
              title="Clear input"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {!url && !isLoading && (
            <button
              type="button"
              onClick={handlePaste}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/80 hover:text-[#ffec00] rounded-full bg-white/5 hover:bg-white/10 transition-all mr-2 border border-white/10 font-body cursor-pointer"
              title="Paste from clipboard"
            >
              <Clipboard className="w-3.5 h-3.5 text-[#ffec00]" />
              <span>Paste</span>
            </button>
          )}

          {/* Cyan Primary CTA */}
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#00c4cc] hover:bg-[#00b2b8] text-black font-body font-bold text-sm sm:text-base shadow-lg shadow-[#00c4cc]/25 hover:shadow-[#00c4cc]/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-black" />
                <span>Unclip Video</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-red-950/60 border border-red-500/40 text-red-200 text-xs font-body font-medium animate-fadeIn backdrop-blur-md max-w-lg mx-auto">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between px-4 text-xs text-white/50 font-body">
          <span>Public Instagram videos only.</span>
          <span className="hidden sm:inline">Supports /reel/ & /p/ URLs</span>
        </div>
      </form>
    </motion.div>
  );
};

