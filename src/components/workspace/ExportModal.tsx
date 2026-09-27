import React, { useState, useMemo } from "react";
import { Transcript } from "@/types";
import { formatSRTTime, formatVTTTime, formatTimestamp } from "@/lib/utils";
import { X, Download, Copy, Check, FileCode } from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcript: Transcript;
}

type ExportFormat = "txt" | "srt" | "vtt" | "md" | "json";

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, transcript }) => {
  const [format, setFormat] = useState<ExportFormat>("srt");
  const [copied, setCopied] = useState(false);

  const formattedOutput = useMemo(() => {
    const segments = transcript.segments || [];

    switch (format) {
      case "txt":
        return segments.map((s) => s.text).join("\n\n");

      case "srt":
        return segments
          .map((s, idx) => {
            return `${idx + 1}\n${formatSRTTime(s.start)} --> ${formatSRTTime(s.end)}\n${s.text}\n`;
          })
          .join("\n");

      case "vtt":
        return (
          `WEBVTT - ${transcript.metadata?.title || "Instagram Video Transcript"}\n\n` +
          segments
            .map((s, idx) => {
              return `${idx + 1}\n${formatVTTTime(s.start)} --> ${formatVTTTime(s.end)}\n${s.text}\n`;
            })
            .join("\n")
        );

      case "md":
        return (
          `# ${transcript.metadata?.title || "Instagram Video Transcript"}\n\n` +
          `**Source:** ${transcript.metadata?.sourceUrl || "Instagram"}\n` +
          `**Language:** ${transcript.language.toUpperCase()}\n` +
          `**Duration:** ${transcript.duration} seconds\n\n` +
          `## Transcript\n\n` +
          segments
            .map((s) => `* **[${formatTimestamp(s.start)}]** ${s.speaker ? `*${s.speaker}*: ` : ""}${s.text}`)
            .join("\n\n")
        );

      case "json":
        return JSON.stringify(transcript, null, 2);

      default:
        return "";
    }
  }, [transcript, format]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([formattedOutput], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unclip_transcript_${transcript.id}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn font-body">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0d1017] border border-[#00c4cc]/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#00c4cc]/15 flex items-center justify-between bg-[#141824]/60">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-[#00c4cc]" />
            <h3 className="font-heading text-lg text-white">Export Transcript</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector Pills */}
        <div className="p-4 border-b border-[#00c4cc]/10 bg-[#08090c]/40 flex flex-wrap gap-2">
          {(["srt", "vtt", "txt", "md", "json"] as ExportFormat[]).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => setFormat(fmt)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
                format === fmt
                  ? "bg-[#00c4cc] text-black shadow-md shadow-[#00c4cc]/20 border border-[#00c4cc]"
                  : "bg-[#08090c] text-neutral-400 hover:text-white hover:bg-[#00c4cc]/10 border border-[#00c4cc]/15"
              }`}
            >
              .{fmt}
            </button>
          ))}
        </div>

        {/* Preview Code View */}
        <div className="p-4 flex-1 overflow-y-auto bg-[#08090c] font-mono text-xs text-neutral-300 custom-scrollbar leading-relaxed">
          <pre className="whitespace-pre-wrap break-all">{formattedOutput}</pre>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#00c4cc]/15 bg-[#141824]/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#08090c] hover:bg-[#00c4cc]/10 border border-[#00c4cc]/20 text-white font-body font-bold text-xs transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#00c4cc]" />
                <span>Copy Format</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00c4cc] hover:bg-[#00b2b8] text-black font-body font-bold text-xs shadow-lg shadow-[#00c4cc]/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-black" />
            <span>Download .{format.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
