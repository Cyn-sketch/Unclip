import React, { useState } from "react";
import { TranscriptionJob, Transcript, SampleReel } from "@/types";
import { TranscriptStudio } from "./TranscriptStudio";
import { ContentStudio } from "./ContentStudio";
import { ExportModal } from "./ExportModal";
import { JobStatusTracker } from "./JobStatusTracker";
import { ArrowLeft } from "lucide-react";

interface WorkspaceLayoutProps {
  job: TranscriptionJob | null;
  activeSample?: SampleReel | null;
  onReset: () => void;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  job,
  activeSample,
  onReset,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isExportOpen, setIsExportOpen] = useState(false);

  if (!job) return null;

  if (job.status !== "completed") {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-8 font-body">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0d1017] border border-[#00c4cc]/20 text-neutral-300 hover:text-[#00c4cc] text-xs font-body font-bold mb-6 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#00c4cc]" />
          <span>Back to Input</span>
        </button>

        <JobStatusTracker
          status={job.status}
          progress={job.progress}
          message={job.message}
          error={job.error}
        />
      </div>
    );
  }

  const transcript: Transcript | undefined = job.transcript;
  if (!transcript) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn font-body">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#00c4cc]/15">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            className="p-2 rounded-xl bg-[#0d1017] border border-[#00c4cc]/20 text-neutral-300 hover:text-[#00c4cc] hover:bg-[#00c4cc]/10 transition-colors cursor-pointer"
            title="Back to home"
          >
            <ArrowLeft className="w-5 h-5 text-[#00c4cc]" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#00c4cc]/15 border border-[#00c4cc]/30 text-[10px] font-bold text-[#00c4cc] uppercase tracking-wider">
                TRANSCRIPT READY
              </span>
              <span className="text-xs text-neutral-400 font-mono">ID: {job.id}</span>
            </div>
            <h2 className="font-heading text-xl sm:text-2xl text-white mt-1">
              {transcript.metadata.title || "Instagram Video"}
            </h2>
          </div>
        </div>
      </div>

      {/* Transcript Studio - Full Width Workspace */}
      <div className="w-full flex flex-col">
        <TranscriptStudio
          transcript={transcript}
          currentTime={currentTime}
          onSeek={(t) => setCurrentTime(t)}
          onOpenExportModal={() => setIsExportOpen(true)}
        />
      </div>

      {/* Content Intelligence Studio Section */}
      <div className="mt-8">
        <ContentStudio transcript={transcript} onSeek={(t) => setCurrentTime(t)} />
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        transcript={transcript}
      />
    </div>
  );
};
