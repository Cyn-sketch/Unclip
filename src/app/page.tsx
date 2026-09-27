"use client";

import React, { useState, useEffect, useRef } from "react";
import { Header } from "@/components/branding/Header";
import { Hero } from "@/components/home/Hero";
import { UrlInputBar } from "@/components/home/UrlInputBar";
import { SampleReelSelector } from "@/components/home/SampleReelSelector";
import { BackgroundVideo } from "@/components/home/BackgroundVideo";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { TranscriptionJob, SampleReel } from "@/types";
import { SITE_CONFIG } from "@/config/site";

export default function Home() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<TranscriptionJob | null>(null);
  const [activeSample, setActiveSample] = useState<SampleReel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clear polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Helper to safely parse JSON responses without throwing Unexpected end of JSON input
  const parseJsonResponse = async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const text = await res.text();
      if (text && text.trim().length > 0) {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      }
    }
    return null;
  };

  // Poll job status until completed or failed
  useEffect(() => {
    if (!activeJobId) return;

    const pollJob = async () => {
      try {
        const res = await fetch(`/api/transcribe/${activeJobId}`);
        if (res.ok) {
          const data: TranscriptionJob | null = await parseJsonResponse(res);
          if (data) {
            setActiveJob(data);

            if (data.status === "completed" || data.status === "failed") {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setIsSubmitting(false);
            }
          }
        } else {
          console.error(`[Unclip] Polling GET /api/transcribe/${activeJobId} returned HTTP status ${res.status}`);
        }
      } catch (err) {
        console.error("[Unclip] Polling error:", err);
      }
    };

    pollJob();
    pollIntervalRef.current = setInterval(pollJob, 750);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeJobId]);

  const handleCreateJob = async (url: string) => {
    setIsSubmitting(true);
    setActiveSample(null);

    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        console.error(`[Unclip] API POST /api/transcribe failed with HTTP status ${res.status}`);
        const errData = await parseJsonResponse(res);
        const userMsg = errData?.error || "Transcription service is currently unavailable. Please try again.";
        throw new Error(userMsg);
      }

      const data = await parseJsonResponse(res);
      if (!data || !data.jobId) {
        console.error(`[Unclip] API POST /api/transcribe returned HTTP ${res.status} but response body was empty or not valid JSON.`);
        throw new Error("Transcription service is currently unavailable. Please try again.");
      }

      setActiveJobId(data.jobId);
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : "Transcription service is currently unavailable. Please try again.";
      alert(msg);
    }
  };

  const handleSelectSample = async (sample: SampleReel) => {
    setIsSubmitting(true);
    setActiveSample(sample);

    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDemo: true, demoId: sample.id }),
      });

      if (!res.ok) {
        console.error(`[Unclip] API POST /api/transcribe (demo) failed with HTTP status ${res.status}`);
        const errData = await parseJsonResponse(res);
        const userMsg = errData?.error || "Transcription service is currently unavailable. Please try again.";
        throw new Error(userMsg);
      }

      const data = await parseJsonResponse(res);
      if (!data || !data.jobId) {
        console.error(`[Unclip] API POST /api/transcribe (demo) returned HTTP ${res.status} but response body was empty or not valid JSON.`);
        throw new Error("Transcription service is currently unavailable. Please try again.");
      }

      setActiveJobId(data.jobId);
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : "Transcription service is currently unavailable. Please try again.";
      alert(msg);
    }
  };

  const handleReset = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setActiveJobId(null);
    setActiveJob(null);
    setActiveSample(null);
    setIsSubmitting(false);
  };

  return (
    <div className={`w-screen bg-[#08090c] text-white font-body ${!activeJob ? "h-screen overflow-hidden relative" : "min-h-screen relative"}`}>
      {/* Background Video for Landing Hero */}
      {!activeJob && <BackgroundVideo />}

      <div className={`relative z-10 flex flex-col ${!activeJob ? "h-full justify-between" : "min-h-screen"}`}>
        <Header onReset={handleReset} />

        <main className={`flex-1 flex flex-col justify-center ${!activeJob ? "py-4 overflow-y-auto custom-scrollbar" : "pb-16"}`}>
          {!activeJob ? (
            <div className="my-auto py-2">
              <Hero />
              <UrlInputBar onSubmitUrl={handleCreateJob} isLoading={isSubmitting} />
              <SampleReelSelector onSelectSample={handleSelectSample} isDisabled={isSubmitting} />
            </div>
          ) : (
            <WorkspaceLayout
              job={activeJob}
              activeSample={activeSample}
              onReset={handleReset}
            />
          )}
        </main>

        {/* Minimal Editorial Footer */}
        {!activeJob && (
          <footer className="w-full py-3 px-4 relative z-20 text-center text-[11px] text-white/40 font-body backdrop-blur-xs">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
              <p>© {new Date().getFullYear()} {SITE_CONFIG.name}. All rights reserved.</p>
              <p className="text-[11px] text-white/30">Designed for public Instagram Reels & videos.</p>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

