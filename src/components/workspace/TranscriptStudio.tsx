import React, { useState, useMemo } from "react";
import { Transcript, Segment } from "@/types";
import { formatTimestamp, formatDuration } from "@/lib/utils";
import { Search, Copy, Check, Edit2, Download, FileText, Globe, Clock, User, CheckCircle2 } from "lucide-react";

interface TranscriptStudioProps {
  transcript: Transcript;
  currentTime: number;
  onSeek: (seconds: number) => void;
  onOpenExportModal: () => void;
}

export const TranscriptStudio: React.FC<TranscriptStudioProps> = ({
  transcript,
  currentTime,
  onSeek,
  onOpenExportModal,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState("");
  const [segments, setSegments] = useState<Segment[]>(transcript.segments || []);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fullCopied, setFullCopied] = useState(false);

  // Filter segments based on search
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const query = searchQuery.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(query));
  }, [segments, searchQuery]);

  // Find currently active segment based on player currentTime
  const activeSegmentId = useMemo(() => {
    const active = segments.find(
      (s) => currentTime >= s.start && currentTime <= s.end + 0.5
    );
    return active ? active.id : null;
  }, [segments, currentTime]);

  const handleCopyFullText = () => {
    const textToCopy = segments.map((s) => s.text).join(" ");
    navigator.clipboard.writeText(textToCopy);
    setFullCopied(true);
    setTimeout(() => setFullCopied(false), 2000);
  };

  const handleCopySegment = (seg: Segment) => {
    const formatted = `[${formatTimestamp(seg.start)}] ${seg.speaker ? `${seg.speaker}: ` : ""}${seg.text}`;
    navigator.clipboard.writeText(formatted);
    setCopiedId(seg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startEdit = (seg: Segment) => {
    setEditingSegmentId(seg.id);
    setEditedText(seg.text);
  };

  const saveEdit = (id: string) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text: editedText } : s))
    );
    setEditingSegmentId(null);
  };

  const totalWords = useMemo(() => {
    return segments.reduce((acc, s) => acc + s.text.split(/\s+/).filter(Boolean).length, 0);
  }, [segments]);

  return (
    <div className="w-full flex flex-col rounded-2xl bg-[#0d1017] border border-[#00c4cc]/20 overflow-hidden shadow-2xl font-body">
      {/* Header Bar */}
      <div className="p-4 border-b border-[#00c4cc]/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#141824]/40">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#00c4cc]/10 border border-[#00c4cc]/30 text-[#00c4cc]">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading text-lg text-white">Transcript Studio</h3>
            <div className="flex items-center gap-3 text-xs text-neutral-400 mt-0.5 font-body">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#00c4cc]" />
                {formatDuration(transcript.duration)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-[#138eff]" />
                {transcript.language.toUpperCase()}
              </span>
              <span>•</span>
              <span>{totalWords} words</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleCopyFullText}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#08090c] hover:bg-[#00c4cc]/10 border border-[#00c4cc]/20 text-neutral-200 text-xs font-body font-bold transition-all cursor-pointer"
          >
            {fullCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#00c4cc]" />
                <span>Copy All</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenExportModal}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#00c4cc] hover:bg-[#00b2b8] text-black text-xs font-body font-bold shadow-md shadow-[#00c4cc]/20 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-black" />
            <span>Export...</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-[#00c4cc]/10 bg-[#08090c]/40">
        <div className="relative flex items-center rounded-xl bg-[#08090c] border border-[#00c4cc]/15 px-3 py-1.5 focus-within:border-[#00c4cc]">
          <Search className="w-4 h-4 text-neutral-500 mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search within transcript..."
            className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none font-body"
          />
        </div>
      </div>

      {/* Segments Stream */}
      <div className="p-4 flex flex-col gap-2.5 max-h-[460px] overflow-y-auto custom-scrollbar">
        {filteredSegments.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 text-xs font-body">
            No segments matching "{searchQuery}"
          </div>
        ) : (
          filteredSegments.map((seg) => {
            const isActive = seg.id === activeSegmentId;
            const isEditing = seg.id === editingSegmentId;

            return (
              <div
                key={seg.id}
                className={`group relative flex flex-col sm:flex-row items-start gap-3 p-3 rounded-xl border transition-all duration-200 ${
                  isActive
                    ? "bg-[#00c4cc]/10 border-[#00c4cc]/50 shadow-md ring-1 ring-[#00c4cc]/30"
                    : "bg-[#141824]/40 border-white/5 hover:border-[#00c4cc]/20 hover:bg-[#141824]/80"
                }`}
              >
                {/* Timestamp button */}
                <button
                  type="button"
                  onClick={() => onSeek(seg.start)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold shrink-0 transition-all ${
                    isActive
                      ? "bg-[#00c4cc] text-black shadow-sm"
                      : "bg-[#08090c] text-[#00c4cc] border border-[#00c4cc]/20 hover:bg-[#00c4cc]/20 hover:text-white"
                  }`}
                  title="Jump video to this timestamp"
                >
                  {formatTimestamp(seg.start)}
                </button>

                {/* Segment Content */}
                <div className="flex-1 min-w-0 w-full font-body">
                  <div className="flex items-center gap-2 mb-1">
                    {seg.speaker && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-[#00c4cc]">
                        <User className="w-3 h-3 text-[#00c4cc]" />
                        {seg.speaker}
                      </span>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <textarea
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        className="w-full p-2 rounded-lg bg-[#08090c] border border-[#00c4cc] text-white text-xs sm:text-sm focus:outline-none font-body"
                        rows={2}
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingSegmentId(null)}
                          className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-400 text-xs font-body hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEdit(seg.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#00c4cc] text-black text-xs font-body font-bold hover:bg-[#00b2b8]"
                        >
                          Save Edit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed font-body">
                      {seg.text}
                    </p>
                  )}
                </div>

                {/* Segment Actions */}
                {!isEditing && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleCopySegment(seg)}
                      className="p-1.5 rounded-lg bg-[#08090c] hover:bg-[#00c4cc]/20 text-neutral-300 hover:text-white transition-colors border border-white/5"
                      title="Copy segment"
                    >
                      {copiedId === seg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#00c4cc]" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => startEdit(seg)}
                      className="p-1.5 rounded-lg bg-[#08090c] hover:bg-[#00c4cc]/20 text-neutral-300 hover:text-white transition-colors border border-white/5"
                      title="Edit segment"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#ffec00]" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Provider info */}
      <div className="p-3 border-t border-[#00c4cc]/10 bg-[#08090c]/60 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>STT Engine: {transcript.metadata.sttProvider}</span>
        </span>
        <span>Raw transcript intact</span>
      </div>
    </div>
  );
};
