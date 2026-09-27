import React from "react";
import { JobStatus } from "@/types";
import { Loader2, CheckCircle2, AlertCircle, Video, Headphones, Mic, Sparkles } from "lucide-react";

interface JobStatusTrackerProps {
  status: JobStatus;
  progress: number;
  message?: string;
  error?: string;
}

export const JobStatusTracker: React.FC<JobStatusTrackerProps> = ({
  status,
  progress,
  message,
  error,
}) => {
  const steps: { key: JobStatus[]; label: string; icon: React.ReactNode }[] = [
    { key: ["queued", "retrieving"], label: "Checking Video", icon: <Video className="w-4 h-4" /> },
    { key: ["extracting"], label: "Extracting Audio", icon: <Headphones className="w-4 h-4" /> },
    { key: ["transcribing"], label: "Transcribing Speech", icon: <Mic className="w-4 h-4" /> },
    { key: ["processing", "completed"], label: "Formatting Transcript", icon: <Sparkles className="w-4 h-4" /> },
  ];

  const getCurrentStepIndex = () => {
    if (status === "queued" || status === "retrieving") return 0;
    if (status === "extracting") return 1;
    if (status === "transcribing") return 2;
    if (status === "processing" || status === "completed") return 3;
    return 0;
  };

  const currentStep = getCurrentStepIndex();

  if (status === "failed") {
    return (
      <div className="w-full max-w-2xl mx-auto my-8 p-6 rounded-2xl bg-red-950/30 border border-red-500/40 text-center shadow-xl font-body">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-red-900/40 text-red-400 mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="font-heading text-xl text-red-200">Couldn't access this video</h3>
        <p className="mt-2 text-sm text-neutral-300 max-w-md mx-auto leading-relaxed font-body">
          {error || "The supplied Reel could not be retrieved. Make sure the video is publicly accessible and the URL is correct."}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto my-8 p-6 rounded-2xl bg-[#0d1017] border border-[#00c4cc]/20 shadow-2xl font-body">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 text-[#00c4cc] animate-spin" />
          <h3 className="font-heading text-lg text-white">Unclipping Video...</h3>
        </div>
        <span className="text-xs font-mono font-bold text-[#00c4cc] bg-[#00c4cc]/15 px-3 py-1 rounded-full border border-[#00c4cc]/30">
          {progress}%
        </span>
      </div>

      {/* Progress Bar with Unclip Brand Gradient */}
      <div className="w-full h-2.5 rounded-full bg-[#08090c] overflow-hidden mb-6 border border-white/5">
        <div
          className="h-full bg-gradient-to-r from-[#00c4cc] via-[#138eff] to-[#ffec00] transition-all duration-300 rounded-full"
          style={{ width: `${Math.max(5, progress)}%` }}
        />
      </div>

      {/* Steps breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {steps.map((step, idx) => {
          const isDone = idx < currentStep;
          const isCurrent = idx === currentStep;

          return (
            <div
              key={step.label}
              className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition-all ${
                isDone
                  ? "bg-[#00c4cc]/10 border-[#00c4cc]/30 text-[#00c4cc]"
                  : isCurrent
                  ? "bg-[#00c4cc]/20 border-[#00c4cc] text-white shadow-lg shadow-[#00c4cc]/20 scale-[1.02]"
                  : "bg-[#08090c]/40 border-white/5 text-neutral-500"
              }`}
            >
              <div className="mb-1">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-[#00c4cc]" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-[#ffec00] animate-spin" />
                ) : (
                  step.icon
                )}
              </div>
              <span className="text-[11px] font-body font-semibold tracking-tight">{step.label}</span>
            </div>
          );
        })}
      </div>

      {message && (
        <p className="mt-4 text-xs text-center text-neutral-400 animate-pulse font-mono">
          {message}
        </p>
      )}
    </div>
  );
};
